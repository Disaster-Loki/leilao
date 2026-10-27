import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { auditLot } from "./audit.service";
import { APP_MESSAGES } from "../../messages";

export const auditRouter = Router();

// Pública, sem login
auditRouter.get(
  "/:lotId",
  asyncHandler(async (req, res) => {
    const lotId = z.string().uuid(APP_MESSAGES.validation.invalidUuid).parse(req.params.lotId);
    res.json(await auditLot(lotId));
  })
);