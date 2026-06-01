import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { aiService } from "../services/ai.service";
import { activityService } from "../services/activity.service";
import { getSocketInstance, emitToProject, emitToUser } from "../socket";

export const aiCommandSchema = z.object({
  command: z.string().min(1, "Command is required").max(1000),
  projectId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
});

export const aiController = {
  // POST /api/ai/command - Main AI command endpoint
  async processCommand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { command, projectId, sprintId } = req.body as {
        command: string;
        projectId?: string;
        sprintId?: string;
      };

      if (!command?.trim()) {
        sendBadRequest(res, "Command is required");
        return;
      }

      // Get context for AI
      const [recentTasks, recentActivities] = await Promise.all([
        prisma.task.findMany({
          where: { userId },
          select: { title: true, status: true, priority: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
        prisma.activity.findMany({
          where: { userId },
          select: { description: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      // Process command with AI
      const aiResult = await aiService.processCommand(command, {
        tasks: recentTasks,
        recentActivities: recentActivities.map((a) => a.description),
      });

      // Store AI command history
      await prisma.aICommand.create({
        data: {
          userId,
          input: command,
          output: aiResult as any,
          actionType: aiResult.type,
        },
      });

      // Log AI command activity
      await activityService.log({
        userId,
        type: "AI_COMMAND",
        description: `AI Command: "${command.substring(0, 80)}${command.length > 80 ? "..." : ""}"`,
        metadata: { actionType: aiResult.type },
      });

      // Execute the action
      const executedResult = await executeAIAction(
        aiResult,
        userId,
        projectId,
        sprintId
      );

      // Emit real-time update
      emitToUser(userId, "ai:action_executed", {
        command,
        result: aiResult,
        executed: executedResult,
      });

      sendSuccess(
        res,
        {
          aiResult,
          executed: executedResult,
          command,
        },
        aiResult.message || "Command processed successfully"
      );
    } catch (error) {
      logger.error("AI processCommand error:", error);
      const message = error instanceof Error ? error.message : "Failed to process AI command";
      sendError(res, message);
    }
  },

  // GET /api/ai/history
  async getCommandHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = parseInt((req.query as Record<string, string>).limit || "20");

      const history = await prisma.aICommand.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          input: true,
          actionType: true,
          createdAt: true,
        },
      });

      sendSuccess(res, history, "AI command history retrieved");
    } catch (error) {
      logger.error("GetCommandHistory error:", error);
      sendError(res, "Failed to get command history");
    }
  },

  // POST /api/ai/summary
  async generateSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [tasks, activities] = await Promise.all([
        prisma.task.findMany({
          where: { userId, createdAt: { gte: today } },
          select: { title: true, status: true, priority: true, createdAt: true },
        }),
        prisma.activity.findMany({
          where: { userId, createdAt: { gte: today } },
          select: { description: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ]);

      const summary = await aiService.generateSummary(tasks, activities);

      sendSuccess(res, { summary, date: today }, "Summary generated");
    } catch (error) {
      logger.error("GenerateSummary error:", error);
      sendError(res, "Failed to generate summary");
    }
  },

  // POST /api/ai/sprint-plan
  async generateSprintPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { goal, durationDays } = req.body as {
        goal: string;
        durationDays?: number;
      };

      if (!goal) {
        sendBadRequest(res, "Sprint goal is required");
        return;
      }

      const plan = await aiService.generateSprintPlan(goal, durationDays || 14);
      sendSuccess(res, plan, "Sprint plan generated");
    } catch (error) {
      logger.error("GenerateSprintPlan error:", error);
      sendError(res, "Failed to generate sprint plan");
    }
  },
};

