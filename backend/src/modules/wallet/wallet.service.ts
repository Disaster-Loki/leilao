import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { settleDueLots } from "../settlement/settlement.service";
import { env } from "../../config/env";
import { reaisToString } from "../../money";

export async function getWallet(userId: string) {
  await settleDueLots();
  const { rows } = await pool.query(
    "SELECT total_reais, committed_reais FROM wallets WHERE user_id = $1",
    [userId]
  );
  if (!rows[0]) throw new AppError(404, "WALLET_NOT_FOUND");

  const total = BigInt(rows[0].total_reais);
  const committed = BigInt(rows[0].committed_reais);
  return {
    totalReais: reaisToString(total),
    committedReais: reaisToString(committed),
    availableReais: reaisToString(total - committed),
  };
}

export async function deposit(userId: string, amountReais: bigint) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT total_reais FROM wallets WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (!rows[0]) throw new AppError(404, "WALLET_NOT_FOUND");
    if (BigInt(rows[0].total_reais) + amountReais > env.MAX_WALLET_REAIS) {
      throw new AppError(400, "WALLET_ABOVE_MAXIMUM");
    }
    await client.query(
      "UPDATE wallets SET total_reais = total_reais + $1 WHERE user_id = $2",
      [amountReais.toString(), userId]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_reais)
       VALUES ($1, 'deposit', $2)`,
      [userId, amountReais.toString()]
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
