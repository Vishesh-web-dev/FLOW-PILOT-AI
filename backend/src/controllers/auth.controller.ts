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
          ...(avatar && { avatar }),
        },
        select: { id: true, name: true, email: true, avatar: true, updatedAt: true },
      });

      sendSuccess(res, user, "Profile updated successfully");
    } catch (error) {
      logger.error("UpdateProfile error:", error);
      sendError(res, "Failed to update profile");
    }
  },
};
