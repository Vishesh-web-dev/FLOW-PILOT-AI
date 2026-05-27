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

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const projectController = {
  // GET /api/projects
  async getAllProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const projects = await prisma.project.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { tasks: true, sprints: true },
          },
        },
      });

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

      const project = await prisma.project.findFirst({
        where: { id, userId },
        include: {
          tasks: {
            where: { parentId: null },
            orderBy: [{ position: "asc" }, { createdAt: "desc" }],
            include: {
              subtasks: { select: { id: true, title: true, status: true } },
              _count: { select: { subtasks: true } },
            },
          },
          sprints: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { tasks: true } } },
          },
          _count: { select: { tasks: true, sprints: true } },
        },
      });

      if (!project) {
        sendNotFound(res, "Project not found");
        return;
      }

      sendSuccess(res, project, "Project retrieved");
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
        data: { ...data, userId },
        include: { _count: { select: { tasks: true, sprints: true } } },
      });

      await activityService.log({
        userId,
        type: "PROJECT_CREATED",
        description: `Created project: "${project.name}"`,
        metadata: { projectId: project.id },
      });

      sendCreated(res, project, "Project created");
    } catch (error) {
      logger.error("CreateProject error:", error);
      sendError(res, "Failed to create project");
    }
  },

  // PUT /api/projects/:id
  async updateProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const existing = await prisma.project.findFirst({ where: { id, userId } });
      if (!existing) {
        sendNotFound(res, "Project not found");
        return;
      }

      const project = await prisma.project.update({
        where: { id },
        data: req.body,
        include: { _count: { select: { tasks: true, sprints: true } } },
      });

      sendSuccess(res, project, "Project updated");
    } catch (error) {
      logger.error("UpdateProject error:", error);
      sendError(res, "Failed to update project");
    }
  },

  // DELETE /api/projects/:id
  async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) {
        sendNotFound(res, "Project not found");
        return;
      }

      await prisma.project.delete({ where: { id } });
      sendSuccess(res, { id }, "Project deleted");
    } catch (error) {
      logger.error("DeleteProject error:", error);
      sendError(res, "Failed to delete project");
    }
  },
};
