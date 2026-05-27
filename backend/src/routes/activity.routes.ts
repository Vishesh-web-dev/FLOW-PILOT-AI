import { Router } from "express";
import { activityController } from "../controllers/activity.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", activityController.getActivities);
router.get("/summary", activityController.getDailySummary);

export default router;
