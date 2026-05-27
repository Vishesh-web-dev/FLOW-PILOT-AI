import { Router } from "express";
import { aiController, aiCommandSchema } from "../controllers/ai.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.post("/command", validate(aiCommandSchema), aiController.processCommand);
router.get("/history", aiController.getCommandHistory);
router.post("/summary", aiController.generateSummary);
router.post("/sprint-plan", aiController.generateSprintPlan);

export default router;
