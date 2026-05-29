import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
} from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";
import { emitToProject, emitToUser } from "../socket";

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the caller's membership or null. Throws 404 if project not found. */
async function getMembership(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return membership;
}

function canManage(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const teamController = {

  // GET /api/projects/:projectId/members
  async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const membership = await getMembership(projectId, userId);
      if (!membership) { sendForbidden(res, "Not a member of this project"); return; }

      const members = await prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      sendSuccess(res, members, "Members retrieved");
    } catch (error) {
      logger.error("GetMembers error:", error);
      sendError(res, "Failed to get members");
    }
  },

  // POST /api/projects/:projectId/members/invite
  async inviteMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const { email, role } = req.body;

      // Check caller is OWNER or ADMIN
      const membership = await getMembership(projectId, userId);
      if (!membership || !canManage(membership.role)) {
        sendForbidden(res, "Only project owners and admins can invite members");
        return;
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) { sendNotFound(res, "Project not found"); return; }

      // Find invitee by email
      const invitee = await prisma.user.findUnique({ where: { email } });

      // Check if already a member
      if (invitee) {
        const existing = await prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: invitee.id, projectId } },
        });
        if (existing) { sendBadRequest(res, "User is already a member of this project"); return; }
      }

      // Check if pending invite exists
      const existingInvite = await prisma.projectInvite.findFirst({
        where: { email, projectId, status: "PENDING" },
      });
      if (existingInvite) { sendBadRequest(res, "An invite is already pending for this email"); return; }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await prisma.projectInvite.create({
        data: {
          email,
          role,
          projectId,
          invitedById: userId,
          inviteeId: invitee?.id ?? null,
          expiresAt,
        },
        include: {
          project: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, name: true } },
        },
      });

      // If user exists, notify them via socket immediately
      if (invitee) {
        emitToUser(invitee.id, "project:invite_received", {
          invite: {
            id: invite.id,
            token: invite.token,
            projectName: project.name,
            role,
            invitedBy: invite.invitedBy.name,
          },
        });
      }

      await activityService.log({
        userId,
        type: "MEMBER_INVITED",
        description: `Invited ${email} to project "${project.name}" as ${role}`,
        metadata: { projectId, email, role },
      });

      sendCreated(res, invite, "Invitation sent");
    } catch (error) {
      logger.error("InviteMember error:", error);
      sendError(res, "Failed to send invitation");
    }
  },

  // POST /api/projects/invites/:token/accept
  async acceptInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const userId = req.user!.id;
      const user = req.user!;

      const invite = await prisma.projectInvite.findUnique({
        where: { token },
        include: { project: true },
      });

      if (!invite) { sendNotFound(res, "Invite not found"); return; }
      if (invite.status !== "PENDING") { sendBadRequest(res, `Invite already ${invite.status.toLowerCase()}`); return; }
      if (invite.expiresAt < new Date()) {
        await prisma.projectInvite.update({ where: { token }, data: { status: "EXPIRED" } });
        sendBadRequest(res, "Invite has expired");
        return;
      }

      // Verify the invite email matches the logged-in user
      if (invite.email !== user.email) {
        sendForbidden(res, "This invite was sent to a different email address");
        return;
      }

      // Add as member (upsert in case of race condition)
      const member = await prisma.projectMember.upsert({
        where: { userId_projectId: { userId, projectId: invite.projectId } },
        create: { userId, projectId: invite.projectId, role: invite.role },
        update: {},
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });

      await prisma.projectInvite.update({ where: { token }, data: { status: "ACCEPTED", inviteeId: userId } });

      // Notify entire project room
      emitToProject(invite.projectId, "project:member_joined", {
        member: { ...member, role: invite.role },
        projectId: invite.projectId,
      });

      await activityService.log({
        userId,
        type: "MEMBER_JOINED",
        description: `Joined project "${invite.project.name}"`,
        metadata: { projectId: invite.projectId },
      });

      sendSuccess(res, { member, project: invite.project }, "Successfully joined project");
    } catch (error) {
      logger.error("AcceptInvite error:", error);
      sendError(res, "Failed to accept invite");
    }
  },

  // POST /api/projects/invites/:token/decline
  async declineInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const userId = req.user!.id;
      const user = req.user!;

      const invite = await prisma.projectInvite.findUnique({ where: { token } });
      if (!invite) { sendNotFound(res, "Invite not found"); return; }
      if (invite.email !== user.email) { sendForbidden(res, "Not your invite"); return; }
      if (invite.status !== "PENDING") { sendBadRequest(res, "Invite already responded to"); return; }

      await prisma.projectInvite.update({ where: { token }, data: { status: "DECLINED" } });
      sendSuccess(res, null, "Invite declined");
    } catch (error) {
      logger.error("DeclineInvite error:", error);
      sendError(res, "Failed to decline invite");
    }
  },

  // GET /api/projects/invites/pending — invites for current user's email
  async getMyInvites(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      const invites = await prisma.projectInvite.findMany({
        where: { email: user.email, status: "PENDING", expiresAt: { gt: new Date() } },
        include: {
          project: { select: { id: true, name: true, color: true } },
          invitedBy: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      sendSuccess(res, invites, "Pending invites retrieved");
    } catch (error) {
      logger.error("GetMyInvites error:", error);
      sendError(res, "Failed to get invites");
    }
  },

  // PATCH /api/projects/:projectId/members/:memberId/role
  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId, memberId } = req.params;
      const { role } = req.body;
      const userId = req.user!.id;

      // Only OWNER can change roles
      const callerMembership = await getMembership(projectId, userId);
      if (!callerMembership || callerMembership.role !== "OWNER") {
        sendForbidden(res, "Only the project owner can change roles");
        return;
      }

      const target = await prisma.projectMember.findUnique({
        where: { id: memberId },
        include: { user: { select: { name: true } } },
      });
      if (!target || target.projectId !== projectId) { sendNotFound(res, "Member not found"); return; }
      if (target.role === "OWNER") { sendBadRequest(res, "Cannot change the owner's role"); return; }

      const updated = await prisma.projectMember.update({
        where: { id: memberId },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });

      emitToProject(projectId, "project:member_role_changed", { memberId, role, projectId });

      await activityService.log({
        userId,
        type: "MEMBER_ROLE_CHANGED",
        description: `Changed ${target.user.name}'s role to ${role}`,
        metadata: { projectId, memberId, role },
      });

      sendSuccess(res, updated, "Role updated");
    } catch (error) {
      logger.error("UpdateMemberRole error:", error);
      sendError(res, "Failed to update role");
    }
  },

  // DELETE /api/projects/:projectId/members/:memberId
  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId, memberId } = req.params;
      const userId = req.user!.id;

      const callerMembership = await getMembership(projectId, userId);
      if (!callerMembership || !canManage(callerMembership.role)) {
        sendForbidden(res, "Only owners and admins can remove members");
        return;
      }

      const target = await prisma.projectMember.findUnique({
        where: { id: memberId },
        include: { user: { select: { name: true } } },
      });
      if (!target || target.projectId !== projectId) { sendNotFound(res, "Member not found"); return; }
      if (target.role === "OWNER") { sendBadRequest(res, "Cannot remove the project owner"); return; }

      await prisma.projectMember.delete({ where: { id: memberId } });

      emitToProject(projectId, "project:member_removed", { memberId, userId: target.userId, projectId });
      emitToUser(target.userId, "project:removed_from_project", { projectId });

      await activityService.log({
        userId,
        type: "MEMBER_REMOVED",
        description: `Removed ${target.user.name} from project`,
        metadata: { projectId, memberId },
      });

      sendSuccess(res, { memberId }, "Member removed");
    } catch (error) {
      logger.error("RemoveMember error:", error);
      sendError(res, "Failed to remove member");
    }
  },

  // DELETE /api/projects/:projectId/members/leave — leave project yourself
  async leaveProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const membership = await getMembership(projectId, userId);
      if (!membership) { sendNotFound(res, "You are not a member of this project"); return; }
      if (membership.role === "OWNER") { sendBadRequest(res, "Owner cannot leave. Transfer ownership or delete the project."); return; }

      await prisma.projectMember.delete({ where: { id: membership.id } });
      emitToProject(projectId, "project:member_removed", { memberId: membership.id, userId, projectId });

      sendSuccess(res, null, "Left project successfully");
    } catch (error) {
      logger.error("LeaveProject error:", error);
      sendError(res, "Failed to leave project");
    }
  },

  // GET /api/projects/:projectId/invites — list invites for a project
  async getProjectInvites(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const membership = await getMembership(projectId, userId);
      if (!membership || !canManage(membership.role)) {
        sendForbidden(res, "Only owners and admins can view invites");
        return;
      }

      const invites = await prisma.projectInvite.findMany({
        where: { projectId },
        include: { invitedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });

      sendSuccess(res, invites, "Invites retrieved");
    } catch (error) {
      logger.error("GetProjectInvites error:", error);
      sendError(res, "Failed to get invites");
    }
  },
};
