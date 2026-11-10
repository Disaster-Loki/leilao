import { pool } from "../../db/pool";
import { settleLot } from "./settlement.service";

const BATCH_SIZE = 50;
const DEFAULT_INTERVAL_MS = 10_000;

// Liquida todos os lotes vencidos. Só deve ser chamado pelo job (ou por testes),
// nunca pelo caminho de leitura: GETs não podem escrever no banco.
export async function settleDueLots(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id FROM lots
      WHERE settled_at IS NULL AND cancelled_at IS NULL AND end_at <= now()
      ORDER BY end_at ASC
      LIMIT $1`,
    [BATCH_SIZE]
  );
  for (const row of rows) await settleLot(row.id);
}

export function startSettlementJob(intervalMs = DEFAULT_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    settleDueLots().catch((err) => {
      console.error("❌ Falha na liquidação de lotes:", err);
    });
  }, intervalMs);

  timer.unref?.();

  return () => clearInterval(timer);
}
