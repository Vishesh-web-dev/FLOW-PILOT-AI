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
import { emitToProject, emitToUser } from "../socket";

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

      // User can view task if they own it, are assigned to it, or are a member of its project
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      const task = await prisma.task.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { assigneeId: userId },
            { projectId: { in: memberProjectIds } },
          ],
        },
        include: {
          project: { select: { id: true, name: true, color: true } },
          sprint: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, avatar: true } },
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

      // Real-time: notify project members OR the task creator directly
      if (task.projectId) {
        emitToProject(task.projectId, "task:created", task);
      } else {
        emitToUser(userId, "task:created", task);
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

      // Get projects the user is a member of
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      // User can update task if they own it, are assigned to it, or are a project member
      const existingTask = await prisma.task.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { assigneeId: userId },
            { projectId: { in: memberProjectIds } },
          ],
        },
      });
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

      // Real-time: notify project members OR the task creator directly
      if (task.projectId) {
        emitToProject(task.projectId, "task:updated", task);
      } else {
        emitToUser(existingTask.userId, "task:updated", task);
      }
      // Also notify assignee if changed
      if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
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

      // Get projects the user is a member of
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      // Only owner or project ADMIN/OWNER can delete
      const task = await prisma.task.findFirst({
        where: {
          id,
          OR: [
            { userId },                                   // task creator can always delete
            { projectId: { in: memberProjectIds } },     // project members (role check below)
          ],
        },
      });
      if (!task) {
        sendNotFound(res, "Task not found");
        return;
      }

      // If not the creator, only ADMIN/OWNER of the project can delete
      if (task.userId !== userId && task.projectId) {
        const membership = await prisma.projectMember.findUnique({
          where: { userId_projectId: { userId, projectId: task.projectId } },
        });
        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          sendNotFound(res, "Task not found"); // intentionally vague
          return;
        }
      }

      await prisma.task.delete({ where: { id } });

      // Real-time: notify project members OR the task creator directly
      if (task.projectId) {
        emitToProject(task.projectId, "task:deleted", { id, projectId: task.projectId });
      } else {
        emitToUser(task.userId, "task:deleted", { id });
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

      // Get projects user is a member of so they can reorder shared tasks
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      // Batch update — allow reorder if user owns OR is a project member
      await prisma.$transaction(
        tasks.map(({ id, status, position }) =>
          prisma.task.updateMany({
            where: {
              id,
              OR: [
                { userId },
                { projectId: { in: memberProjectIds } },
              ],
            },
            data: { status: status as any, position },
          })
        )
      );

      // Emit reorder to all affected project rooms
      const affectedProjectIds = new Set<string>();
      const updatedTasks = await prisma.task.findMany({
        where: { id: { in: tasks.map((t) => t.id) } },
        select: { id: true, projectId: true, status: true, position: true },
      });
      updatedTasks.forEach((t) => { if (t.projectId) affectedProjectIds.add(t.projectId); });
      affectedProjectIds.forEach((projectId) => {
        emitToProject(projectId, "tasks:reordered", tasks);
      });

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

      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const memberProjectIds = memberships.map((m) => m.projectId);

      const taskWhere = {
        OR: [
          { userId },
          { assigneeId: userId },
          { projectId: { in: memberProjectIds } },
        ],
      };

      const [total, byStatus, byPriority, dueSoon, completedThisWeek] = await Promise.all([
        prisma.task.count({ where: taskWhere }),
        prisma.task.groupBy({
          by: ["status"],
          where: taskWhere,
          _count: true,
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: taskWhere,
          _count: true,
        }),
        prisma.task.count({
          where: {
            ...taskWhere,
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
            status: { not: "DONE" },
          },
        }),
        prisma.task.count({
          where: {
            ...taskWhere,
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
