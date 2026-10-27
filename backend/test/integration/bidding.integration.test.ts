import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool";
import {
  ARTWORK,
  createLot,
  getTestEnv,
  request,
  setupTestEnv,
  teardownTestEnv,
} from "./helpers";

before(setupTestEnv);
after(teardownTestEnv);

test("lote agendado não aceita lances antes da hora", async () => {
  const { ana, auctioneer } = getTestEnv();
  const now = Date.now();
  const lot = await createLot({
    startAt: new Date(now + 5 * 60_000).toISOString(),
    endAt: new Date(now + 15 * 60_000).toISOString(),
  });
  assert.equal(lot.status, "scheduled");
  assert.match(lot.startAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.match(lot.endAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(new Date(lot.startAt).getTime(), Date.parse(new Date(now + 5 * 60_000).toISOString()));

  const beforeCancel = await request("/lots");
  assert.equal(beforeCancel.status, 200);
  assert.equal(
    (beforeCancel.body.scheduled as { id: string }[]).some((item) => item.id === lot.id),
    true
  );

  const bid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: "50000" },
  });
  assert.equal(bid.status, 400);
  assert.equal(bid.body.error, "LOT_NOT_STARTED");

  await pool.query("UPDATE lots SET start_at = clock_timestamp() - interval '1 second' WHERE id = $1", [lot.id]);
  const liveLot = await request(`/lots/${lot.id}`);
  assert.equal(liveLot.body.status, "live");

  const cancel = await request(`/lots/${lot.id}/cancel`, {
    method: "POST",
    token: auctioneer.token,
  });
  assert.equal(cancel.status, 204);

  const showcase = await request("/lots");
  assert.equal(showcase.status, 200);
  const visible = [
    ...showcase.body.live,
    ...showcase.body.scheduled,
    ...showcase.body.ended,
  ] as { id: string }[];
  assert.equal(visible.some((item) => item.id === lot.id), false);
});

test("lances: mínimo, líder, saldo, superação e histórico pseudónimo", async () => {
  const { ana, bruno, auctioneer } = getTestEnv();
  const lot = await createLot();
  assert.equal(lot.status, "live");

  const showcase = await request("/lots");
  assert.equal(showcase.status, 200);
  assert.equal(
    (showcase.body.live as { id: string }[]).some((item) => item.id === lot.id),
    true
  );

  const tooLowFirst = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: "49999" },
  });
  assert.equal(tooLowFirst.status, 400);
  assert.equal(tooLowFirst.body.error, "BID_BELOW_MINIMUM");
  assert.match(tooLowFirst.body.message, /mínimo/);
  assert.equal(tooLowFirst.body.details.minCents, "50000");

  const first = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: "50000" },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.sequence, 1);
  assert.equal(first.body.extended, false);
  assert.equal(first.body.wallet.committedCents, "50000");
  assert.equal(first.body.wallet.availableCents, "450000");

  const ownBid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: "60000" },
  });
  assert.equal(ownBid.status, 400);
  assert.equal(ownBid.body.error, "ALREADY_LEADING");
  assert.match(ownBid.body.message, /ganhando/);

  const belowIncrement = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: "50000" },
  });
  assert.equal(belowIncrement.status, 400);
  assert.equal(belowIncrement.body.error, "BID_BELOW_MINIMUM");
  assert.equal(belowIncrement.body.details.minCents, "55000");

  const noBalance = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: "900000" },
  });
  assert.equal(noBalance.status, 400);
  assert.equal(noBalance.body.error, "INSUFFICIENT_BALANCE");
  assert.match(noBalance.body.message, /Saldo insuficiente/);
  assert.equal(noBalance.body.details.availableCents, "500000");

  const second = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: "55000" },
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.sequence, 2);
  assert.equal(second.body.wallet.committedCents, "55000");

  const anaWallet = await request("/wallet", { token: ana.token });
  assert.equal(anaWallet.status, 200);
  assert.equal(anaWallet.body.committedCents, "0");
  assert.equal(anaWallet.body.availableCents, "500000");

  const third = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: "60000" },
  });
  assert.equal(third.status, 201);
  assert.equal(third.body.sequence, 3);

  const room = await request(`/lots/${lot.id}/room`);
  assert.equal(room.status, 200);
  assert.equal(room.body.lot.currentBidCents, "60000");
  assert.equal(room.body.bids.length, 3);
  assert.equal(room.body.myPosition, "none");
  for (const bid of room.body.bids) {
    assert.match(bid.bidder, /^Licitante #[A-Z0-9]+$/);
  }
  assert.equal(JSON.stringify(room.body).includes(ana.user.email), false);
  assert.equal(JSON.stringify(room.body).includes(ana.user.name), false);

  const anaRoom = await request(`/lots/${lot.id}/room`, { token: ana.token });
  assert.equal(anaRoom.body.myPosition, "leading");

  const brunoRoom = await request(`/lots/${lot.id}/room`, { token: bruno.token });
  assert.equal(brunoRoom.body.myPosition, "outbid");

  const cancel = await request(`/lots/${lot.id}/cancel`, {
    method: "POST",
    token: auctioneer.token,
  });
  assert.equal(cancel.status, 204);

  const cancelledLot = await request(`/lots/${lot.id}`);
  assert.equal(cancelledLot.status, 404);

  const showcaseAfterCancel = await request("/lots");
  assert.equal(showcaseAfterCancel.status, 200);
  const stillVisible = [
    ...showcaseAfterCancel.body.live,
    ...showcaseAfterCancel.body.scheduled,
    ...showcaseAfterCancel.body.ended,
  ] as { id: string }[];
  assert.equal(stillVisible.some((item) => item.id === lot.id), false);

  const myBids = await request("/my/bids", { token: ana.token });
  assert.equal(myBids.status, 200);
  assert.equal(
    (myBids.body as { lotId: string }[]).some((item) => item.lotId === lot.id),
    false
  );

  const refunded = await request("/wallet", { token: ana.token });
  assert.equal(refunded.body.totalCents, "500000");
  assert.equal(refunded.body.committedCents, "0");
  assert.equal(refunded.body.availableCents, "500000");
});

