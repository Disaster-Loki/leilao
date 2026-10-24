import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";

export async function getWallet(userId: string) {
  const { rows } = await pool.query(
    "SELECT total_cents, committed_cents FROM wallets WHERE user_id = $1",
    [userId]
  );
  if (!rows[0]) throw new AppError(404, "WALLET_NOT_FOUND");

  const total = Number(rows[0].total_cents);
  const committed = Number(rows[0].committed_cents);
  return {
    totalCents: total,
    committedCents: committed,
    availableCents: total - committed,
  };
}

export async function deposit(userId: string, amountCents: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      "UPDATE wallets SET total_cents = total_cents + $1 WHERE user_id = $2",
      [amountCents, userId]
    );
    if (rowCount === 0) throw new AppError(404, "WALLET_NOT_FOUND");

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents)
       VALUES ($1, 'deposit', $2)`,
      [userId, amountCents]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getWallet(userId);
}