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

export const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  remindAt: z.string().datetime({ offset: true }),
});

export const reminderController = {
  // GET /api/reminders
  async getAllReminders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { completed } = req.query as Record<string, string>;

      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          ...(completed !== undefined && { isCompleted: completed === "true" }),
        },
        orderBy: { remindAt: "asc" },
      });

      sendSuccess(res, reminders, "Reminders retrieved");
    } catch (error) {
      logger.error("GetAllReminders error:", error);
      sendError(res, "Failed to get reminders");
    }
  },

  // POST /api/reminders
  async createReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const reminder = await prisma.reminder.create({
        data: {
          ...data,
          userId,
          remindAt: new Date(data.remindAt),
        },
      });

      await activityService.log({
        userId,
        type: "REMINDER_SET",
        description: `Set reminder: "${reminder.title}"`,
        metadata: { remindAt: reminder.remindAt },
      });

      sendCreated(res, reminder, "Reminder created");
    } catch (error) {
      logger.error("CreateReminder error:", error);
      sendError(res, "Failed to create reminder");
    }
  },

  // PUT /api/reminders/:id
  async updateReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) {
        sendNotFound(res, "Reminder not found");
        return;
      }

      const data = req.body;
      const reminder = await prisma.reminder.update({
        where: { id },
        data: {
          ...data,
          remindAt: data.remindAt ? new Date(data.remindAt) : existing.remindAt,
        },
      });

      sendSuccess(res, reminder, "Reminder updated");
    } catch (error) {
      logger.error("UpdateReminder error:", error);
      sendError(res, "Failed to update reminder");
    }
  },

  // PATCH /api/reminders/:id/complete
  async completeReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) {
        sendNotFound(res, "Reminder not found");
        return;
      }

      const reminder = await prisma.reminder.update({
        where: { id },
        data: { isCompleted: true },
      });

      sendSuccess(res, reminder, "Reminder marked as completed");
    } catch (error) {
      logger.error("CompleteReminder error:", error);
      sendError(res, "Failed to complete reminder");
    }
  },

  // DELETE /api/reminders/:id
  async deleteReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) {
        sendNotFound(res, "Reminder not found");
        return;
      }

      await prisma.reminder.delete({ where: { id } });
      sendSuccess(res, { id }, "Reminder deleted");
    } catch (error) {
      logger.error("DeleteReminder error:", error);
      sendError(res, "Failed to delete reminder");
    }
  },
};
