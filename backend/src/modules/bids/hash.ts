import { createHmac } from "crypto";
import { env } from "../../config/env";

function hmac(data: string) {
  return createHmac("sha256", env.HMAC_SECRET).update(data).digest("hex");
}

export const GENESIS = "GENESIS";

export function computeBidHash(i: {
  prevHash: string;
  lotId: string;
  sequence: number;
  bidderId: string;
  amountReais: number | bigint | string;
  createdAt: Date;
}) {
  // JSON de um array: formato sem ambiguidade (não dá para "deslocar" campos)
  return hmac(
    JSON.stringify([
      i.prevHash,
      i.lotId,
      i.sequence,
      i.bidderId,
      String(i.amountReais),
      i.createdAt.toISOString(),
    ])
  );
}

// "Licitante #A7F3C2": estável dentro de um lote, diferente entre lotes,
// e impossível de reverter sem o segredo
export function pseudonym(userId: string, lotId: string) {
  return `Licitante #${hmac(`pseudo:${userId}:${lotId}`).slice(0, 6).toUpperCase()}`;
}