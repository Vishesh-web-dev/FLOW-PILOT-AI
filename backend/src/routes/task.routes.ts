import { Router } from "express";
import { taskController, createTaskSchema, updateTaskSchema } from "../controllers/task.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/", taskController.getAllTasks);
router.get("/stats", taskController.getTaskStats);
router.get("/:id", taskController.getTaskById);
router.post("/", validate(createTaskSchema), taskController.createTask);
router.put("/:id", validate(updateTaskSchema), taskController.updateTask);
router.delete("/:id", taskController.deleteTask);
router.patch("/reorder", taskController.reorderTasks);

export default router;
