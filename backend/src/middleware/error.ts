import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(code);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, ...(err.details ? { details: err.details } : {}) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: err.issues });
  }
  res.status(500).json({ error: "INTERNAL_ERROR" });
}

// Express 4 não apanha erros de funções async sozinho. Este wrapper resolve.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };