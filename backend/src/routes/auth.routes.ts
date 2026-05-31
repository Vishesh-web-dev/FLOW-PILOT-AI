import { Router } from "express";
import { authController, registerSchema, loginSchema } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadMiddleware, handleUploadError } from "../middleware/upload";

const router = Router();

// Public routes
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/demo", authController.demoLogin);

// Protected routes
router.get("/me", authenticate, authController.getMe);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/password", authenticate, authController.changePassword);
router.post("/avatar", authenticate, uploadMiddleware.single("avatar"), handleUploadError, authController.uploadAvatar);
router.delete("/avatar", authenticate, authController.deleteAvatar);

export default router;
