import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { initializeSocket } from "./socket";
import { startReminderJob } from "./jobs/reminder.job";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

const app = express();
const httpServer = createServer(app);

// ───────────────────────────────────────────
// Security Middleware
// ───────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  message: { success: false, message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  message: { success: false, message: "AI rate limit exceeded, please wait" },
});

app.use(limiter);

// ───────────────────────────────────────────
// Request Parsing
// ───────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
if (env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}



// ───────────────────────────────────────────
// Routes
// ───────────────────────────────────────────
app.use("/api", routes);
app.use("/api/ai", aiLimiter); // Apply AI rate limit

// ───────────────────────────────────────────
// Error Handling
// ───────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ───────────────────────────────────────────
// Bootstrap
// ───────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize Socket.io
    initializeSocket(httpServer);

    // Start background jobs
    startReminderJob();

    // Start HTTP server
    httpServer.listen(Number(env.PORT), () => {
      logger.info("═══════════════════════════════════════");
      logger.info(`🚀 FlowPilot AI Backend running`);
      logger.info(`📡 Port: ${env.PORT}`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${env.PORT}/api`);
      logger.info(`💚 Health: http://localhost:${env.PORT}/api/health`);
      logger.info("═══════════════════════════════════════");
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  httpServer.close(async () => {
    await disconnectDatabase();
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

bootstrap();

export { app, httpServer };
