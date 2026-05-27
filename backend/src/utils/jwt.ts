import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JWTPayload } from "../types";

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

export const verifyToken = (token: string): JWTPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  return decoded;
};
