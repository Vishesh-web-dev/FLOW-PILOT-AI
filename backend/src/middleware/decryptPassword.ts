import { Request, Response, NextFunction } from "express";
import { decryptPassword } from "../utils/crypto";
import { sendBadRequest } from "../utils/response";
import { logger } from "../utils/logger";

// Body fields that may carry an RSA-encrypted password.
const PASSWORD_FIELDS = ["password", "currentPassword", "newPassword"] as const;

/**
 * When the client sends `{ encrypted: true }`, decrypt the password field(s)
 * in place back to plaintext BEFORE validation/controllers run, so the rest of
 * the auth flow (zod validation, bcrypt) is unchanged.
 *
 * Requests without the `encrypted` flag pass through untouched — this keeps
 * older cached frontends (and the demo flow) working during rolling deploys.
 */
export const decryptPasswordFields = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (req.body && req.body.encrypted === true) {
      for (const field of PASSWORD_FIELDS) {
        const value = req.body[field];
        if (typeof value === "string" && value.length > 0) {
          req.body[field] = decryptPassword(value);
        }
      }
      delete req.body.encrypted;
    }
    next();
  } catch (error) {
    logger.error("Password decryption failed:", error);
    sendBadRequest(res, "Could not process credentials. Please try again.");
  }
};
