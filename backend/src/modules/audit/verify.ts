import { computeBidHash, GENESIS } from "../bids/hash";

export interface AuditBidRow {
  bidder_id: string;
  sequence: number;
  amount_cents: string | number;
  created_at: Date;
  prev_hash: string;
  hash: string;
}

export interface AuditLotRow {
  head_hash: string;
  bid_count: number;
  current_bid_cents: string | number | null;
  leader_id: string | null;
  settled_at: Date | null;
}

export interface AuditReceiptRow {
  final_hash: string;
  amount_cents: string | number;
}

export interface AuditSaleRow {
  amount_cents: string | number;
}

export interface AuditIssue {
  sequence: number | null;
  code: string;
}

/**
 * Verificação pura da cadeia de lances + âncoras do lote + comprovante/venda.
 * Fica separada do acesso ao banco para poder ser testada sem PostgreSQL.
 */
export function verifyBidChain(input: {
  lotId: string;
  lot: AuditLotRow;
  bids: AuditBidRow[];
  receipt?: AuditReceiptRow;
  sale?: AuditSaleRow;
}): AuditIssue[] {
  const { lotId, lot, bids, receipt, sale } = input;
  const issues: AuditIssue[] = [];

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
      amountCents: BigInt(b.amount_cents),
      createdAt: b.created_at,
    });
    if (expected !== b.hash) issues.push({ sequence: b.sequence, code: "HASH_MISMATCH" });
    prev = b.hash;
  });

  const last = bids[bids.length - 1];

  // 2. Compara com o que o lote guardou (apanha remoção do último lance)
  if (prev !== lot.head_hash) issues.push({ sequence: null, code: "HEAD_HASH_MISMATCH" });
  if (bids.length !== lot.bid_count) issues.push({ sequence: null, code: "BID_COUNT_MISMATCH" });
  if (last) {
    if (BigInt(last.amount_cents) !== BigInt(lot.current_bid_cents!))
      issues.push({ sequence: last.sequence, code: "CURRENT_BID_MISMATCH" });
    if (last.bidder_id !== lot.leader_id)
      issues.push({ sequence: last.sequence, code: "LEADER_MISMATCH" });
  }

  // 3. Compara com o comprovante e com o movimento financeiro
  if (lot.settled_at && bids.length > 0) {
    if (!receipt) {
      issues.push({ sequence: null, code: "RECEIPT_MISSING" });
    } else {
      if (receipt.final_hash !== prev)
        issues.push({ sequence: null, code: "RECEIPT_HASH_MISMATCH" });
      if (last && BigInt(receipt.amount_cents) !== BigInt(last.amount_cents))
        issues.push({ sequence: null, code: "RECEIPT_AMOUNT_MISMATCH" });
    }
    if (!sale || (last && BigInt(sale.amount_cents) !== BigInt(last.amount_cents)))
      issues.push({ sequence: null, code: "SETTLEMENT_MISMATCH" });
  }

  return issues;
}