// Helper function to execute AI actions
async function executeAIAction(
  aiResult: Awaited<ReturnType<typeof aiService.processCommand>>,
  userId: string,
  projectId?: string,
  sprintId?: string
): Promise<Record<string, unknown>> {
  switch (aiResult.type) {
    case "CREATE_TASK":
    case "CREATE_TASKS":
    case "BREAKDOWN_TASK": {
      if (!aiResult.tasks || aiResult.tasks.length === 0) {
        return { created: 0 };
      }

      const createdTasks = await Promise.all(
        aiResult.tasks.map(async (taskData, index) => {
          const taskStatus = (taskData.status as any) || "TODO";
          const maxPos = await prisma.task.findFirst({
            where: { userId, status: taskStatus },
            orderBy: { position: "desc" },
            select: { position: true },
          });

          return prisma.task.create({
            data: {
              title: taskData.title,
              description: taskData.description,
              priority: taskData.priority || "MEDIUM",
              status: taskStatus,
              dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
              labels: taskData.labels || [],
              estimatedHours: taskData.estimatedHours,
              userId,
              ...(projectId && { projectId }),
              ...(sprintId && { sprintId }),
              position: (maxPos?.position ?? -1) + index + 1,
            },
            include: {
              project: { select: { id: true, name: true, color: true } },
            },
          });
        })
      );

      // Log each task creation
      await Promise.all(
        createdTasks.map((task) =>
          activityService.log({
            userId,
            type: "TASK_CREATED",
            description: `AI created task: "${task.title}"`,
            taskId: task.id,
          })
        )
      );

      // Socket: broadcast each created task to project room or user room
      for (const task of createdTasks) {
        if (task.projectId) {
          emitToProject(task.projectId, "task:created", task);
        } else {
          emitToUser(userId, "task:created", task);
        }
      }

      return { created: createdTasks.length, tasks: createdTasks };
    }

    case "CREATE_REMINDER": {
      if (!aiResult.reminder) return { created: 0 };

      const reminder = await prisma.reminder.create({
        data: {
          title: aiResult.reminder.title,
          description: aiResult.reminder.description,
          remindAt: new Date(aiResult.reminder.remindAt),
          userId,
        },
      });

      await activityService.log({
        userId,
        type: "REMINDER_SET",
        description: `AI set reminder: "${reminder.title}"`,
        metadata: { remindAt: reminder.remindAt },
      });

      return { reminder };
    }

    case "CREATE_SPRINT": {
      if (!aiResult.sprint) return { created: false };

      const sprint = await prisma.sprint.create({
        data: {
          name: aiResult.sprint.name,
          goal: aiResult.sprint.goal,
          startDate: aiResult.sprint.startDate
            ? new Date(aiResult.sprint.startDate)
            : undefined,
          endDate: aiResult.sprint.endDate
            ? new Date(aiResult.sprint.endDate)
            : undefined,
          userId,
          ...(projectId && { projectId }),
        },
      });

      // Create sprint tasks if provided
      let tasks: unknown[] = [];
      if (aiResult.sprint.tasks && aiResult.sprint.tasks.length > 0) {
        tasks = await Promise.all(
          aiResult.sprint.tasks.map((taskData, index) =>
            prisma.task.create({
              data: {
                title: taskData.title,
                priority: taskData.priority || "MEDIUM",
                estimatedHours: taskData.estimatedHours,
                userId,
                sprintId: sprint.id,
                ...(projectId && { projectId }),
                position: index,
              },
            })
          )
        );
      }

      await activityService.log({
        userId,
        type: "SPRINT_CREATED",
        description: `AI created sprint: "${sprint.name}"`,
        metadata: { sprintId: sprint.id },
      });

      // Socket: broadcast sprint + its tasks
      if (projectId) {
        emitToProject(projectId, "sprint:created", sprint);
        for (const task of tasks) {
          emitToProject(projectId, "task:created", task);
        }
      } else {
        emitToUser(userId, "sprint:created", sprint);
        for (const task of tasks) {
          emitToUser(userId, "task:created", task);
        }
      }

      return { sprint, tasks, tasksCreated: tasks.length };
    }

    case "SUMMARIZE": {
      return { summary: aiResult.summary };
    }

    case "UPDATE_TASK_STATUS": {
      // Support both taskTitle (single) and taskTitles (multiple)
      const titles = aiResult.taskTitles?.length
        ? aiResult.taskTitles
        : aiResult.taskTitle
        ? [aiResult.taskTitle]
        : [];

      if (!titles.length || !aiResult.newStatus) return { updated: 0 };

      const tasks = await prisma.task.findMany({
        where: {
          userId,
          title: { in: titles, mode: "insensitive" },
        },
        select: { id: true, title: true, projectId: true },
      });

      if (!tasks.length) return { updated: 0, message: "No matching tasks found" };

      const updatedTasks = await Promise.all(
        tasks.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: { status: aiResult.newStatus as any },
            include: { project: { select: { id: true, name: true, color: true } } },
          })
        )
      );

      await Promise.all(
        updatedTasks.map((task) =>
          activityService.log({
            userId,
            type: "TASK_UPDATED",
            description: `AI moved "${task.title}" to ${aiResult.newStatus}`,
            taskId: task.id,
          })
        )
      );

      // Socket
      for (const task of updatedTasks) {
        if (task.projectId) {
          emitToProject(task.projectId, "task:updated", task);
        } else {
          emitToUser(userId, "task:updated", task);
        }
      }

      return { updated: updatedTasks.length, tasks: updatedTasks.map((t) => t.title) };
    }

    case "COMPLETE_TASKS": {
      const titles = aiResult.taskTitles?.length
        ? aiResult.taskTitles
        : aiResult.taskTitle
        ? [aiResult.taskTitle]
        : [];

      if (!titles.length) return { updated: 0 };

      const tasks = await prisma.task.findMany({
        where: { userId, title: { in: titles, mode: "insensitive" } },
        select: { id: true, title: true, projectId: true },
      });

      if (!tasks.length) return { updated: 0, message: "No matching tasks found" };

      const updatedTasks = await Promise.all(
        tasks.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: { status: "DONE" },
            include: { project: { select: { id: true, name: true, color: true } } },
          })
        )
      );

      await Promise.all(
        updatedTasks.map((task) =>
          activityService.log({
            userId,
            type: "TASK_UPDATED",
            description: `AI completed task: "${task.title}"`,
            taskId: task.id,
          })
        )
      );

      // Socket
      for (const task of updatedTasks) {
        if (task.projectId) {
          emitToProject(task.projectId, "task:updated", task);
        } else {
          emitToUser(userId, "task:updated", task);
        }
      }

      return { updated: updatedTasks.length, tasks: updatedTasks.map((t) => t.title) };
    }

    case "DELETE_TASK": {
      const title = aiResult.taskTitle;
      if (!title) return { deleted: 0 };

      const task = await prisma.task.findFirst({
        where: { userId, title: { equals: title, mode: "insensitive" } },
      });

      if (!task) return { deleted: 0, message: `Task "${title}" not found` };

      await prisma.task.delete({ where: { id: task.id } });

      await activityService.log({
        userId,
        type: "TASK_DELETED",
        description: `AI deleted task: "${task.title}"`,
      });

      // Socket
      if (task.projectId) {
        emitToProject(task.projectId, "task:deleted", { id: task.id, projectId: task.projectId });
      } else {
        emitToUser(userId, "task:deleted", { id: task.id });
      }

      return { deleted: 1, task: task.title };
    }

    case "DELETE_TASKS": {
      const titles = aiResult.taskTitles || [];
      if (!titles.length) return { deleted: 0 };

      const tasks = await prisma.task.findMany({
        where: { userId, title: { in: titles, mode: "insensitive" } },
      });

      if (!tasks.length) return { deleted: 0, message: "No matching tasks found" };

      await prisma.task.deleteMany({
        where: { id: { in: tasks.map((t) => t.id) } },
      });

      await Promise.all(
        tasks.map((task) =>
          activityService.log({
            userId,
            type: "TASK_DELETED",
            description: `AI deleted task: "${task.title}"`,
          })
        )
      );

      // Socket
      for (const task of tasks) {
        if (task.projectId) {
          emitToProject(task.projectId, "task:deleted", { id: task.id, projectId: task.projectId });
        } else {
          emitToUser(userId, "task:deleted", { id: task.id });
        }
      }

      return { deleted: tasks.length, tasks: tasks.map((t) => t.title) };
    }

    case "UPDATE_TASK": {
      const title = aiResult.taskTitle;
      if (!title || !aiResult.updates) return { updated: 0 };

      const task = await prisma.task.findFirst({
        where: { userId, title: { equals: title, mode: "insensitive" } },
      });

      if (!task) return { updated: 0, message: `Task "${title}" not found` };

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          ...(aiResult.updates.priority && { priority: aiResult.updates.priority as any }),
          ...(aiResult.updates.dueDate && { dueDate: new Date(aiResult.updates.dueDate) }),
          ...(aiResult.updates.labels && { labels: aiResult.updates.labels }),
          ...(aiResult.updates.description && { description: aiResult.updates.description }),
          ...(aiResult.updates.estimatedHours && { estimatedHours: aiResult.updates.estimatedHours }),
        },
        include: { project: { select: { id: true, name: true, color: true } } },
      });

      await activityService.log({
        userId,
        type: "TASK_UPDATED",
        description: `AI updated task: "${updated.title}"`,
        taskId: updated.id,
        metadata: aiResult.updates as Record<string, unknown>,
      });

      // Socket
      if (updated.projectId) {
        emitToProject(updated.projectId, "task:updated", updated);
      } else {
        emitToUser(userId, "task:updated", updated);
      }

      return { updated: 1, task: updated.title };
    }

    case "MOVE_TASKS_TO_SPRINT": {
      const titles = aiResult.taskTitles || [];
      const sprintName = aiResult.sprintName;
      if (!titles.length || !sprintName) return { moved: 0 };

      const sprint = await prisma.sprint.findFirst({
        where: { userId, name: { contains: sprintName, mode: "insensitive" } },
      });

      if (!sprint) return { moved: 0, message: `Sprint "${sprintName}" not found` };

      const tasks = await prisma.task.findMany({
        where: { userId, title: { in: titles, mode: "insensitive" } },
      });

      if (!tasks.length) return { moved: 0, message: "No matching tasks found" };

      await prisma.task.updateMany({
        where: { id: { in: tasks.map((t) => t.id) } },
        data: { sprintId: sprint.id },
      });

      await activityService.log({
        userId,
        type: "TASK_UPDATED",
        description: `AI moved ${tasks.length} task(s) to sprint "${sprint.name}"`,
        metadata: { sprintId: sprint.id, taskCount: tasks.length },
      });

      // Socket — emit task:updated for each moved task
      for (const task of tasks) {
        const payload = { ...task, sprintId: sprint.id };
        if (task.projectId) {
          emitToProject(task.projectId, "task:updated", payload);
        } else {
          emitToUser(userId, "task:updated", payload);
        }
      }

      return { moved: tasks.length, sprint: sprint.name, tasks: tasks.map((t) => t.title) };
    }

    default:
      return { type: aiResult.type, message: aiResult.message };
  }
}
