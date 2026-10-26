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
const allowedOrigins = [
  env.FRONTEND_URL,
  // aceitar também a porta de dev quando FRONTEND_URL aponta para preview
  env.FRONTEND_URL.replace(":4173", ":5173"),
  env.FRONTEND_URL.replace(":5173", ":4173"),
].filter((v, i, arr) => arr.indexOf(v) === i);

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