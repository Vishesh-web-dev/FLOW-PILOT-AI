import { Router } from "express";
import { reminderController, createReminderSchema } from "../controllers/reminder.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get("/", reminderController.getAllReminders);
router.post("/", validate(createReminderSchema), reminderController.createReminder);
router.put("/:id", reminderController.updateReminder);
router.patch("/:id/complete", reminderController.completeReminder);
router.delete("/:id", reminderController.deleteReminder);

export default router;
