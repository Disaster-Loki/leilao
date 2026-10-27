import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./wallet.service";
import { APP_MESSAGES } from "../../messages";
import { CENTS_PATTERN, POSTGRES_BIGINT_MAX } from "../../money";
import { env } from "../../config/env";

export const walletRouter = Router();

walletRouter.use(requireAuth);

const depositSchema = z.object({
  amountCents: z.string().regex(CENTS_PATTERN, APP_MESSAGES.validation.centsString)
    .transform((value) => BigInt(value)),
});

// Leitura: qualquer utilizador autenticado vê a própria carteira
// (o leiloeiro também tem carteira, onde recebe o valor das vendas)
walletRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await service.getWallet(req.user!.id));
  })
);
walletRouter.get(
  "/limits",
  asyncHandler(async (_req, res) => {
    res.json({
      minDepositCents: env.MIN_DEPOSIT_CENTS.toString(),
      maxDepositCents: env.MAX_DEPOSIT_CENTS.toString(),
      maxWalletCents: env.MAX_WALLET_CENTS.toString(),
    });
  })
);

// Depósito: só licitante, conforme o PDF
walletRouter.post(
  "/deposit",
  requireRole("bidder"),
  asyncHandler(async (req, res) => {
    const { amountCents } = depositSchema.parse(req.body);
    if (amountCents > POSTGRES_BIGINT_MAX || amountCents > env.MAX_DEPOSIT_CENTS) {
      throw new AppError(400, "DEPOSIT_ABOVE_MAXIMUM");
    }
    if (amountCents < env.MIN_DEPOSIT_CENTS) {
      throw new AppError(400, "DEPOSIT_BELOW_MINIMUM");
    }
    res.status(201).json(await service.deposit(req.user!.id, amountCents));
  })
);