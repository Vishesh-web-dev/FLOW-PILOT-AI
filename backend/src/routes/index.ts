import { Router } from "express";
import authRoutes from "./auth.routes";
import taskRoutes from "./task.routes";
import projectRoutes from "./project.routes";
import sprintRoutes from "./sprint.routes";
import aiRoutes from "./ai.routes";
import activityRoutes from "./activity.routes";
import reminderRoutes from "./reminder.routes";

const router = Router();

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "FlowPilot AI API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API Routes
router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/projects", projectRoutes);
router.use("/sprints", sprintRoutes);
router.use("/ai", aiRoutes);
router.use("/activities", activityRoutes);
router.use("/reminders", reminderRoutes);

export default router;
