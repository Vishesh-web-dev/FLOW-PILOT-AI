import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { EventEmitter } from "events";
import { verifyToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { prisma } from "../config/database";

let io: Server | null = null;

// ── Internal event bus ────────────────────────────────────────────────────────
// Controllers emit here. This layer preprocesses (logs, stamps, transforms)
// and then forwards to Socket.io rooms. Nothing goes to frontend directly.
export const internalBus = new EventEmitter();
internalBus.setMaxListeners(50);

interface BusPayload {
  room: "project" | "user";   // which room type to target
  roomId: string;              // projectId or userId
  event: string;               // socket event name (e.g. "task:updated")
  data: unknown;               // raw data from controller
}

// Wire up the bus → Socket.io once initializeSocket has run
function wireBus() {
  internalBus.on("emit", (payload: BusPayload) => {
    if (!io) return;

    // ── Preprocessing ─────────────────────────────────────────────────────
    const enriched = {
      ...(typeof payload.data === "object" && payload.data !== null ? payload.data : { value: payload.data }),
      _meta: {
        event: payload.event,
        roomType: payload.room,
        roomId: payload.roomId,
        serverTime: new Date().toISOString(),
      },
    };

    logger.debug(
      `[Socket Bus] ${payload.event} → ${payload.room}:${payload.roomId}`,
      { keys: Object.keys(enriched) }
    );
    // ── End preprocessing ─────────────────────────────────────────────────

    const room = `${payload.room}:${payload.roomId}`;
    io.to(room).emit(payload.event, enriched);
  });
}

export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://flow-pilot-ai-phi.vercel.app",
        env.FRONTEND_URL,
        "http://localhost:5173",
      ].filter(Boolean),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
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

  io.on("connection", async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    logger.info(`Socket connected: ${socket.id} | User: ${userId}`);

    // Join user-specific room for private events
    socket.join(`user:${userId}`);

    // Auto-join ALL project rooms this user is a member of
    // so real-time events work regardless of which page they're on
    try {
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      for (const { projectId } of memberships) {
        socket.join(`project:${projectId}`);
      }
      logger.debug(`User ${userId} auto-joined ${memberships.length} project rooms`);
    } catch (err) {
      logger.error(`Failed to auto-join project rooms for user ${userId}:`, err);
    }

    // Handle joining project rooms (for when user joins a new project dynamically)
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
  wireBus();   // connect internal bus → socket.io rooms
  return io;
};

export const getSocketInstance = (): Server | null => io;

export const emitToUser = (userId: string, event: string, data: unknown): void => {
  internalBus.emit("emit", { room: "user", roomId: userId, event, data } satisfies BusPayload);
};

export const emitToProject = (projectId: string, event: string, data: unknown): void => {
  internalBus.emit("emit", { room: "project", roomId: projectId, event, data } satisfies BusPayload);
};
