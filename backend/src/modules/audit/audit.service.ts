import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { pseudonym } from "../bids/hash";
import { STATUS_SQL } from "../lots/lots.service";
import { settleDueLots } from "../settlement/settlement.service";
import { verifyBidChain } from "./verify";
import { centsToString } from "../../money";

export async function auditLot(lotId: string) {
  await settleDueLots();

  const client = await pool.connect();
  let lot: any, bids: any[], receipt: any, sale: any;
  try {
    // Snapshot consistente: sem isto, um lance a entrar durante a leitura
    // faria a auditoria acusar adulteração falsa
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    lot = (
      await client.query(
        `SELECT id, title, head_hash, bid_count, current_bid_cents, leader_id,
                settled_at, ${STATUS_SQL} AS status
           FROM lots WHERE id = $1`,
        [lotId]
      )
    ).rows[0];
    if (!lot) throw new AppError(404, "LOT_NOT_FOUND");

    bids = (
      await client.query(
        `SELECT bidder_id, sequence, amount_cents, created_at, prev_hash, hash
           FROM bids WHERE lot_id = $1 ORDER BY sequence ASC`,
        [lotId]
      )
    ).rows;
    receipt = (
      await client.query("SELECT final_hash, amount_cents FROM receipts WHERE lot_id = $1", [lotId])
    ).rows[0];
    sale = (
      await client.query(
        "SELECT amount_cents FROM wallet_transactions WHERE lot_id = $1 AND type = 'sale'",
        [lotId]
      )
    ).rows[0];
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const issues = verifyBidChain({ lotId, lot, bids, receipt, sale });

  return {
    lotId,
    title: lot.title,
    status: lot.status as string,
    valid: issues.length === 0,
    firstFailure: issues[0] ?? null,
    issues,
    bidCount: bids.length,
    headHash: lot.head_hash as string,
    bids: bids.map((b) => ({
      sequence: b.sequence,
      amountCents: centsToString(b.amount_cents),
      createdAt: b.created_at,
      bidder: pseudonym(b.bidder_id, lotId),
      prevHash: b.prev_hash,
      hash: b.hash,
    })),
  };
}