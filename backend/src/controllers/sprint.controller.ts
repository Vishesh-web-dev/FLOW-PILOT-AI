import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
} from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";

export const createSprintSchema = z.object({
  name: z.string().min(1, "Name is required"),
  goal: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

export const sprintController = {
  // GET /api/sprints
  async getAllSprints(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { projectId } = req.query as Record<string, string>;

      const sprints = await prisma.sprint.findMany({
        where: {
          userId,
          ...(projectId && { projectId }),
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, color: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              estimatedHours: true,
            },
          },
          _count: { select: { tasks: true } },
        },
      });

      sendSuccess(res, sprints, "Sprints retrieved");
    } catch (error) {
      logger.error("GetAllSprints error:", error);
      sendError(res, "Failed to retrieve sprints");
    }
  },

  // GET /api/sprints/:id
  async getSprintById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const sprint = await prisma.sprint.findFirst({
        where: { id, userId },
        include: {
          project: { select: { id: true, name: true, color: true } },
          tasks: {
            orderBy: [{ status: "asc" }, { position: "asc" }],
            include: {
              subtasks: { select: { id: true, title: true, status: true } },
              _count: { select: { subtasks: true } },
            },
          },
        },
      });

      if (!sprint) {
        sendNotFound(res, "Sprint not found");
        return;
      }

      // Calculate progress
      const totalTasks = sprint.tasks.length;
      const completedTasks = sprint.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      sendSuccess(res, { ...sprint, progress, totalTasks, completedTasks }, "Sprint retrieved");
    } catch (error) {
      logger.error("GetSprintById error:", error);
      sendError(res, "Failed to get sprint");
    }
  },

  // POST /api/sprints
  async createSprint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const sprint = await prisma.sprint.create({
        data: {
          ...data,
          userId,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
        include: {
          project: { select: { id: true, name: true, color: true } },
          _count: { select: { tasks: true } },
        },
      });

      await activityService.log({
        userId,
        type: "SPRINT_CREATED",
        description: `Created sprint: "${sprint.name}"`,
        metadata: { sprintId: sprint.id },
      });

      sendCreated(res, sprint, "Sprint created");
    } catch (error) {
      logger.error("CreateSprint error:", error);
      sendError(res, "Failed to create sprint");
    }
  },

  // PUT /api/sprints/:id
  async updateSprint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const data = req.body;

      const existing = await prisma.sprint.findFirst({ where: { id, userId } });
      if (!existing) {
        sendNotFound(res, "Sprint not found");
        return;
      }

      const sprint = await prisma.sprint.update({
        where: { id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
          endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
        },
        include: {
          project: { select: { id: true, name: true, color: true } },
          _count: { select: { tasks: true } },
        },
      });

      await activityService.log({
        userId,
        type: "SPRINT_UPDATED",
        description: `Updated sprint: "${sprint.name}"`,
      });

      sendSuccess(res, sprint, "Sprint updated");
    } catch (error) {
      logger.error("UpdateSprint error:", error);
      sendError(res, "Failed to update sprint");
    }
  },

  // DELETE /api/sprints/:id
  async deleteSprint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const sprint = await prisma.sprint.findFirst({ where: { id, userId } });
      if (!sprint) {
        sendNotFound(res, "Sprint not found");
        return;
      }

      // Unassign tasks from sprint before deleting
      await prisma.task.updateMany({
        where: { sprintId: id },
        data: { sprintId: null },
      });

      await prisma.sprint.delete({ where: { id } });
      sendSuccess(res, { id }, "Sprint deleted");
    } catch (error) {
      logger.error("DeleteSprint error:", error);
      sendError(res, "Failed to delete sprint");
    }
  },
};
