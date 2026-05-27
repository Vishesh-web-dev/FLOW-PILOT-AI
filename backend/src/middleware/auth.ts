import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../config/database";
import { sendUnauthorized } from "../utils/response";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendUnauthorized(res, "No token provided");
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      sendUnauthorized(res, "Invalid token format");
      return;
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatar: true },
    });

    if (!user) {
      sendUnauthorized(res, "User not found");
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    sendUnauthorized(res, "Invalid or expired token");
  }
};
