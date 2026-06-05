import cron from "node-cron";
import { prisma } from "../config/database";
import { logger } from "../utils/logger";
import { emitToUser } from "../socket";
import { env } from "../config/env";
import nodemailer from "nodemailer";

export const startReminderJob = (): void => {
  // Check reminders every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

      // Find upcoming reminders (due in the next minute)
      const dueReminders = await prisma.reminder.findMany({
        where: {
          isCompleted: false,
          remindAt: {
            gte: now,
            lte: oneMinuteLater,
          },
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      if (dueReminders.length > 0) {
        logger.info(`Processing ${dueReminders.length} due reminders`);

        for (const reminder of dueReminders) {
          // Emit reminder notification to user via socket
          emitToUser(reminder.userId, "reminder:due", {
            id: reminder.id,
            title: reminder.title,
            description: reminder.description,
            remindAt: reminder.remindAt,
          });

          // Mark as completed so it doesn't fire again next minute
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { isCompleted: true },
          });

          logger.info(`Reminder triggered: "${reminder.title}" for user ${reminder.userId}`);
        }
      }
    } catch (error) {
      logger.error("Reminder job error:", error);
    }
  });

  // Daily cleanup: Mark very old incomplete reminders (optional)
  cron.schedule("0 0 * * *", async () => {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      const result = await prisma.reminder.updateMany({
        where: {
          isCompleted: false,
          remindAt: { lt: threeDaysAgo },
        },
        data: { isCompleted: true },
      });

      if (result.count > 0) {
        logger.info(`Auto-completed ${result.count} old reminders`);
      }
    } catch (error) {
      logger.error("Daily reminder cleanup error:", error);
    }
  });

  // ── Auto-deactivate schedules whose endDate has passed ──────────────────────
  cron.schedule("5 0 * * *", async () => {
    try {
      // "Today" as UTC midnight — any endDate strictly before today has expired
      const todayMidnight = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

      const deactivated = await prisma.schedule.updateMany({
        where: {
          isActive: true,
          endDate: { lt: todayMidnight },
        },
        data: { isActive: false },
      });

      if (deactivated.count > 0) {
        logger.info(`Auto-deactivated ${deactivated.count} expired schedule(s)`);
      }
    } catch (error) {
      logger.error("Schedule auto-deactivation job error:", error);
    }
  });

  // ── Auto-activate schedules whose startDate is reached today ─────────────────
  cron.schedule("10 0 * * *", async () => {
    try {
      // Match schedules whose startDate is exactly today (UTC midnight)
      const todayMidnight = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

      const activated = await prisma.schedule.updateMany({
        where: {
          isActive: false,
          startDate: { equals: todayMidnight },
          // Only activate if endDate hasn't also passed
          OR: [{ endDate: null }, { endDate: { gte: todayMidnight } }],
        },
        data: { isActive: true },
      });

      if (activated.count > 0) {
        logger.info(`Auto-activated ${activated.count} schedule(s) whose startDate is today`);
      }
    } catch (error) {
      logger.error("Schedule auto-activation job error:", error);
    }
  });

  logger.info("✅ Reminder jobs started");
};

// ─── Schedule end-of-day email reminder ───────────────────────────────────────

function createMailTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || "587", 10),
    secure: false,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export const startScheduleReminderJob = (): void => {
  // Fire every day at 9 PM (21:00) server time
  cron.schedule("0 21 * * *", async () => {
    try {
      const transporter = createMailTransporter();
      if (!transporter) {
        logger.warn("SMTP not configured — skipping schedule reminder emails");
        return;
      }

      // Find all users with active schedules
      const users = await prisma.user.findMany({
        where: { schedules: { some: { isActive: true } } },
        select: { id: true, email: true, name: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const user of users) {
        const schedules = await prisma.schedule.findMany({
          where: { userId: user.id, isActive: true },
          include: {
            items: { orderBy: { order: "asc" } },
            logs: { where: { date: today } },
          },
        });

        const totalItems = schedules.reduce((s, sc) => s + sc.items.length, 0);
        const doneLogs = schedules.reduce(
          (s, sc) => s + sc.logs.filter((l) => l.isDone).length,
          0
        );
        const pending = totalItems - doneLogs;
        if (pending === 0) continue; // all done — no email needed

        const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d0d11;color:#e2e8f0;padding:24px;border-radius:12px;border:1px solid #1e1e2a">
  <h2 style="color:#a5b4fc;margin-top:0">⏰ Daily Schedule Check-in</h2>
  <p>Hi <strong>${user.name}</strong>,</p>
  <p>You have <strong style="color:#f59e0b">${pending} item${pending !== 1 ? "s" : ""}</strong> remaining in today's schedule.</p>
  ${schedules
    .filter((sc) => sc.items.length > sc.logs.filter((l) => l.isDone).length)
    .map(
      (sc) => `
    <div style="margin:16px 0;padding:12px;background:#1c1c28;border-radius:8px;border-left:3px solid #6366f1">
      <strong style="color:#c4b5fd">${sc.name}</strong>
      <ul style="margin:8px 0;padding-left:20px;color:#94a3b8">
        ${sc.items
          .filter((item) => !sc.logs.find((l) => l.scheduleItemId === item.id && l.isDone))
          .map((item) => `<li>${item.timeOfDay ? `<span style="color:#6366f1">${item.timeOfDay}</span> ` : ""}${item.title}</li>`)
          .join("")}
      </ul>
    </div>`
    )
    .join("")}
  <p style="margin-top:20px"><a href="${env.FRONTEND_URL}/scheduler" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Open Scheduler →</a></p>
  <p style="color:#4b5563;font-size:12px;margin-top:24px">You're receiving this because you have active schedules on FlowPilot AI.</p>
</div>`;

        await transporter.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER,
          to: user.email,
          subject: `📋 ${pending} schedule item${pending !== 1 ? "s" : ""} pending — ${new Date().toLocaleDateString()}`,
          html,
        });

        logger.info(`Schedule reminder email sent to ${user.email}`);
      }
    } catch (error) {
      logger.error("Schedule reminder job error:", error);
    }
  });

  logger.info("✅ Schedule end-of-day reminder job started (runs at 21:00)");
};
