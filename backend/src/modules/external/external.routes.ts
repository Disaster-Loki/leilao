import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error";
import { requireAuth, requireRole } from "../../middleware/auth";
import { searchArtworks } from "./artic.client";

export const externalRouter = Router();

externalRouter.get(
  "/artworks",
  requireAuth,
  requireRole("auctioneer"),
  asyncHandler(async (req, res) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(req.query);
    res.json(await searchArtworks(q));
  })
);