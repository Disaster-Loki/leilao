import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { optionalAuth, requireAuth, requireRole } from "../../middleware/auth";
import { APP_MESSAGES } from "../../messages";
import * as service from "./bids.service";
import { REAIS_PATTERN, POSTGRES_BIGINT_MAX } from "../../money";

export const bidsRouter = Router();

const bidSchema = z.object({
  amountReais: z.string().regex(REAIS_PATTERN, APP_MESSAGES.validation.reaisString)
    .transform((value) => BigInt(value))
    .refine((value) => value > 0n, APP_MESSAGES.validation.positive)
    .refine((value) => value <= POSTGRES_BIGINT_MAX, APP_MESSAGES.validation.maxReais),
});

// Dar lance: só licitante
bidsRouter.post(
  "/:id/bids",
  requireAuth,
  requireRole("bidder"),
  asyncHandler(async (req, res) => {
    const lotId = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.id);
    const { amountReais } = bidSchema.parse(req.body);
    res.status(201).json(await service.placeBid(lotId, req.user!.id, amountReais));
  })
);

// Sala: pública; com token, diz também a posição do utilizador
bidsRouter.get(
  "/:id/room",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lotId = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.id);
    res.json(await service.getRoom(lotId, req.user?.id));
  })
);