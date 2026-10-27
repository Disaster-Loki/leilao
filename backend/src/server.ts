import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { settleDueLots } from "./modules/settlement/settlement.service";

const server = app.listen(env.PORT);

// Liquidação periódica. A liquidação preguiçosa cobre o caso do servidor ter estado a dormir.
const settlementTimer = setInterval(() => {
  settleDueLots().catch(() => undefined);
}, 10_000);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  clearInterval(settlementTimer);

  const forceExit = setTimeout(() => {
    server.closeAllConnections?.();
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    clearTimeout(forceExit);
    try {
      await pool.end();
    } catch {
      // Ignora falha ao encerrar o pool.
    }
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
