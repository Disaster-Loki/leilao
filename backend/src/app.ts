import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { pool } from "./db/pool";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  const { rows } = await pool.query("SELECT now() AS now");
  res.json({ ok: true, dbTime: rows[0].now });
});