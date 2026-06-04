import { Response } from "express";
import { prisma } from "../config/database";
import { AuthRequest } from "../types";
import { sendSuccess, sendCreated, sendError, sendNotFound } from "../utils/response";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";
import { scheduleAIService } from "../services/schedule.ai.service";

export const scheduleController = {
  // ── GET /api/schedules ──────────────────────────────────────────────────────
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const schedules = await prisma.schedule.findMany({
        where: { userId },
        include: {
          items: { orderBy: { order: "asc" } },
          _count: { select: { items: true, logs: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      sendSuccess(res, schedules, "Schedules retrieved");
    } catch (error) {
      logger.error("GetSchedules error:", error);
      sendError(res, "Failed to get schedules");
    }
  },

  // ── GET /api/schedules/:id ──────────────────────────────────────────────────
  async getOne(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const schedule = await prisma.schedule.findFirst({
        where: { id, userId },
        include: { items: { orderBy: { order: "asc" } } },
      });
      if (!schedule) { sendNotFound(res, "Schedule not found"); return; }
      sendSuccess(res, schedule, "Schedule retrieved");
    } catch (error) {
      logger.error("GetSchedule error:", error);
      sendError(res, "Failed to get schedule");
    }
  },

  // ── POST /api/schedules ─────────────────────────────────────────────────────
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, description, type, items } = req.body as {
        name: string;
        description?: string;
        type?: "DAILY" | "WEEKLY" | "MONTHLY";
        items?: Array<{ title: string; description?: string; timeOfDay?: string; category?: string; order?: number }>;
      };

      const schedule = await prisma.schedule.create({
        data: {
          name,
          description,
          type: type ?? "DAILY",
          userId,
          items: items?.length
            ? {
                create: items.map((item, idx) => ({
                  title: item.title,
                  description: item.description,
                  timeOfDay: item.timeOfDay,
                  category: item.category,
                  order: item.order ?? idx,
                })),
              }
            : undefined,
        },
        include: { items: { orderBy: { order: "asc" } } },
      });

      await activityService.log({
        userId,
        type: "SCHEDULE_CREATED",
        description: `Created schedule: "${name}"`,
        metadata: { scheduleId: schedule.id, itemCount: schedule.items.length },
      });

      sendCreated(res, schedule, "Schedule created");
    } catch (error) {
      logger.error("CreateSchedule error:", error);
      sendError(res, "Failed to create schedule");
    }
  },

  // ── PUT /api/schedules/:id ──────────────────────────────────────────────────
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name, description, type, isActive } = req.body;

      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const schedule = await prisma.schedule.update({
        where: { id },
        data: { name, description, type, isActive },
        include: { items: { orderBy: { order: "asc" } } },
      });

      await activityService.log({
        userId,
        type: "SCHEDULE_UPDATED",
        description: `Updated schedule: "${schedule.name}"`,
        metadata: { scheduleId: id },
      });

      sendSuccess(res, schedule, "Schedule updated");
    } catch (error) {
      logger.error("UpdateSchedule error:", error);
      sendError(res, "Failed to update schedule");
    }
  },

  // ── DELETE /api/schedules/:id ───────────────────────────────────────────────
  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }
      await prisma.schedule.delete({ where: { id } });
      sendSuccess(res, null, "Schedule deleted");
    } catch (error) {
      logger.error("DeleteSchedule error:", error);
      sendError(res, "Failed to delete schedule");
    }
  },

  // ── POST /api/schedules/:id/items ───────────────────────────────────────────
  async addItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const { title, description, timeOfDay, category, order } = req.body;
      const maxOrder = await prisma.scheduleItem.aggregate({
        where: { scheduleId: id },
        _max: { order: true },
      });

      const item = await prisma.scheduleItem.create({
        data: {
          title,
          description,
          timeOfDay,
          category,
          order: order ?? (maxOrder._max.order ?? -1) + 1,
          scheduleId: id,
        },
      });
      sendCreated(res, item, "Item added");
    } catch (error) {
      logger.error("AddScheduleItem error:", error);
      sendError(res, "Failed to add item");
    }
  },

  // ── PUT /api/schedules/:id/items/:itemId ────────────────────────────────────
  async updateItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id, itemId } = req.params;
      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const { title, description, timeOfDay, category, order } = req.body;
      const item = await prisma.scheduleItem.update({
        where: { id: itemId },
        data: { title, description, timeOfDay, category, order },
      });
      sendSuccess(res, item, "Item updated");
    } catch (error) {
      logger.error("UpdateScheduleItem error:", error);
      sendError(res, "Failed to update item");
    }
  },

  // ── DELETE /api/schedules/:id/items/:itemId ─────────────────────────────────
  async deleteItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id, itemId } = req.params;
      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }
      await prisma.scheduleItem.delete({ where: { id: itemId } });
      sendSuccess(res, null, "Item deleted");
    } catch (error) {
      logger.error("DeleteScheduleItem error:", error);
      sendError(res, "Failed to delete item");
    }
  },

  // ── GET /api/schedules/:id/logs?date=YYYY-MM-DD ─────────────────────────────
  async getLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const date = new Date(dateStr);

      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const logs = await prisma.scheduleLog.findMany({
        where: { scheduleId: id, date },
        include: { scheduleItem: true },
      });
      sendSuccess(res, logs, "Logs retrieved");
    } catch (error) {
      logger.error("GetScheduleLogs error:", error);
      sendError(res, "Failed to get logs");
    }
  },

  // ── POST /api/schedules/:id/logs/toggle ─────────────────────────────────────
  // Body: { itemId, date, isDone }
  async toggleLog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { itemId, date: dateStr, isDone } = req.body as {
        itemId: string;
        date: string;
        isDone: boolean;
      };

      const existing = await prisma.schedule.findFirst({ where: { id, userId } });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const date = new Date(dateStr);
      const log = await prisma.scheduleLog.upsert({
        where: { scheduleItemId_date: { scheduleItemId: itemId, date } },
        create: { scheduleId: id, scheduleItemId: itemId, date, isDone },
        update: { isDone },
        include: { scheduleItem: true },
      });

      if (isDone) {
        await activityService.log({
          userId,
          type: "SCHEDULE_CHECKED",
          description: `Completed "${log.scheduleItem.title}" in schedule "${existing.name}"`,
          metadata: { scheduleId: id, itemId, date: dateStr },
        });
      }

      sendSuccess(res, log, "Log toggled");
    } catch (error) {
      logger.error("ToggleScheduleLog error:", error);
      sendError(res, "Failed to toggle log");
    }
  },

  // ── GET /api/schedules/:id/analytics ────────────────────────────────────────
  // Query: ?days=30
  async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const days = parseInt((req.query.days as string) || "30", 10);

      const existing = await prisma.schedule.findFirst({
        where: { id, userId },
        include: { items: true },
      });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      from.setHours(0, 0, 0, 0);

      const logs = await prisma.scheduleLog.findMany({
        where: { scheduleId: id, date: { gte: from } },
        include: { scheduleItem: true },
        orderBy: { date: "asc" },
      });

      // Build daily summary
      const dailyMap: Record<string, { total: number; done: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = { total: existing.items.length, done: 0 };
      }
      for (const log of logs) {
        const key = (log.date as Date).toISOString().split("T")[0];
        if (dailyMap[key] && log.isDone) dailyMap[key].done++;
      }

      const dailyStats = Object.entries(dailyMap).map(([date, v]) => ({
        date,
        total: v.total,
        done: v.done,
        rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      }));

      // Per-item completion rate
      const itemStats = existing.items.map((item) => {
        const itemLogs = logs.filter((l) => l.scheduleItemId === item.id);
        const done = itemLogs.filter((l) => l.isDone).length;
        return {
          id: item.id,
          title: item.title,
          category: item.category,
          totalDays: days,
          doneDays: done,
          rate: Math.round((done / days) * 100),
        };
      });

      const totalExpected = existing.items.length * days;
      const totalDone = logs.filter((l) => l.isDone).length;

      sendSuccess(
        res,
        {
          overallRate: totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0,
          totalExpected,
          totalDone,
          days,
          dailyStats,
          itemStats,
        },
        "Analytics retrieved"
      );
    } catch (error) {
      logger.error("GetAnalytics error:", error);
      sendError(res, "Failed to get analytics");
    }
  },

  // ── POST /api/schedules/ai-generate ─────────────────────────────────────────
  async aiGenerate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { prompt } = req.body as { prompt: string };
      if (!prompt) { sendError(res, "Prompt is required"); return; }

      const result = await scheduleAIService.generate(prompt);

      // Auto-create the schedule in DB
      const schedule = await prisma.schedule.create({
        data: {
          name: result.name,
          description: result.description,
          type: result.type ?? "DAILY",
          userId,
          items: {
            create: result.items.map((item, idx) => ({
              title: item.title,
              description: item.description,
              timeOfDay: item.timeOfDay,
              category: item.category,
              order: idx,
            })),
          },
        },
        include: { items: { orderBy: { order: "asc" } } },
      });

      await activityService.log({
        userId,
        type: "SCHEDULE_CREATED",
        description: `AI generated schedule: "${schedule.name}"`,
        metadata: { scheduleId: schedule.id, prompt },
      });

      sendCreated(res, schedule, "AI schedule generated");
    } catch (error) {
      logger.error("AIGenerateSchedule error:", error);
      sendError(res, (error as Error).message || "Failed to generate schedule");
    }
  },
};
