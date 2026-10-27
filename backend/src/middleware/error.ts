import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { APP_MESSAGES } from "../messages";

const VALIDATION_MESSAGES: Record<string, string> = {
  invalid_type: APP_MESSAGES.validation.invalidValue,
  invalid_format: APP_MESSAGES.validation.invalidValue,
  too_small: APP_MESSAGES.validation.minLength,
  too_big: APP_MESSAGES.validation.maxLength,
  invalid_value: APP_MESSAGES.validation.invalidValue,
};
const AUTHORED_VALIDATION_MESSAGES = new Set<string>([
  ...Object.values(APP_MESSAGES.auth),
  ...Object.values(APP_MESSAGES.validation),
  ...Object.values(APP_MESSAGES.errors),
]);

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
    const message = APP_MESSAGES.errors[err.code as keyof typeof APP_MESSAGES.errors];
    return res.status(err.status).json({
      error: err.code,
      ...(message ? { message } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.code === "invalid_type" && issue.input === undefined
        ? APP_MESSAGES.validation.required
        : AUTHORED_VALIDATION_MESSAGES.has(issue.message)
          ? issue.message
          : VALIDATION_MESSAGES[issue.code] ?? APP_MESSAGES.validation.invalidValue,
    }));
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: details[0]?.message ?? APP_MESSAGES.errors.VALIDATION_ERROR,
      details,
    });
  }
  res.status(500).json({ error: "INTERNAL_ERROR" });
}

// Express 4 não apanha erros de funções async sozinho. Este wrapper resolve.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };