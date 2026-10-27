import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { settleDueLots } from "../settlement/settlement.service";
import { env } from "../../config/env";
import { centsToString } from "../../money";

export async function getWallet(userId: string) {
  await settleDueLots();
  const { rows } = await pool.query(
    "SELECT total_cents, committed_cents FROM wallets WHERE user_id = $1",
    [userId]
  );
  if (!rows[0]) throw new AppError(404, "WALLET_NOT_FOUND");

  const total = BigInt(rows[0].total_cents);
  const committed = BigInt(rows[0].committed_cents);
  return {
    totalCents: centsToString(total),
    committedCents: centsToString(committed),
    availableCents: centsToString(total - committed),
  };
}

export async function deposit(userId: string, amountCents: bigint) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT total_cents FROM wallets WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (!rows[0]) throw new AppError(404, "WALLET_NOT_FOUND");
    if (BigInt(rows[0].total_cents) + amountCents > env.MAX_WALLET_CENTS) {
      throw new AppError(400, "WALLET_ABOVE_MAXIMUM");
    }
    await client.query(
      "UPDATE wallets SET total_cents = total_cents + $1 WHERE user_id = $2",
      [amountCents.toString(), userId]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents)
       VALUES ($1, 'deposit', $2)`,
      [userId, amountCents.toString()]
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