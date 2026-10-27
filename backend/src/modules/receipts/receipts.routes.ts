import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import { APP_MESSAGES } from "../../messages";
import * as service from "./receipts.service";

export const receiptsRouter = Router();
export const myRouter = Router();

// Pública: o link do comprovante pode ser partilhado
receiptsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.id);
    res.json(await service.getReceipt(id));
  })
);

myRouter.get(
  "/bids",
  requireAuth,
  requireRole("bidder"),
  asyncHandler(async (req, res) => {
    res.json(await service.listMyBids(req.user!.id));
  })
);