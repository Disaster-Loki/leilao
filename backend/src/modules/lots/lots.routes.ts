import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as service from "./lots.service";
import { APP_MESSAGES } from "../../messages";
import { CENTS_PATTERN, POSTGRES_BIGINT_MAX } from "../../money";

export const lotsRouter = Router();

const createSchema = z
  .object({
    externalId: z.string().regex(/^\d+$/, APP_MESSAGES.validation.invalidExternalId),
    startPriceCents: z.string().regex(CENTS_PATTERN, APP_MESSAGES.validation.centsString)
      .transform((value) => BigInt(value)).refine((value) => value > 0n, APP_MESSAGES.validation.positive)
      .refine((value) => value <= POSTGRES_BIGINT_MAX, APP_MESSAGES.validation.maxCents),
    minIncrementCents: z.string().regex(CENTS_PATTERN, APP_MESSAGES.validation.centsString)
      .transform((value) => BigInt(value)).refine((value) => value > 0n, APP_MESSAGES.validation.positive)
      .refine((value) => value <= POSTGRES_BIGINT_MAX, APP_MESSAGES.validation.maxCents),
    startAt: z.coerce.date(APP_MESSAGES.validation.invalidDateType),
    endAt: z.coerce.date(APP_MESSAGES.validation.invalidDateType),
  })
  .refine((v: { endAt: Date; startAt: Date }) => v.endAt > v.startAt, { message: APP_MESSAGES.validation.endAfterStart, path: ["endAt"] })
  .refine((v: { endAt: Date }) => v.endAt > new Date(), { message: APP_MESSAGES.validation.futureDate, path: ["endAt"] });

// Públicas (vitrine e sala)
lotsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q } = z.object({
      q: z.string().trim().max(100, APP_MESSAGES.validation.maxQuery).optional(),
    }).parse(req.query);
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
    const id = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.id);
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
    const id = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.id);
    await service.cancelLot(id, req.user!.id);
    res.status(204).end();
  })
);