import { createHmac } from "crypto";
import { env } from "../../config/env";

function hmac(data: string) {
  return createHmac("sha256", env.HMAC_SECRET).update(data).digest("hex");
}

export const GENESIS = "GENESIS";

export type HashVersion = 1 | 2;

export const CURRENT_HASH_VERSION: HashVersion = 2;

// v1: lances anteriores à migração para centavos, cujo hash foi calculado em reais.
// v2: lances novos, calculados em centavos.
export function canonicalAmount(amountCents: number | bigint | string, hashVersion: HashVersion) {
  const cents = BigInt(amountCents);
  return (hashVersion === 1 ? cents / 100n : cents).toString();
}

export function computeBidHash(i: {
  prevHash: string;
  lotId: string;
  sequence: number;
  bidderId: string;
  amountCents: number | bigint | string;
  createdAt: Date;
  hashVersion?: HashVersion;
}) {
  const hashVersion = i.hashVersion ?? CURRENT_HASH_VERSION;
  // JSON de um array: formato sem ambiguidade (não dá para "deslocar" campos)
  return hmac(
    JSON.stringify([
      i.prevHash,
      i.lotId,
      i.sequence,
      i.bidderId,
      canonicalAmount(i.amountCents, hashVersion),
      i.createdAt.toISOString(),
    ])
  );
}

// "Licitante #A7F3C2": estável dentro de um lote, diferente entre lotes,
// e impossível de reverter sem o segredo
export function pseudonym(userId: string, lotId: string) {
  return `Licitante #${hmac(`pseudo:${userId}:${lotId}`).slice(0, 6).toUpperCase()}`;
}
