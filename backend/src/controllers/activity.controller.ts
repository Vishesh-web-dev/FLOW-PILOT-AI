import { Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";

export const activityController = {
  // GET /api/activities
  async getActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = parseInt((req.query as Record<string, string>).limit || "50");
      const page = parseInt((req.query as Record<string, string>).page || "1");
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        prisma.activity.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
          include: {
            task: {
              select: { id: true, title: true, status: true, priority: true },
            },
            user: { select: { id: true, name: true, avatar: true } },
          },
        }),
        prisma.activity.count({ where: { userId } }),
      ]);

      sendSuccess(res, activities, "Activities retrieved", 200, {
        total,
        page,
        limit,
      });
    } catch (error) {
      logger.error("GetActivities error:", error);
      sendError(res, "Failed to get activities");
    }
  },

  // GET /api/activities/summary
  async getDailySummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayActivities, tasksCreated, tasksCompleted, remindersSet] =
        await Promise.all([
          prisma.activity.findMany({
            where: { userId, createdAt: { gte: today } },
            orderBy: { createdAt: "desc" },
            include: {
              task: { select: { id: true, title: true } },
            },
          }),
          prisma.task.count({
            where: { userId, createdAt: { gte: today } },
          }),
          prisma.task.count({
            where: { userId, status: "DONE", updatedAt: { gte: today } },
          }),
          prisma.reminder.count({
            where: { userId, createdAt: { gte: today } },
          }),
        ]);

      sendSuccess(
        res,
        {
          date: today,
          summary: {
            totalActivities: todayActivities.length,
            tasksCreated,
            tasksCompleted,
            remindersSet,
          },
          activities: todayActivities,
        },
        "Daily summary retrieved"
      );
    } catch (error) {
      logger.error("GetDailySummary error:", error);
      sendError(res, "Failed to get daily summary");
    }
  },
};
