import { Pool } from "pg";
import { env } from "../config/env";
import { sslFor } from "./ssl";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslFor(env.DATABASE_URL),
});