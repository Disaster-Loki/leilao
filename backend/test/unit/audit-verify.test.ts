import test from "node:test";
import assert from "node:assert/strict";
import { computeBidHash, GENESIS } from "../../src/modules/bids/hash";
import { verifyBidChain } from "../../src/modules/audit/verify";
import type { AuditBidRow, AuditLotRow } from "../../src/modules/audit/verify";

const LOT_ID = "1a2b3c4d-0000-4000-8000-000000000001";

function fixture() {
  const raw = [
    { bidder_id: "user-1", amount_cents: 100_000, created_at: new Date("2026-01-01T00:00:00.000Z") },
    { bidder_id: "user-2", amount_cents: 110_000, created_at: new Date("2026-01-01T00:01:00.000Z") },
    { bidder_id: "user-1", amount_cents: 120_000, created_at: new Date("2026-01-01T00:02:00.000Z") },
  ];

  const bids: AuditBidRow[] = [];
  let prev = GENESIS;
  raw.forEach((r, i) => {
    const sequence = i + 1;
    const hash = computeBidHash({
      prevHash: prev,
      lotId: LOT_ID,
      sequence,
      bidderId: r.bidder_id,
      amountCents: r.amount_cents,
      createdAt: r.created_at,
    });
    bids.push({ ...r, sequence, prev_hash: prev, hash });
    prev = hash;
  });

  const last = bids[bids.length - 1];
  const lot: AuditLotRow = {
    head_hash: prev,
    bid_count: bids.length,
    current_bid_cents: last.amount_cents,
    leader_id: last.bidder_id,
    settled_at: null,
  };

  return { bids, lot, prev };
}

function codes(issues: { code: string }[]) {
  return issues.map((i) => i.code);
}

test("cadeia íntegra não reporta problemas", () => {
  const { bids, lot } = fixture();
  assert.deepEqual(verifyBidChain({ lotId: LOT_ID, lot, bids }), []);
});

test("alterar o valor de um lance é detetado", () => {
  const { bids, lot } = fixture();
  bids[1] = { ...bids[1], amount_cents: 110_001 };
  const issues = verifyBidChain({ lotId: LOT_ID, lot, bids });
  assert.ok(codes(issues).includes("HASH_MISMATCH"));
});

test("remover o último lance é detetado pelas âncoras do lote", () => {
  const { bids, lot } = fixture();
  const issues = verifyBidChain({ lotId: LOT_ID, lot, bids: bids.slice(0, -1) });
  const c = codes(issues);
  assert.ok(c.includes("HEAD_HASH_MISMATCH"));
  assert.ok(c.includes("BID_COUNT_MISMATCH"));
  assert.ok(c.includes("CURRENT_BID_MISMATCH"));
  assert.ok(c.includes("LEADER_MISMATCH"));
});

test("remover um lance do meio quebra a sequência", () => {
  const { bids, lot } = fixture();
  const issues = verifyBidChain({ lotId: LOT_ID, lot, bids: [bids[0], bids[2]] });
  assert.ok(codes(issues).includes("SEQUENCE_GAP"));
  assert.ok(codes(issues).includes("PREV_HASH_MISMATCH"));
});

test("alterar o valor atual do lote é detetado", () => {
  const { bids, lot } = fixture();
  const issues = verifyBidChain({ lotId: LOT_ID, lot: { ...lot, current_bid_cents: 999_999 }, bids });
  assert.ok(codes(issues).includes("CURRENT_BID_MISMATCH"));
});

test("lote liquidado exige comprovante", () => {
  const { bids, lot } = fixture();
  const issues = verifyBidChain({ lotId: LOT_ID, lot: { ...lot, settled_at: new Date() }, bids });
  assert.ok(codes(issues).includes("RECEIPT_MISSING"));
});

test("comprovante e venda coerentes passam a auditoria", () => {
  const { bids, lot, prev } = fixture();
  const last = bids[bids.length - 1];
  const issues = verifyBidChain({
    lotId: LOT_ID,
    lot: { ...lot, settled_at: new Date() },
    bids,
    receipt: { final_hash: prev, amount_cents: last.amount_cents },
    sale: { amount_cents: last.amount_cents },
  });
  assert.deepEqual(issues, []);
});

test("hash final do comprovante divergente é detetado", () => {
  const { bids, lot } = fixture();
  const last = bids[bids.length - 1];
  const issues = verifyBidChain({
    lotId: LOT_ID,
    lot: { ...lot, settled_at: new Date() },
    bids,
    receipt: { final_hash: "adulterado", amount_cents: last.amount_cents },
    sale: { amount_cents: last.amount_cents },
  });
  assert.ok(codes(issues).includes("RECEIPT_HASH_MISMATCH"));
});

test("valor do comprovante divergente é detetado", () => {
  const { bids, lot, prev } = fixture();
  const last = bids[bids.length - 1];
  const issues = verifyBidChain({
    lotId: LOT_ID,
    lot: { ...lot, settled_at: new Date() },
    bids,
    receipt: { final_hash: prev, amount_cents: BigInt(last.amount_cents) + 1n },
    sale: { amount_cents: last.amount_cents },
  });
  assert.ok(codes(issues).includes("RECEIPT_AMOUNT_MISMATCH"));
});

test("movimento financeiro divergente é detetado", () => {
  const { bids, lot, prev } = fixture();
  const last = bids[bids.length - 1];
  const issues = verifyBidChain({
    lotId: LOT_ID,
    lot: { ...lot, settled_at: new Date() },
    bids,
    receipt: { final_hash: prev, amount_cents: last.amount_cents },
    sale: { amount_cents: BigInt(last.amount_cents) + 1n },
  });
  assert.ok(codes(issues).includes("SETTLEMENT_MISMATCH"));
});
