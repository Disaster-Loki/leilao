import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./wallet.service";

export const walletRouter = Router();

walletRouter.use(requireAuth);

const depositSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000), // teto: 1.000.000,00
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