test("mesma obra pode ser publicada novamente (sem regra extra no enunciado)", async () => {
  const lot = await createLot({
    startAt: new Date(Date.now() + 3_600_000).toISOString(),
    endAt: new Date(Date.now() + 7_200_000).toISOString(),
  });
  assert.equal(lot.status, "scheduled");
  assert.equal(lot.title, ARTWORK.title);
});

test("lances antigos com a representação histórica continuam íntegros", async () => {
  const lot = await createLot();
  const { ana, bruno } = getTestEnv();
  for (const [session, amountCents] of [[ana, "50000"], [bruno, "55000"]] as const) {
    const result = await request(`/lots/${lot.id}/bids`, {
      method: "POST",
      token: session.token,
      body: { amountCents },
    });
    assert.equal(result.status, 201);
  }
  const audit = await request(`/audit/${lot.id}`);
  assert.equal(audit.body.valid, true);
  assert.equal(audit.body.bids.length, 2);
});

test("lances paralelos no primeiro lugar mantêm saldo e líder consistentes", async () => {
  const { ana, bruno } = getTestEnv();
  const [anaBefore, brunoBefore] = await Promise.all([
    request("/wallet", { token: ana.token }),
    request("/wallet", { token: bruno.token }),
  ]);
  const lot = await createLot();
  const attempts = await Promise.all([
    request(`/lots/${lot.id}/bids`, {
      method: "POST",
      token: ana.token,
      body: { amountCents: "50000" },
    }),
    request(`/lots/${lot.id}/bids`, {
      method: "POST",
      token: bruno.token,
      body: { amountCents: "50000" },
    }),
  ]);

  assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 400]);
  const rejected = attempts.find((result) => result.status === 400);
  assert.equal(rejected?.body.error, "BID_BELOW_MINIMUM");

  const room = await request(`/lots/${lot.id}/room`);
  assert.equal(room.body.bids.length, 1);
  assert.equal(room.body.lot.currentBidCents, "50000");

  const wallets = await Promise.all([
    request("/wallet", { token: ana.token }),
    request("/wallet", { token: bruno.token }),
  ]);
  const initialCommitted = BigInt(anaBefore.body.committedCents) + BigInt(brunoBefore.body.committedCents);
  const finalCommitted = BigInt(wallets[0].body.committedCents) + BigInt(wallets[1].body.committedCents);
  assert.equal(finalCommitted - initialCommitted, 50_000n);
});

test("anti-sniping: lance nos últimos 2 minutos prorroga o fim", async () => {
  const { ana } = getTestEnv();
  const now = Date.now();
  const lot = await createLot({
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 60_000).toISOString(),
  });

  const originalEnd = new Date(lot.endAt).getTime();
  const bid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: "50000" },
  });
  assert.equal(bid.status, 201);
  assert.equal(bid.body.extended, true);
  assert.ok(new Date(bid.body.endAt).getTime() > originalEnd);
});
