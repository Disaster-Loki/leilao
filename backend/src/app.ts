import cors from "cors";
import helmet from "helmet";
import express from "express";
import { pool } from "./db/pool";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { lotsRouter } from "./modules/lots/lots.routes";
import { bidsRouter } from "./modules/bids/bids.routes";
import { walletRouter } from "./modules/wallet/wallet.routes";
import { errorHandler, asyncHandler } from "./middleware/error";
import { externalRouter } from "./modules/external/external.routes";
import { receiptsRouter, myRouter } from "./modules/receipts/receipts.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL }));
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
app.use("/lots", lotsRouter);
app.use("/wallet", walletRouter);
app.use("/wallet", walletRouter);
app.use("/receipts", receiptsRouter);
app.use("/external", externalRouter);

// SEMPRE por último
app.use(errorHandler);