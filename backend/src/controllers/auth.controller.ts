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

      let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
      const isNew = !user;

      if (!user) {
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
        user = await prisma.user.create({
          data: { name: DEMO_NAME, email: DEMO_EMAIL, password: hashedPassword },
        });

        // ── Seed sample data for the demo account ──────────────────────────
        const project = await prisma.project.create({
          data: {
            name: "Demo Project",
            description: "A sample project to explore FlowPilot AI",
            color: "#6366f1",
            userId: user.id,
          },
        });

        const sprint = await prisma.sprint.create({
          data: {
            name: "Sprint 1",
            goal: "Ship the MVP",
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "ACTIVE",
            userId: user.id,
            projectId: project.id,
          },
        });

        const sampleTasks = [
          { title: "Set up project structure", status: "DONE", priority: "HIGH", position: 0 },
          { title: "Design database schema", status: "DONE", priority: "HIGH", position: 1 },
          { title: "Build REST API endpoints", status: "IN_PROGRESS", priority: "HIGH", position: 2 },
          { title: "Implement authentication", status: "IN_PROGRESS", priority: "URGENT", position: 3 },
          { title: "Create dashboard UI", status: "TODO", priority: "MEDIUM", position: 4 },
          { title: "Write unit tests", status: "TODO", priority: "MEDIUM", position: 5 },
          { title: "Deploy to production", status: "TODO", priority: "LOW", position: 6 },
        ] as const;

        for (const t of sampleTasks) {
          await prisma.task.create({
            data: {
              ...t,
              userId: user.id,
              projectId: project.id,
              sprintId: sprint.id,
              labels: ["demo"],
            },
          });
        }

        await activityService.log({
          userId: user.id,
          type: "USER_REGISTERED",
          description: `${user.name} joined FlowPilot AI`,
        });

        logger.info(`Demo account created and seeded for ${DEMO_EMAIL}`);
      }

      const token = generateToken({ userId: user.id, email: user.email });

      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      };

      sendSuccess(
        res,
        { user: userResponse, token },
        isNew ? "Demo account created — explore freely!" : "Welcome back to the demo!"
      );
    } catch (error) {
      logger.error("DemoLogin error:", error);
      sendError(res, "Failed to start demo session");
    }
  },
};
