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
  // Query: ?days=30  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD  (both accept &tz=IANA_timezone)
  async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const existing = await prisma.schedule.findFirst({
        where: { id, userId },
        include: { items: true },
      });
      if (!existing) { sendNotFound(res, "Schedule not found"); return; }

      // User's local timezone (for "today" computation and DOW labeling)
      const tz = (req.query.tz as string) || "UTC";

      // ── Date range resolution ─────────────────────────────────────────────
      // All date keys are UTC midnight strings (YYYY-MM-DD) matching how logs
      // are stored: frontend sends the local date string, backend stores as UTC midnight.
      let fromStr: string;
      let toStr: string;

      if (req.query.from && req.query.to) {
        fromStr = req.query.from as string;  // e.g. "2026-06-01"
        toStr   = req.query.to   as string;  // e.g. "2026-06-04"
      } else {
        // Compute "today" in the user's timezone so the date is correct regardless
        // of server timezone or UTC offset
        const now = new Date();
        toStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD
        const dayCount = parseInt((req.query.days as string) || "30", 10);
        // Subtract (dayCount - 1) UTC days from today's midnight
        const fromDate = new Date(toStr + "T00:00:00.000Z");
        fromDate.setUTCDate(fromDate.getUTCDate() - dayCount + 1);
        fromStr = fromDate.toISOString().split("T")[0];
      }

      // Exact day count using UTC midnight-to-midnight (no floating point error)
      const fromMidnight = new Date(fromStr + "T00:00:00.000Z");
      const toMidnight   = new Date(toStr   + "T00:00:00.000Z");
      const days = Math.round((toMidnight.getTime() - fromMidnight.getTime()) / 86400000) + 1;

      const from = fromMidnight;
      const to   = new Date(toStr + "T23:59:59.999Z");

      // ── Fetch logs ────────────────────────────────────────────────────────
      const logs = await prisma.scheduleLog.findMany({
        where: { scheduleId: id, date: { gte: from, lte: to } },
        include: { scheduleItem: true },
        orderBy: { date: "asc" },
      });

      // ── Build daily map (UTC date keys) ───────────────────────────────────
      const dailyMap: Record<string, { total: number; done: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(fromStr + "T00:00:00.000Z");
        d.setUTCDate(d.getUTCDate() + i);
        dailyMap[d.toISOString().split("T")[0]] = { total: existing.items.length, done: 0 };
      }
      for (const log of logs) {
        const key = (log.date as Date).toISOString().split("T")[0];
        if (dailyMap[key] && log.isDone) dailyMap[key].done++;
      }

      const dailyStats = Object.entries(dailyMap)
        .map(([date, v]) => ({
          date, total: v.total, done: v.done,
          rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // ── Per-item stats: totalDays from item's first completion → toStr ────
      const itemStats = existing.items.map((item) => {
        const doneLogs = logs
          .filter((l) => l.scheduleItemId === item.id && l.isDone)
          .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());

        if (doneLogs.length === 0) {
          return { id: item.id, title: item.title, category: item.category, totalDays: 0, doneDays: 0, rate: 0 };
        }

        const firstDoneStr  = (doneLogs[0].date as Date).toISOString().split("T")[0];
        const firstMidnight = new Date(firstDoneStr + "T00:00:00.000Z");
        // Both are UTC midnight strings → exact integer day difference
        const itemTotalDays = Math.max(1, Math.round((toMidnight.getTime() - firstMidnight.getTime()) / 86400000) + 1);

        return {
          id: item.id,
          title: item.title,
          category: item.category,
          totalDays: itemTotalDays,
          doneDays: doneLogs.length,
          rate: Math.round((doneLogs.length / itemTotalDays) * 100),
        };
      });

      const totalExpected = existing.items.length * days;
      const totalDone = logs.filter((l) => l.isDone).length;

      // ── Streaks ───────────────────────────────────────────────────────────
      let longestStreak = 0, tempStreak = 0;
      for (const d of dailyStats) {
        if (d.total > 0 && d.done === d.total) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
        else if (d.total > 0) tempStreak = 0;
      }

      // Current streak: count back from the last day; if today is not yet fully
      // complete, skip it (allow the streak to survive until end-of-day)
      let currentStreak = 0;
      const sortedDesc = [...dailyStats].reverse();
      let startIdx = 0;
      if (sortedDesc.length > 0 && sortedDesc[0].date === toStr && sortedDesc[0].done < sortedDesc[0].total) {
        startIdx = 1; // Today not fully done yet — start from yesterday
      }
      for (let i = startIdx; i < sortedDesc.length; i++) {
        const d = sortedDesc[i];
        if (d.total > 0 && d.done === d.total) currentStreak++;
        else if (d.total > 0) break;
      }

      // ── Day-of-week breakdown (UTC weekday so it matches stored UTC dates) ─
      const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dowMap: Record<string, { done: number; total: number }> = {};
      DOW.forEach((n) => { dowMap[n] = { done: 0, total: 0 }; });
      for (const d of dailyStats) {
        if (d.total === 0) continue;
        // UTC noon → stable UTC weekday regardless of server locale
        const name = DOW[new Date(d.date + "T12:00:00.000Z").getUTCDay()];
        dowMap[name].done += d.done;
        dowMap[name].total += d.total;
      }
      const dowStats = DOW.map((name) => ({
        name,
        done: dowMap[name].done,
        total: dowMap[name].total,
        rate: dowMap[name].total > 0 ? Math.round((dowMap[name].done / dowMap[name].total) * 100) : 0,
      }));

      sendSuccess(res, {
        overallRate: totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0,
        totalExpected, totalDone, days,
        from: fromStr, to: toStr,
        currentStreak, longestStreak,
        dailyStats, itemStats, dowStats,
      }, "Analytics retrieved");
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
