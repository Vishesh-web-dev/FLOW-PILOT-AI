import { Router } from "express";
import { authController, registerSchema, loginSchema } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Public routes
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);

// Protected routes
router.get("/me", authenticate, authController.getMe);
router.put("/profile", authenticate, authController.updateProfile);

export default router;
