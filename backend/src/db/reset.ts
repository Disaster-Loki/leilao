/**
 * Limpa completamente a base de dados (schema public) antes de migrar e semear.
 * Usado pelo docker compose e disponível como `npm run reset`.
 */
import { Client } from "pg";
import { env } from "../config/env";
import { sslFor } from "./ssl";

async function reset() {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: sslFor(env.DATABASE_URL),
  });

  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()`
    );
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }
}

reset().catch(() => {
  process.exit(1);
});
