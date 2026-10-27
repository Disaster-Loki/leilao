import "dotenv/config";
import { z } from "zod";

if (process.env.TZ !== "UTC") {
  process.env.TZ = "UTC";
}

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  HMAC_SECRET: z.string().min(8),
  FRONTEND_URL: z.string().min(1),
  MIN_DEPOSIT_CENTS: z.string().regex(/^(0|[1-9]\d*)$/).default("1"),
  MAX_DEPOSIT_CENTS: z.string().regex(/^(0|[1-9]\d*)$/).default("100000000000"),
  MAX_WALLET_CENTS: z.string().regex(/^(0|[1-9]\d*)$/).default("9223372036854775807"),
});

const parsed = schema.parse(process.env);
const minDepositCents = BigInt(parsed.MIN_DEPOSIT_CENTS);
const maxDepositCents = BigInt(parsed.MAX_DEPOSIT_CENTS);
const maxWalletCents = BigInt(parsed.MAX_WALLET_CENTS);
const postgresBigintMax = 9_223_372_036_854_775_807n;
if (minDepositCents < 1n || maxDepositCents < minDepositCents || maxWalletCents < maxDepositCents || maxWalletCents > postgresBigintMax) {
  throw new Error("Invalid monetary limits: require 1 <= MIN_DEPOSIT_CENTS <= MAX_DEPOSIT_CENTS <= MAX_WALLET_CENTS <= BIGINT_MAX");
}
export const env = {
  ...parsed,
  MIN_DEPOSIT_CENTS: minDepositCents,
  MAX_DEPOSIT_CENTS: maxDepositCents,
  MAX_WALLET_CENTS: maxWalletCents,
};