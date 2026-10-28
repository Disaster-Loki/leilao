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
  MIN_DEPOSIT_REAIS: z.string().regex(/^(0|[1-9]\d*)$/).default("1"),
  MAX_DEPOSIT_REAIS: z.string().regex(/^(0|[1-9]\d*)$/).default("1000000000"),
  MAX_WALLET_REAIS: z.string().regex(/^(0|[1-9]\d*)$/).default("9223372036854775807"),
});

const parsed = schema.parse(process.env);
const minDepositReais = BigInt(parsed.MIN_DEPOSIT_REAIS);
const maxDepositReais = BigInt(parsed.MAX_DEPOSIT_REAIS);
const maxWalletReais = BigInt(parsed.MAX_WALLET_REAIS);
const postgresBigintMax = 9_223_372_036_854_775_807n;
if (minDepositReais < 1n || maxDepositReais < minDepositReais || maxWalletReais < maxDepositReais || maxWalletReais > postgresBigintMax) {
  throw new Error("Invalid monetary limits: require 1 <= MIN_DEPOSIT_REAIS <= MAX_DEPOSIT_REAIS <= MAX_WALLET_REAIS <= BIGINT_MAX");
}
export const env = {
  ...parsed,
  MIN_DEPOSIT_REAIS: minDepositReais,
  MAX_DEPOSIT_REAIS: maxDepositReais,
  MAX_WALLET_REAIS: maxWalletReais,
};
