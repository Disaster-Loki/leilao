import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { settleDueLots } from "./modules/settlement/settlement.service";

const server = app.listen(env.PORT, () => console.log(`API on :${env.PORT}`));

// Liquidação periódica. A liquidação preguiçosa cobre o caso do servidor ter estado a dormir.
const settlementTimer = setInterval(() => {
  settleDueLots().catch((e) => console.error("settlement:", e));
}, 10_000);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} recebido, a encerrar…`);

  clearInterval(settlementTimer);

  const forceExit = setTimeout(() => {
    console.error("Encerramento demorou demasiado, a forçar saída.");
    server.closeAllConnections?.();
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    clearTimeout(forceExit);
    try {
      await pool.end();
    } catch (err) {
      console.error("Erro ao fechar o pool:", err);
    }
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
