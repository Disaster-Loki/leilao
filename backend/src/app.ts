import cors from "cors";
import helmet from "helmet";
import express from "express";
import { pool } from "./db/pool";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { lotsRouter } from "./modules/lots/lots.routes";
import { bidsRouter } from "./modules/bids/bids.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { walletRouter } from "./modules/wallet/wallet.routes";
import { errorHandler, asyncHandler } from "./middleware/error";
import { externalRouter } from "./modules/external/external.routes";
import { receiptsRouter, myRouter } from "./modules/receipts/receipts.routes";

export const app = express();

app.use(helmet());

// Aceita uma ou várias origens separadas por vírgula. Normaliza para a origem
// (sem path nem barra final), para tolerar URLs como ".../login" ou ".../".
function toOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

const allowedOrigins = [
  ...new Set(
    env.FRONTEND_URL.split(",")
      .map(toOrigin)
      .filter(Boolean)
      .flatMap((origin) => [
        origin,
        // aceitar também a porta de dev quando FRONTEND_URL aponta para preview
        origin.replace(":4173", ":5173"),
        origin.replace(":5173", ":4173"),
      ])
  ),
];

app.use(cors({
  origin: (origin, cb) => {
    // permitir chamadas sem origin (curl, Postman, SSR)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));
app.use(express.json());

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query("SELECT now() AS now");
    res.json({ ok: true, dbTime: rows[0].now });
  })
);

app.use("/my", myRouter);
app.use("/auth", authRouter);
app.use("/lots", lotsRouter);
app.use("/lots", bidsRouter);
app.use("/audit", auditRouter);
app.use("/wallet", walletRouter);
app.use("/receipts", receiptsRouter);
app.use("/external", externalRouter);

// SEMPRE por último
app.use(errorHandler);