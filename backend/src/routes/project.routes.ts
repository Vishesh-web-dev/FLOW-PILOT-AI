import { Router } from "express";
import { projectController, createProjectSchema } from "../controllers/project.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);
router.post("/", validate(createProjectSchema), projectController.createProject);
router.put("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);

export default router;
