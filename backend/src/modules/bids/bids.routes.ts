import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { optionalAuth, requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./bids.service";

export const bidsRouter = Router();

const bidSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_000),
});

// Dar lance: só licitante
bidsRouter.post(
  "/:id/bids",
  requireAuth,
  requireRole("bidder"),
  asyncHandler(async (req, res) => {
    const lotId = z.string().uuid().parse(req.params.id);
    const { amountCents } = bidSchema.parse(req.body);
    res.status(201).json(await service.placeBid(lotId, req.user!.id, amountCents));
  })
);

// Sala: pública; com token, diz também a posição do utilizador
bidsRouter.get(
  "/:id/room",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lotId = z.string().uuid().parse(req.params.id);
    res.json(await service.getRoom(lotId, req.user?.id));
  })
);