import cron from "node-cron";
import { prisma } from "../config/database";
import { logger } from "../utils/logger";
import { emitToUser } from "../socket";

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

  logger.info("✅ Reminder jobs started");
};
