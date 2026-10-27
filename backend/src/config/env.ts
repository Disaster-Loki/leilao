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
});

export const env = schema.parse(process.env);