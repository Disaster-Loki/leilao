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

// A origem permitida vem exclusivamente de FRONTEND_URL. Normaliza para a
// origem (sem path nem barra final), para tolerar URLs como ".../login" ou ".../".
function toOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

const allowedOrigin = toOrigin(env.FRONTEND_URL);

app.use(cors({
  origin: (origin, cb) => {
    // permitir chamadas sem origin (curl, Postman, SSR)
    if (!origin || origin === allowedOrigin) return cb(null, true);
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

app.get("/time", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT clock_timestamp() AS server_now");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ serverNow: rows[0].server_now });
}));

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