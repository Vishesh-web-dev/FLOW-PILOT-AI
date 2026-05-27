import { Response } from "express";
import { ApiResponse } from "../types";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200,
  meta?: ApiResponse["meta"]
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string = "Internal Server Error",
  statusCode: number = 500,
  error?: string
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(error && { error }),
  };
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = "Created successfully"
): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendNotFound = (
  res: Response,
  message: string = "Resource not found"
): Response => {
  return sendError(res, message, 404);
};

export const sendUnauthorized = (
  res: Response,
  message: string = "Unauthorized"
): Response => {
  return sendError(res, message, 401);
};

export const sendForbidden = (
  res: Response,
  message: string = "Forbidden"
): Response => {
  return sendError(res, message, 403);
};

export const sendBadRequest = (
  res: Response,
  message: string = "Bad request",
  error?: string
): Response => {
  return sendError(res, message, 400, error);
};
