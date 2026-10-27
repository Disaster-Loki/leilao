import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./wallet.service";
import { APP_MESSAGES } from "../../messages";

export const walletRouter = Router();

walletRouter.use(requireAuth);

const depositSchema = z.object({
  amountCents: z
    .number()
    .int(APP_MESSAGES.validation.integer)
    .positive(APP_MESSAGES.validation.positive)
    .max(100_000_000, APP_MESSAGES.validation.maxCents),
});

// Leitura: qualquer utilizador autenticado vê a própria carteira
// (o leiloeiro também tem carteira, onde recebe o valor das vendas)
walletRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await service.getWallet(req.user!.id));
  })
);

// Depósito: só licitante, conforme o PDF
walletRouter.post(
  "/deposit",
  requireRole("bidder"),
  asyncHandler(async (req, res) => {
    const { amountCents } = depositSchema.parse(req.body);
    res.status(201).json(await service.deposit(req.user!.id, amountCents));
  })
);