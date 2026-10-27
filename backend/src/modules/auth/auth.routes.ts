import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth } from "../../middleware/auth";
import * as service from "./auth.service";
import { APP_MESSAGES } from "../../messages";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(APP_MESSAGES.auth.invalidEmail),
  name: z.string().trim().min(2, APP_MESSAGES.auth.minName).max(80, APP_MESSAGES.auth.maxName),
  password: z
    .string()
    .min(8, APP_MESSAGES.auth.invalidPassword)
    .max(100)
    .regex(/[a-z]/, APP_MESSAGES.auth.passwordLowercase)
    .regex(/[A-Z]/, APP_MESSAGES.auth.passwordUppercase)
    .regex(/[0-9]/, APP_MESSAGES.auth.passwordNumber)
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, APP_MESSAGES.auth.passwordSymbol),
  role: z.enum(["auctioneer", "bidder"]),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(APP_MESSAGES.auth.invalidEmail),
  password: z.string().min(1, APP_MESSAGES.validation.required),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    res.status(201).json(await service.register(input));
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await service.login(email, password));
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.getMe(req.user!.id));
  })
);