import { prisma } from "../config/database";
import { ActivityType, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { emitToProject, emitToUser } from "../socket";

export interface LogActivityInput {
  userId: string;
  type: ActivityType;
  description: string;
  taskId?: string;
  projectId?: string;           // optional — auto-resolved from taskId if omitted
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Log an activity and broadcast it in real-time.
   * - If the activity belongs to a project (directly or via task), it is emitted
   *   to the project room so every member sees it instantly.
   * - Otherwise it is emitted only to the acting user's private room.
   */
  async log(input: LogActivityInput): Promise<void> {
    try {
      // Auto-resolve projectId from task if not explicitly provided
      let resolvedProjectId = input.projectId ?? null;
      if (!resolvedProjectId && input.taskId) {
        const task = await prisma.task.findUnique({
          where: { id: input.taskId },
          select: { projectId: true },
        });
        resolvedProjectId = task?.projectId ?? null;
      }

      const activity = await prisma.activity.create({
        data: {
          userId: input.userId,
          type: input.type,
          description: input.description,
          ...(input.taskId && { taskId: input.taskId }),
          ...(resolvedProjectId && { projectId: resolvedProjectId }),
          ...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue }),
        },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          task: { select: { id: true, title: true, status: true, priority: true } },
          project: { select: { id: true, name: true } },
        },
      });

      // Real-time broadcast
      if (resolvedProjectId) {
        emitToProject(resolvedProjectId, "activity:new", activity);
      } else {
        emitToUser(input.userId, "activity:new", activity);
      }
    } catch (error) {
      logger.error("Failed to log activity:", error);
      // Never throw — activity logging must not break the main operation
    }
  },

  /**
   * Fetch activities visible to a user:
   * - Their own personal activities
   * - All activities from every project they are a member of
   * Ordered newest-first, paginated.
   */
  async getForUser(userId: string, limit = 50, skip = 0) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const memberProjectIds = memberships.map((m) => m.projectId);

    return prisma.activity.findMany({
      where: {
        OR: [
          { userId },                                        // own activities
          { projectId: { in: memberProjectIds } },          // project activities
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        task: { select: { id: true, title: true, status: true, priority: true } },
        project: { select: { id: true, name: true } },
      },
    });
  },

  async countForUser(userId: string): Promise<number> {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const memberProjectIds = memberships.map((m) => m.projectId);

    return prisma.activity.count({
      where: {
        OR: [
          { userId },
          { projectId: { in: memberProjectIds } },
        ],
      },
    });
  },

  // Keep legacy getUserActivities for backward compat (used nowhere else)
  async getUserActivities(userId: string, limit = 50) {
    return this.getForUser(userId, limit, 0);
  },
};

