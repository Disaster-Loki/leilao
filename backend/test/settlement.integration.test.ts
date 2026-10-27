import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db/pool";
import {
  createLot,
  getTestEnv,
  request,
  setupTestEnv,
  teardownTestEnv,
} from "./helpers";

before(setupTestEnv);
after(teardownTestEnv);

test("liquidação: débito, crédito, comprovante público e auditoria", async () => {
  const { ana, bruno, auctioneer } = getTestEnv();
  const lot = await createLot();

  const bid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(bid.status, 201);

  await pool.query("UPDATE lots SET end_at = now() - interval '1 second' WHERE id = $1", [
    lot.id,
  ]);

  // A leitura da vitrine dispara a liquidação preguiçosa.
  const showcase = await request("/lots");
  assert.equal(showcase.status, 200);

  const settled = await request(`/lots/${lot.id}`);
  assert.equal(settled.status, 200);
  assert.equal(settled.body.status, "ended");
  assert.ok(settled.body.settledAt);

  const endedShowcase = await request("/lots");
  assert.equal(endedShowcase.status, 200);
  assert.equal(
    (endedShowcase.body.ended as { id: string }[]).some((item) => item.id === lot.id),
    true
  );

  const lateBid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(lateBid.status, 400);
  assert.equal(lateBid.body.error, "LOT_ENDED");

  const myBids = await request("/my/bids", { token: bruno.token });
  const won = (myBids.body as { lotId: string; result: string; receiptId: string }[]).find(
    (item) => item.lotId === lot.id
  );
  assert.ok(won);
  assert.equal(won.result, "won");
  assert.ok(won.receiptId);

  const receipt = await request(`/receipts/${won.receiptId}`);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.body.amountCents, 50_000);
  assert.match(receipt.body.winner, /^Licitante #[A-Z0-9]+$/);
  assert.equal(JSON.stringify(receipt.body).includes(bruno.user.email), false);
  assert.equal(JSON.stringify(receipt.body).includes(bruno.user.name), false);

  const brunoWallet = await request("/wallet", { token: bruno.token });
  assert.equal(brunoWallet.status, 200);
  assert.equal(brunoWallet.body.totalCents, 450_000);
  assert.equal(brunoWallet.body.committedCents, 0);
  assert.equal(brunoWallet.body.availableCents, 450_000);

  const auctioneerWallet = await request("/wallet", { token: auctioneer.token });
  assert.equal(auctioneerWallet.status, 200);
  assert.equal(auctioneerWallet.body.totalCents, 50_000);
  assert.equal(auctioneerWallet.body.committedCents, 0);

  const audit = await request(`/audit/${lot.id}`);
  assert.equal(audit.status, 200);
  assert.equal(audit.body.valid, true);
  assert.equal(audit.body.bidCount, 1);
  assert.match(audit.body.bids[0].bidder, /^Licitante #[A-Z0-9]+$/);
  assert.equal(JSON.stringify(audit.body).includes(bruno.user.email), false);
  assert.equal(JSON.stringify(audit.body).includes(bruno.user.name), false);

  const cancelSettled = await request(`/lots/${lot.id}/cancel`, {
    method: "POST",
    token: auctioneer.token,
  });
  assert.equal(cancelSettled.status, 409);
  assert.equal(cancelSettled.body.error, "LOT_ALREADY_SETTLED");
});

test("lote sem lances fecha sem vencedor e sem comprovante", async () => {
  const lot = await createLot();
  await pool.query("UPDATE lots SET end_at = now() - interval '1 second' WHERE id = $1", [
    lot.id,
  ]);

  const showcase = await request("/lots");
  assert.equal(showcase.status, 200);

  const settled = await request(`/lots/${lot.id}`);
  assert.equal(settled.status, 200);
  assert.equal(settled.body.status, "ended");
  assert.ok(settled.body.settledAt);

  const { rows } = await pool.query("SELECT 1 FROM receipts WHERE lot_id = $1", [lot.id]);
  assert.equal(rows.length, 0);

  const audit = await request(`/audit/${lot.id}`);
  assert.equal(audit.status, 200);
  assert.equal(audit.body.valid, true);
  assert.equal(audit.body.bidCount, 0);
});

test("auditoria deteta alteração direta no banco", async () => {
  const { bruno } = getTestEnv();
  const lot = await createLot();

  const bid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(bid.status, 201);

  await pool.query("UPDATE lots SET end_at = now() - interval '1 second' WHERE id = $1", [
    lot.id,
  ]);
  const showcase = await request("/lots");
  assert.equal(showcase.status, 200);

  const beforeTamper = await request(`/audit/${lot.id}`);
  assert.equal(beforeTamper.status, 200);
  assert.equal(beforeTamper.body.valid, true);

  await pool.query(
    "UPDATE bids SET amount_cents = amount_cents + 1 WHERE lot_id = $1 AND sequence = 1",
    [lot.id]
  );

  const tampered = await request(`/audit/${lot.id}`);
  assert.equal(tampered.status, 200);
  assert.equal(tampered.body.valid, false);
  assert.ok(tampered.body.issues.length > 0);
  assert.ok(tampered.body.firstFailure.code);
});
