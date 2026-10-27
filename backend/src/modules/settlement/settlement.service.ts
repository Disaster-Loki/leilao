import { pool } from "../../db/pool";

// Liquida um lote vencido. Idempotente: pode ser chamada quantas vezes e por quantos
// pedidos em simultâneo quiser, só a primeira tem efeito.
export async function settleLot(lotId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT auctioneer_id, leader_id, current_bid_cents, bid_count, head_hash,
              end_at, settled_at, cancelled_at, clock_timestamp() AS now
         FROM lots WHERE id = $1 FOR UPDATE`,
      [lotId]
    );
    const lot = rows[0];

    // Nada a fazer: não existe, cancelado, já liquidado ou ainda não terminou
    if (!lot || lot.cancelled_at || lot.settled_at || lot.now < lot.end_at) {
      await client.query("ROLLBACK");
      return;
    }

    // Sem lances: fecha sem vencedor
    if (lot.bid_count === 0) {
      await client.query("UPDATE lots SET settled_at = $2 WHERE id = $1", [lotId, lot.now]);
      await client.query("COMMIT");
      return;
    }

    const amount = BigInt(lot.current_bid_cents);
    if (amount <= 0n) throw new Error("invalid settlement amount");
    const amountCents = amount.toString();

    // Mesma ordem de bloqueio dos lances (por id), para não haver deadlock
    await client.query(
      `SELECT user_id FROM wallets WHERE user_id = ANY($1::uuid[]) ORDER BY user_id FOR UPDATE`,
      [[lot.leader_id, lot.auctioneer_id]]
    );

    // Vencedor: sai do total e do comprometido
    const paid = await client.query(
      `UPDATE wallets
          SET total_cents = total_cents - $1, committed_cents = committed_cents - $1
        WHERE user_id = $2`,
      [amountCents, lot.leader_id]
    );
    // Leiloeiro: recebe
    const received = await client.query(
      "UPDATE wallets SET total_cents = total_cents + $1 WHERE user_id = $2",
      [amountCents, lot.auctioneer_id]
    );
    if (paid.rowCount === 0 || received.rowCount === 0) throw new Error("wallet missing in settlement");

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents, lot_id) VALUES
         ($1, 'purchase', -$3::bigint, $4),
         ($2, 'sale',      $3::bigint, $4)`,
      [lot.leader_id, lot.auctioneer_id, amountCents, lotId]
    );

    await client.query(
      `INSERT INTO receipts (lot_id, winner_id, amount_cents, final_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [lotId, lot.leader_id, amountCents, lot.head_hash, lot.now]
    );

    await client.query("UPDATE lots SET settled_at = $2 WHERE id = $1", [lotId, lot.now]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Liquida todos os lotes vencidos (usado pelo agendador e pela liquidação preguiçosa)
export async function settleDueLots(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id FROM lots
      WHERE settled_at IS NULL AND cancelled_at IS NULL AND end_at <= now()
      LIMIT 50`
  );
  for (const r of rows) await settleLot(r.id);
}