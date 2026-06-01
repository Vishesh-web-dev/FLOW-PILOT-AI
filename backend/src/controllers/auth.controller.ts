import { Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/database";
import { generateToken } from "../utils/jwt";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
  sendError,
} from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { activityService } from "../services/activity.service";
import { cloudinary } from "../config/cloudinary";

// Zod Schemas
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const authController = {
  // POST /api/auth/register
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body as z.infer<typeof registerSchema>;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        sendBadRequest(res, "User with this email already exists");
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword },
        select: { id: true, name: true, email: true, avatar: true, createdAt: true },
      });

      // Generate token
      const token = generateToken({ userId: user.id, email: user.email });

      // Log activity
      await activityService.log({
        userId: user.id,
        type: "USER_REGISTERED",
        description: `${user.name} joined FlowPilot AI`,
      });

      sendCreated(res, { user, token }, "Account created successfully");
    } catch (error) {
      logger.error("Register error:", error);
      sendError(res, "Failed to create account");
    }
  },

  // POST /api/auth/login
  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        sendUnauthorized(res, "Invalid email or password");
        return;
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        sendUnauthorized(res, "Invalid email or password");
        return;
      }

      // Generate token
      const token = generateToken({ userId: user.id, email: user.email });

      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      };

      sendSuccess(res, { user: userResponse, token }, "Login successful");
    } catch (error) {
      logger.error("Login error:", error);
      sendError(res, "Failed to login");
    }
  },

  // GET /api/auth/me
  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              tasks: true,
              projects: true,
              sprints: true,
            },
          },
        },
      });

      sendSuccess(res, user, "User profile retrieved");
    } catch (error) {
      logger.error("GetMe error:", error);
      sendError(res, "Failed to get profile");
    }
  },

  // PUT /api/auth/profile
  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, avatar } = req.body as { name?: string; avatar?: string };

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(name && { name }),
          ...(avatar !== undefined && { avatar }),
        },
        select: { id: true, name: true, email: true, avatar: true, updatedAt: true },
      });

      sendSuccess(res, user, "Profile updated successfully");
    } catch (error) {
      logger.error("UpdateProfile error:", error);
      sendError(res, "Failed to update profile");
    }
  },

  // PUT /api/auth/password
  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        sendBadRequest(res, "Current and new password are required");
        return;
      }
      if (newPassword.length < 6) {
        sendBadRequest(res, "New password must be at least 6 characters");
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) {
        sendUnauthorized(res, "User not found");
        return;
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        sendBadRequest(res, "Current password is incorrect");
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { password: hashed },
      });

      sendSuccess(res, null, "Password changed successfully");
    } catch (error) {
      logger.error("ChangePassword error:", error);
      sendError(res, "Failed to change password");
    }
  },

  // POST /api/auth/avatar
  async uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        sendBadRequest(res, "No image file provided");
        return;
      }

      // Stream the buffer to Cloudinary
      const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "flowpilot-avatars",
              public_id: `user_${req.user!.id}`, // deterministic ID — overwrites old avatar
              overwrite: true,
              transformation: [
                { width: 256, height: 256, crop: "fill", gravity: "face" }, // auto-crop to face
                { quality: "auto", fetch_format: "auto" },
              ],
            },
            (error, result) => {
              if (error || !result) return reject(error ?? new Error("Upload failed"));
              resolve({ secure_url: result.secure_url, public_id: result.public_id });
            }
          );
          stream.end(req.file!.buffer);
        }
      );

      // Save Cloudinary URL to DB
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatar: uploadResult.secure_url },
        select: { id: true, name: true, email: true, avatar: true, updatedAt: true },
      });

      logger.info(`Avatar uploaded for user ${req.user!.id}: ${uploadResult.public_id}`);
      sendSuccess(res, user, "Avatar uploaded successfully");
    } catch (error) {
      logger.error("UploadAvatar error:", error);
      sendError(res, "Failed to upload avatar");
    }
  },

  // DELETE /api/auth/avatar
  async deleteAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Remove from Cloudinary
      await cloudinary.uploader.destroy(`flowpilot-avatars/user_${req.user!.id}`);

      // Clear avatar URL in DB
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatar: null },
        select: { id: true, name: true, email: true, avatar: true, updatedAt: true },
      });

      sendSuccess(res, user, "Avatar removed successfully");
    } catch (error) {
      logger.error("DeleteAvatar error:", error);
      sendError(res, "Failed to remove avatar");
    }
  },

  // POST /api/auth/demo
  // Creates the demo account (idempotent) and returns a valid token.
  // Seeds sample project + tasks on the very first creation.
  async demoLogin(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const DEMO_EMAIL = "demo@flowpilot.ai";
      const DEMO_PASSWORD = "demo123456";
      const DEMO_NAME = "Demo User";

      // ── 1. Ensure user exists ──────────────────────────────────────────────
      let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
      if (!user) {
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
        user = await prisma.user.create({
          data: { name: DEMO_NAME, email: DEMO_EMAIL, password: hashedPassword },
        });
      }

      const userId = user.id;

      // ── 2. Wipe all existing demo data (order matters for FK constraints) ──
      await prisma.aICommand.deleteMany({ where: { userId } });
      await prisma.activity.deleteMany({ where: { userId } });
      await prisma.reminder.deleteMany({ where: { userId } });
      await prisma.task.deleteMany({ where: { userId } });
      await prisma.sprint.deleteMany({ where: { userId } });
      await prisma.projectMember.deleteMany({ where: { userId } });
      await prisma.project.deleteMany({ where: { userId } });

      // ── 3. Re-seed rich demo data ──────────────────────────────────────────
      const now = new Date();
      const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000);
      const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

      // Projects
      const [projectAlpha, projectBeta] = await Promise.all([
        prisma.project.create({
          data: {
            name: "FlowPilot Redesign",
            description: "Complete redesign of the FlowPilot product for Q3 launch",
            color: "#6366f1",
            userId,
            members: { create: { userId, role: "OWNER" } },
          },
        }),
        prisma.project.create({
          data: {
            name: "Mobile App MVP",
            description: "Ship the iOS and Android MVP by end of quarter",
            color: "#10b981",
            userId,
            members: { create: { userId, role: "OWNER" } },
          },
        }),
      ]);

      // Sprints
      const [sprintAlpha1, sprintAlpha2, sprintBeta1] = await Promise.all([
        prisma.sprint.create({
          data: {
            name: "Sprint 1 — Foundation",
            goal: "Set up architecture and core flows",
            startDate: daysAgo(14),
            endDate: daysAgo(1),
            status: "COMPLETED",
            userId,
            projectId: projectAlpha.id,
          },
        }),
        prisma.sprint.create({
          data: {
            name: "Sprint 2 — UI Polish",
            goal: "Pixel-perfect components and dark mode",
            startDate: now,
            endDate: daysFromNow(13),
            status: "ACTIVE",
            userId,
            projectId: projectAlpha.id,
          },
        }),
        prisma.sprint.create({
          data: {
            name: "Sprint 1 — MVP Core",
            goal: "Auth, onboarding, and home screen",
            startDate: daysAgo(7),
            endDate: daysFromNow(7),
            status: "ACTIVE",
            userId,
            projectId: projectBeta.id,
          },
        }),
      ]);

      // Tasks — FlowPilot Redesign / Sprint 1 (completed sprint)
      const alphaS1Tasks = [
        { title: "Set up monorepo with Turborepo", status: "DONE", priority: "HIGH", position: 0, labels: ["setup"] },
        { title: "Configure CI/CD pipeline", status: "DONE", priority: "HIGH", position: 1, labels: ["devops"] },
        { title: "Design system tokens (colors, spacing)", status: "DONE", priority: "HIGH", position: 2, labels: ["design"] },
        { title: "Authentication flow — login & register", status: "DONE", priority: "URGENT", position: 3, labels: ["auth"] },
        { title: "Database schema v1", status: "DONE", priority: "HIGH", position: 4, labels: ["backend"] },
      ] as const;

      // Tasks — FlowPilot Redesign / Sprint 2 (active sprint, mixed statuses)
      const alphaS2Tasks = [
        { title: "Redesign dashboard layout", status: "IN_PROGRESS", priority: "HIGH", position: 0, labels: ["frontend", "design"] },
        { title: "Build Kanban board component", status: "IN_PROGRESS", priority: "HIGH", position: 1, labels: ["frontend"] },
        { title: "Dark mode implementation", status: "IN_REVIEW", priority: "MEDIUM", position: 2, labels: ["frontend"] },
        { title: "AI command input widget", status: "IN_REVIEW", priority: "HIGH", position: 3, labels: ["frontend", "ai"] },
        { title: "Sprint planning UI", status: "TODO", priority: "MEDIUM", position: 4, labels: ["frontend"] },
        { title: "Notification centre", status: "TODO", priority: "LOW", position: 5, labels: ["frontend"] },
        { title: "Write Storybook stories for components", status: "TODO", priority: "LOW", position: 6, labels: ["docs"] },
      ] as const;

      // Tasks — Mobile App / Sprint 1 (active)
      const betaS1Tasks = [
        { title: "React Native project scaffold", status: "DONE", priority: "HIGH", position: 0, labels: ["setup"] },
        { title: "Implement biometric login", status: "IN_PROGRESS", priority: "URGENT", position: 1, labels: ["auth", "mobile"] },
        { title: "Home screen — task feed", status: "IN_PROGRESS", priority: "HIGH", position: 2, labels: ["mobile"] },
        { title: "Push notification integration", status: "TODO", priority: "HIGH", position: 3, labels: ["mobile"] },
        { title: "Offline mode with SQLite cache", status: "TODO", priority: "MEDIUM", position: 4, labels: ["mobile"] },
        { title: "App Store & Play Store listing assets", status: "TODO", priority: "LOW", position: 5, labels: ["marketing"] },
      ] as const;

      // Standalone personal tasks (no project)
      const personalTasks = [
        { title: "Review Q3 OKRs with team", status: "TODO", priority: "HIGH", position: 0, labels: ["planning"] },
        { title: "Prepare investor deck", status: "IN_PROGRESS", priority: "URGENT", position: 1, labels: ["business"] },
        { title: "1:1 with design lead — agenda prep", status: "DONE", priority: "MEDIUM", position: 2, labels: ["meeting"] },
      ] as const;

      const createTasks = async (
        tasks: readonly { title: string; status: string; priority: string; position: number; labels: readonly string[] }[],
        projectId: string,
        sprintId: string,
        dueOffsets: number[]
      ) =>
        Promise.all(
          tasks.map((t, i) =>
            prisma.task.create({
              data: {
                title: t.title,
                status: t.status as any,
                priority: t.priority as any,
                position: t.position,
                labels: [...t.labels],
                userId,
                projectId,
                sprintId,
                dueDate: dueOffsets[i] != null ? daysFromNow(dueOffsets[i]) : undefined,
                estimatedHours: [2, 3, 4, 6, 8][i % 5],
              },
            })
          )
        );

      await createTasks(alphaS1Tasks, projectAlpha.id, sprintAlpha1.id, [0, 0, 0, 0, 0]);
      await createTasks(alphaS2Tasks, projectAlpha.id, sprintAlpha2.id, [2, 3, 1, 4, 7, 10, 12]);
      await createTasks(betaS1Tasks, projectBeta.id, sprintBeta1.id, [0, 2, 4, 6, 8, 10]);

      await Promise.all(
        personalTasks.map((t) =>
          prisma.task.create({
            data: { ...t, labels: [...t.labels], userId },
          })
        )
      );

      // Reminders
      await Promise.all([
        prisma.reminder.create({
          data: { title: "Sprint 2 standup", description: "Daily sync at 9am", remindAt: daysFromNow(1), userId },
        }),
        prisma.reminder.create({
          data: { title: "Investor call prep", description: "Prepare slides for Series A deck review", remindAt: daysFromNow(3), userId },
        }),
        prisma.reminder.create({
          data: { title: "Design review", description: "Review final mockups with the design team", remindAt: daysFromNow(5), userId },
        }),
      ]);

      // Activities
      const activityEntries = [
        { type: "TASK_UPDATED" as const, description: "Moved \"Authentication flow\" to Done", daysBack: 1 },
        { type: "SPRINT_CREATED" as const, description: "Started Sprint 2 — UI Polish", daysBack: 0 },
        { type: "TASK_CREATED" as const, description: "Created task: \"Redesign dashboard layout\"", daysBack: 0 },
        { type: "AI_COMMAND" as const, description: "AI Command: \"Break down the dashboard redesign into subtasks\"", daysBack: 0 },
        { type: "TASK_CREATED" as const, description: "Created task: \"Prepare investor deck\"", daysBack: 2 },
      ];

      for (const entry of activityEntries) {
        await prisma.activity.create({
          data: {
            userId,
            type: entry.type,
            description: entry.description,
            createdAt: daysAgo(entry.daysBack),
          },
        });
      }

      // ── 4. Issue JWT ───────────────────────────────────────────────────────
      const token = generateToken({ userId, email: user.email });

      sendSuccess(
        res,
        {
          user: { id: userId, name: user.name, email: user.email, avatar: user.avatar, createdAt: user.createdAt },
          token,
        },
        "Demo session ready — explore freely!"
      );
    } catch (error) {
      logger.error("DemoLogin error:", error);
      sendError(res, "Failed to start demo session");
    }
  },
};
