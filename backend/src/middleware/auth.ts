import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error";

export type Role = "auctioneer" | "bidder";

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "UNAUTHENTICATED");
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    throw new AppError(401, "INVALID_TOKEN");
  }
}

export const requireRole =
  (role: Role) => (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) throw new AppError(403, "FORBIDDEN");
    next();
  };