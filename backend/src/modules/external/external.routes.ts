import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../../middleware/error";
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

/*
 * Proxy de imagens do Art Institute (fallback de compatibilidade).
 * O AIC bloqueia hotlink via Cloudflare e também desafia IPs de datacenter,
 * por isso as imagens novas são resolvidas no Wikimedia Commons. Este proxy
 * mantém a compatibilidade com lotes antigos e faz cache no servidor.
 */
const ALLOWED_IMAGE_HOSTS = new Set(["www.artic.edu", "artic.edu"]);
const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_CACHE_MAX = 120;
const imageCache = new Map<string, { at: number; type: string; body: Buffer }>();

async function fetchImage(src: string) {
  const cached = imageCache.get(src);
  if (cached && Date.now() - cached.at < IMAGE_CACHE_TTL_MS) return cached;

  const res = await fetch(src, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.artic.edu/",
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!res || !res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    throw new AppError(502, "IMAGE_UNAVAILABLE");
  }

  const body = Buffer.from(await res.arrayBuffer());
  const entry = {
    at: Date.now(),
    type: res.headers.get("content-type") ?? "image/jpeg",
    body,
  };

  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
  imageCache.set(src, entry);
  return entry;
}

externalRouter.get(
  "/image",
  asyncHandler(async (req, res) => {
    const { src } = z.object({ src: z.string().url().max(600) }).parse(req.query);
    const url = new URL(src);
    if (!ALLOWED_IMAGE_HOSTS.has(url.hostname) || !url.pathname.startsWith("/iiif/2/")) {
      throw new AppError(400, "INVALID_IMAGE_URL");
    }

    const image = await fetchImage(url.toString());
    res.setHeader("Content-Type", image.type);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    // helmet define same-origin por padrão; a imagem é consumida pelo front noutra porta
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(image.body);
  })
);