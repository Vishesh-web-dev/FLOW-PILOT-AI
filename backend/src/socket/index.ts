import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { env } from "../config/env";

let io: Server | null = null;

export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware for socket
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyToken(token);
      (socket as any).userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    logger.info(`Socket connected: ${socket.id} | User: ${userId}`);

    // Join user-specific room for private events
    socket.join(`user:${userId}`);

    // Handle joining project rooms
    socket.on("join:project", (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug(`User ${userId} joined project room: ${projectId}`);
    });

    // Handle leaving project rooms
    socket.on("leave:project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    // Handle joining sprint rooms
    socket.on("join:sprint", (sprintId: string) => {
      socket.join(`sprint:${sprintId}`);
    });

    // Handle ping for connection check
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });

    socket.on("error", (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info("✅ Socket.io initialized");
  return io;
};

export const getSocketInstance = (): Server | null => io;

export const emitToUser = (userId: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToProject = (projectId: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`project:${projectId}`).emit(event, data);
  }
};
