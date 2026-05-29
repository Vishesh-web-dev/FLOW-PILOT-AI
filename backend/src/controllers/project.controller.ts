import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendForbidden,
} from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";
import { emitToProject } from "../socket";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const projectController = {
  // GET /api/projects — returns all projects user owns OR is a member of
  async getAllProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        include: {
          project: {
            include: {
              _count: { select: { tasks: true, sprints: true, members: true } },
              members: {
                include: {
                  user: { select: { id: true, name: true, avatar: true } },
                },
                take: 5,
              },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });

      const projects = memberships.map((m) => ({
        ...m.project,
        myRole: m.role,
      }));

      sendSuccess(res, projects, "Projects retrieved");
    } catch (error) {
      logger.error("GetAllProjects error:", error);
      sendError(res, "Failed to retrieve projects");
    }
  },

  // GET /api/projects/:id
  async getProjectById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Must be a member
      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: id } },
      });
      if (!membership) { sendForbidden(res, "You are not a member of this project"); return; }

      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          tasks: {
            where: { parentId: null },
            orderBy: [{ position: "asc" }, { createdAt: "desc" }],
            include: {
              subtasks: { select: { id: true, title: true, status: true } },
              _count: { select: { subtasks: true } },
              assignee: { select: { id: true, name: true, avatar: true } },
            },
          },
          sprints: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { tasks: true } } },
          },
          members: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          },
          _count: { select: { tasks: true, sprints: true, members: true } },
        },
      });

      if (!project) { sendNotFound(res, "Project not found"); return; }

      sendSuccess(res, { ...project, myRole: membership.role }, "Project retrieved");
    } catch (error) {
      logger.error("GetProjectById error:", error);
      sendError(res, "Failed to get project");
    }
  },

  // POST /api/projects
  async createProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const project = await prisma.project.create({
        data: {
          ...data,
          userId,
          members: {
            create: { userId, role: "OWNER" }, // creator is OWNER
          },
        },
        include: {
          _count: { select: { tasks: true, sprints: true, members: true } },
          members: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      });

      await activityService.log({
        userId,
        type: "PROJECT_CREATED",
        description: `Created project: "${project.name}"`,
        metadata: { projectId: project.id },
      });

      sendCreated(res, { ...project, myRole: "OWNER" }, "Project created");
    } catch (error) {
      logger.error("CreateProject error:", error);
      sendError(res, "Failed to create project");
    }
  },

  // PUT /api/projects/:id — only OWNER or ADMIN
  async updateProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: id } },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        sendForbidden(res, "Only owners and admins can update this project");
        return;
      }

      const project = await prisma.project.update({
        where: { id },
        data: req.body,
        include: {
          _count: { select: { tasks: true, sprints: true, members: true } },
          members: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      });

      emitToProject(id, "project:updated", project);
      sendSuccess(res, project, "Project updated");
    } catch (error) {
      logger.error("UpdateProject error:", error);
      sendError(res, "Failed to update project");
    }
  },

  // DELETE /api/projects/:id — only OWNER
  async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: id } },
      });
      if (!membership || membership.role !== "OWNER") {
        sendForbidden(res, "Only the project owner can delete this project");
        return;
      }

      emitToProject(id, "project:deleted", { id });
      await prisma.project.delete({ where: { id } });
      sendSuccess(res, { id }, "Project deleted");
    } catch (error) {
      logger.error("DeleteProject error:", error);
      sendError(res, "Failed to delete project");
    }
  },
};
