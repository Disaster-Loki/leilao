import "dotenv/config";
import { z } from "zod";

if (process.env.TZ !== "UTC") {
  process.env.TZ = "UTC";
}

const centsString = z.string().regex(/^(0|[1-9]\d*)$/);
const legacyReaisString = z.string().regex(/^(0|[1-9]\d*)$/);

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  HMAC_SECRET: z.string().min(8),
  FRONTEND_URL: z.string().min(1),
  MIN_DEPOSIT_CENTS: centsString.optional(),
  MAX_DEPOSIT_CENTS: centsString.optional(),
  MAX_WALLET_CENTS: centsString.optional(),
  // Compatibilidade com deploys antigos que ainda definem limites em reais.
  MIN_DEPOSIT_REAIS: legacyReaisString.optional(),
  MAX_DEPOSIT_REAIS: legacyReaisString.optional(),
  MAX_WALLET_REAIS: legacyReaisString.optional(),
});

const parsed = schema.parse(process.env);

const postgresBigintMax = 9_223_372_036_854_775_807n;

function resolveCents(cents: string | undefined, legacyReais: string | undefined, fallback: bigint) {
  if (cents !== undefined) return BigInt(cents);
  if (legacyReais !== undefined) {
    const converted = BigInt(legacyReais) * 100n;
    return converted > postgresBigintMax ? postgresBigintMax : converted;
  }
  return fallback;
}

const minDepositCents = resolveCents(parsed.MIN_DEPOSIT_CENTS, parsed.MIN_DEPOSIT_REAIS, 100n);
const maxDepositCents = resolveCents(
  parsed.MAX_DEPOSIT_CENTS,
  parsed.MAX_DEPOSIT_REAIS,
  100_000_000_000n
);
const maxWalletCents = resolveCents(
  parsed.MAX_WALLET_CENTS,
  parsed.MAX_WALLET_REAIS,
  9_223_372_036_854_775_807n
);
if (
  minDepositCents < 1n ||
  maxDepositCents < minDepositCents ||
  maxWalletCents < maxDepositCents ||
  maxWalletCents > postgresBigintMax
) {
  throw new Error(
    "Invalid monetary limits: require 1 <= MIN_DEPOSIT_CENTS <= MAX_DEPOSIT_CENTS <= MAX_WALLET_CENTS <= BIGINT_MAX"
  );
}

export const env = {
  ...parsed,
  MIN_DEPOSIT_CENTS: minDepositCents,
  MAX_DEPOSIT_CENTS: maxDepositCents,
  MAX_WALLET_CENTS: maxWalletCents,
};
