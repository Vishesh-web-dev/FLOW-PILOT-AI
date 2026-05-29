import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendBadRequest,
} from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";
import { emitToProject } from "../socket";

// Shared task include — keeps all queries consistent
const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  sprint: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, avatar: true } },
  subtasks: { select: { id: true, title: true, status: true, priority: true } },
  _count: { select: { subtasks: true } },
} as const;


// Zod Schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.string().optional()),
  labels: z.array(z.string()).optional(),
  estimatedHours: z.number().positive().optional(),
  projectId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  position: z.number().int().optional(),
});

export const taskController = {
  // GET /api/tasks
  async getAllTasks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, priority, projectId, sprintId, search } = req.query as Record<string, string>;

      // Get project IDs the user is a member of
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      const tasks = await prisma.task.findMany({
        where: {
          parentId: null,
          OR: [
            { userId },                          // tasks the user created
            { assigneeId: userId },              // tasks assigned to the user
            { projectId: { in: memberProjectIds } }, // tasks in projects user belongs to
          ],
          ...(status && { status: status as any }),
          ...(priority && { priority: priority as any }),
          ...(projectId && { projectId }),
          ...(sprintId && { sprintId }),
          ...(search && {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }),
        },
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: taskInclude,
      });

      sendSuccess(res, tasks, "Tasks retrieved successfully");
    } catch (error) {
      logger.error("GetAllTasks error:", error);
      sendError(res, "Failed to retrieve tasks");
    }
  },

  // GET /api/tasks/:id
  async getTaskById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const task = await prisma.task.findFirst({
        where: { id, userId },
        include: {
          project: { select: { id: true, name: true, color: true } },
          sprint: { select: { id: true, name: true } },
          parent: { select: { id: true, title: true } },
          subtasks: {
            orderBy: { position: "asc" },
            include: { _count: { select: { subtasks: true } } },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      });

      if (!task) {
        sendNotFound(res, "Task not found");
        return;
      }

      sendSuccess(res, task, "Task retrieved");
    } catch (error) {
      logger.error("GetTaskById error:", error);
      sendError(res, "Failed to get task");
    }
  },

  // POST /api/tasks
  async createTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      // Get max position for the status column
      const maxPositionTask = await prisma.task.findFirst({
        where: { userId, status: data.status || "TODO" },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      const task = await prisma.task.create({
        data: {
          ...data,
          userId,
          position: (maxPositionTask?.position ?? -1) + 1,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
        include: taskInclude,
      });

      // Real-time: notify all project members
      if (task.projectId) {
        emitToProject(task.projectId, "task:created", task);
      }

      await activityService.log({
        userId,
        type: "TASK_CREATED",
        description: `Created task: "${task.title}"`,
        taskId: task.id,
        metadata: { priority: task.priority, status: task.status },
      });

      sendCreated(res, task, "Task created successfully");
    } catch (error) {
      logger.error("CreateTask error:", error);
      sendError(res, "Failed to create task");
    }
  },

  // PUT /api/tasks/:id
  async updateTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const data = req.body;

      const existingTask = await prisma.task.findFirst({ where: { id, userId } });
      if (!existingTask) {
        sendNotFound(res, "Task not found");
        return;
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : existingTask.dueDate,
        },
        include: taskInclude,
      });

      // Real-time: notify all project members
      if (task.projectId) {
        emitToProject(task.projectId, "task:updated", task);
      }
      // Also notify assignee if changed
      if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
        // emitToUser is imported via socket — notify new assignee
        const { emitToUser } = await import("../socket");
        emitToUser(data.assigneeId, "task:assigned_to_you", task);
      }

      // Log activity
      const changedFields: string[] = [];
      if (data.status && data.status !== existingTask.status) {
        changedFields.push(`status: ${existingTask.status} → ${data.status}`);
      }
      if (data.priority && data.priority !== existingTask.priority) {
        changedFields.push(`priority: ${existingTask.priority} → ${data.priority}`);
      }

      const description =
        changedFields.length > 0
          ? `Updated task "${task.title}": ${changedFields.join(", ")}`
          : `Updated task: "${task.title}"`;

      await activityService.log({
        userId,
        type: data.status && data.status !== existingTask.status ? "TASK_MOVED" : "TASK_UPDATED",
        description,
        taskId: task.id,
      });

      sendSuccess(res, task, "Task updated successfully");
    } catch (error) {
      logger.error("UpdateTask error:", error);
      sendError(res, "Failed to update task");
    }
  },

  // DELETE /api/tasks/:id
  async deleteTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const task = await prisma.task.findFirst({ where: { id, userId } });
      if (!task) {
        sendNotFound(res, "Task not found");
        return;
      }

      await prisma.task.delete({ where: { id } });

      // Real-time: notify project members
      if (task.projectId) {
        emitToProject(task.projectId, "task:deleted", { id, projectId: task.projectId });
      }

      await activityService.log({
        userId,
        type: "TASK_DELETED",
        description: `Deleted task: "${task.title}"`,
      });

      sendSuccess(res, { id }, "Task deleted successfully");
    } catch (error) {
      logger.error("DeleteTask error:", error);
      sendError(res, "Failed to delete task");
    }
  },

  // PATCH /api/tasks/reorder - Batch reorder tasks (for drag-drop)
  async reorderTasks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tasks } = req.body as {
        tasks: Array<{ id: string; status: string; position: number }>;
      };

      if (!Array.isArray(tasks)) {
        sendBadRequest(res, "tasks must be an array");
        return;
      }

      // Batch update in transaction
      await prisma.$transaction(
        tasks.map(({ id, status, position }) =>
          prisma.task.updateMany({
            where: { id, userId },
            data: { status: status as any, position },
          })
        )
      );

      sendSuccess(res, { updated: tasks.length }, "Tasks reordered");
    } catch (error) {
      logger.error("ReorderTasks error:", error);
      sendError(res, "Failed to reorder tasks");
    }
  },

  // GET /api/tasks/stats
  async getTaskStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const [total, byStatus, byPriority, dueSoon, completedThisWeek] = await Promise.all([
        prisma.task.count({ where: { userId } }),
        prisma.task.groupBy({
          by: ["status"],
          where: { userId },
          _count: true,
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: { userId },
          _count: true,
        }),
        prisma.task.count({
          where: {
            userId,
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // next 3 days
            },
            status: { not: "DONE" },
          },
        }),
        prisma.task.count({
          where: {
            userId,
            status: "DONE",
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      sendSuccess(
        res,
        { total, byStatus, byPriority, dueSoon, completedThisWeek },
        "Task stats retrieved"
      );
    } catch (error) {
      logger.error("GetTaskStats error:", error);
      sendError(res, "Failed to get task stats");
    }
  },
};
