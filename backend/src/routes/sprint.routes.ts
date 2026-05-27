import { Router } from "express";
import { sprintController, createSprintSchema } from "../controllers/sprint.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get("/", sprintController.getAllSprints);
router.get("/:id", sprintController.getSprintById);
router.post("/", validate(createSprintSchema), sprintController.createSprint);
router.put("/:id", sprintController.updateSprint);
router.delete("/:id", sprintController.deleteSprint);

export default router;
