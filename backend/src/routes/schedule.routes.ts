import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { scheduleController } from "../controllers/schedule.controller";

const router = Router();

router.use(authenticate);

// Schedules CRUD
router.get("/", scheduleController.getAll);
router.post("/", scheduleController.create);
router.post("/ai-generate", scheduleController.aiGenerate);
router.get("/:id", scheduleController.getOne);
router.put("/:id/sync", scheduleController.syncSchedule);
router.put("/:id", scheduleController.update);
router.delete("/:id", scheduleController.remove);

// Schedule items
router.post("/:id/items", scheduleController.addItem);
router.put("/:id/items/reorder", scheduleController.reorderItems);
router.put("/:id/items/:itemId", scheduleController.updateItem);
router.delete("/:id/items/:itemId", scheduleController.deleteItem);

// Daily logs
router.get("/:id/logs", scheduleController.getLogs);
router.post("/:id/logs/toggle", scheduleController.toggleLog);

// Analytics
router.get("/:id/analytics", scheduleController.getAnalytics);

export default router;
