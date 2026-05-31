import multer, { FileFilterCallback } from "multer";
import { Request, Response, NextFunction } from "express";

// Store in memory — we stream straight to Cloudinary, no disk writes
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

// Error handler for multer errors (file too large, wrong type, etc.)
export function handleUploadError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ success: false, message: "File too large. Maximum size is 5MB." });
      return;
    }
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  if (err) {
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  next();
}
