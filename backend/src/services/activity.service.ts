import { prisma } from "../config/database";
import { ActivityType, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";

interface LogActivityInput {
  userId: string;
  type: ActivityType;
  description: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  async log(input: LogActivityInput): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          userId: input.userId,
          type: input.type,
          description: input.description,
          ...(input.taskId && { taskId: input.taskId }),
          ...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue }),
        },
      });
    } catch (error) {
      logger.error("Failed to log activity:", error);
      // Don't throw - activity logging should not break main operations
    }
  },

  async getUserActivities(userId: string, limit: number = 50) {
    return prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        task: {
          select: { id: true, title: true, status: true, priority: true },
        },
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
  },
};
