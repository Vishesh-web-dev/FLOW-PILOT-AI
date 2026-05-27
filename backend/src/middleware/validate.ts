import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendBadRequest } from "../utils/response";

export const validate =
  (schema: ZodSchema, source: "body" | "params" | "query" = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error as ZodError;
      const errorMessages = errors.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      sendBadRequest(res, "Validation failed", errorMessages);
      return;
    }
    req[source] = result.data;
    next();
  };
