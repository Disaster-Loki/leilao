import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./lots.service";

export const lotsRouter = Router();

const createSchema = z
  .object({
    externalId: z.string().regex(/^\d+$/),
    startPriceCents: z.number().int().positive().max(1_000_000_000),
    minIncrementCents: z.number().int().positive().max(1_000_000_000),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((v) => v.endAt > v.startAt, { message: "endAt must be after startAt", path: ["endAt"] })
  .refine((v) => v.endAt > new Date(), { message: "endAt must be in the future", path: ["endAt"] });

// Públicas (vitrine e sala)
lotsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q } = z.object({ q: z.string().trim().max(100).optional() }).parse(req.query);
    res.json(await service.listShowcase(q));
  })
);

// Painel do leiloeiro. IMPORTANTE: antes de "/:id", senão "mine" seria lido como id
lotsRouter.get(
  "/mine",
  requireAuth,
  requireRole("auctioneer"),
  asyncHandler(async (req, res) => {
    res.json(await service.listMine(req.user!.id));
  })
);

lotsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json(await service.getLot(id));
  })
);

lotsRouter.post(
  "/",
  requireAuth,
  requireRole("auctioneer"),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    res.status(201).json(await service.createLot(req.user!.id, input));
  })
);

lotsRouter.post(
  "/:id/cancel",
  requireAuth,
  requireRole("auctioneer"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await service.cancelLot(id, req.user!.id);
    res.status(204).end();
  })
);