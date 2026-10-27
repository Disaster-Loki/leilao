
import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { settleDueLots } from "./modules/settlement/settlement.service";

const server = app.listen(env.PORT);

let settlementTimer: ReturnType<typeof setInterval> | undefined;
let shuttingDown = false;

// Só mostra a porta depois de o servidor começar a escutar com sucesso.
server.on("listening", () => {
  const address = server.address();

  if (address && typeof address !== "string") {
    console.log(`✅ API iniciada na porta ${address.port}`);
    console.log(`🌐 URL: http://localhost:${address.port}`);
  }

  // Liquidação periódica.
  // A liquidação preguiçosa cobre o caso de o servidor ter estado a dormir.
  settlementTimer = setInterval(() => {
    settleDueLots().catch(() => undefined);
  }, 10_000);
});

// Trata erros durante o arranque do servidor.
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `❌ A porta ${env.PORT} já está em uso. ` +
        "Encerra o processo que a ocupa ou define outra porta na variável PORT.",
    );
  } else {
    console.error(
      "❌ Não foi possível iniciar o servidor:",
      error.message,
    );
  }

  if (settlementTimer) {
    clearInterval(settlementTimer);
    settlementTimer = undefined;
  }

  void pool.end().finally(() => {
    process.exitCode = 1;
  });
});

// Encerramento seguro do servidor.
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n⏳ ${signal} recebido. A encerrar a API...`);

  if (settlementTimer) {
    clearInterval(settlementTimer);
    settlementTimer = undefined;
  }

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
      // Ignora falhas ao encerrar o pool.
    }

    console.log("✅ API encerrada com sucesso.");
    process.exit(0);
  });

  server.closeIdleConnections?.();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
