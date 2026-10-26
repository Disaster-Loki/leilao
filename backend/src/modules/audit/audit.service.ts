import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { computeBidHash, GENESIS, pseudonym } from "../bids/hash";
import { STATUS_SQL } from "../lots/lots.service";
import { settleDueLots } from "../settlement/settlement.service";

type Issue = { sequence: number | null; code: string };

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

  const issues: Issue[] = [];

  // 1. Recalcula a cadeia inteira
  let prev = GENESIS;
  bids.forEach((b, i) => {
    if (b.sequence !== i + 1) issues.push({ sequence: b.sequence, code: "SEQUENCE_GAP" });
    if (b.prev_hash !== prev) issues.push({ sequence: b.sequence, code: "PREV_HASH_MISMATCH" });
    const expected = computeBidHash({
      prevHash: b.prev_hash,
      lotId,
      sequence: b.sequence,
      bidderId: b.bidder_id,
      amountCents: Number(b.amount_cents),
      createdAt: b.created_at,
    });
    if (expected !== b.hash) issues.push({ sequence: b.sequence, code: "HASH_MISMATCH" });
    prev = b.hash;
  });

  // 2. Compara com o que o lote guardou (apanha remoção do último lance)
  const last = bids[bids.length - 1];
  if (prev !== lot.head_hash) issues.push({ sequence: null, code: "HEAD_HASH_MISMATCH" });
  if (bids.length !== lot.bid_count) issues.push({ sequence: null, code: "BID_COUNT_MISMATCH" });
  if (last) {
    if (Number(last.amount_cents) !== Number(lot.current_bid_cents))
      issues.push({ sequence: last.sequence, code: "CURRENT_BID_MISMATCH" });
    if (last.bidder_id !== lot.leader_id)
      issues.push({ sequence: last.sequence, code: "LEADER_MISMATCH" });
  }

  // 3. Compara com o comprovante e com o movimento financeiro
  if (lot.settled_at && bids.length > 0) {
    if (!receipt) issues.push({ sequence: null, code: "RECEIPT_MISSING" });
    else {
      if (receipt.final_hash !== prev) issues.push({ sequence: null, code: "RECEIPT_HASH_MISMATCH" });
      if (last && Number(receipt.amount_cents) !== Number(last.amount_cents))
        issues.push({ sequence: null, code: "RECEIPT_AMOUNT_MISMATCH" });
    }
    if (!sale || (last && Number(sale.amount_cents) !== Number(last.amount_cents)))
      issues.push({ sequence: null, code: "SETTLEMENT_MISMATCH" });
  }

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
      amountCents: Number(b.amount_cents),
      createdAt: b.created_at,
      bidder: pseudonym(b.bidder_id, lotId),
      prevHash: b.prev_hash,
      hash: b.hash,
    })),
  };
}