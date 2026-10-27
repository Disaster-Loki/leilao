import test, { after, before } from "node:test";
import assert from "node:assert/strict";
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
    startAt: new Date(now + 3_600_000).toISOString(),
    endAt: new Date(now + 7_200_000).toISOString(),
  });
  assert.equal(lot.status, "scheduled");

  const beforeCancel = await request("/lots");
  assert.equal(beforeCancel.status, 200);
  assert.equal(
    (beforeCancel.body.scheduled as { id: string }[]).some((item) => item.id === lot.id),
    true
  );

  const bid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(bid.status, 400);
  assert.equal(bid.body.error, "LOT_NOT_STARTED");

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
    body: { amountCents: 49_999 },
  });
  assert.equal(tooLowFirst.status, 400);
  assert.equal(tooLowFirst.body.error, "BID_BELOW_MINIMUM");
  assert.equal(tooLowFirst.body.details.minCents, 50_000);

  const first = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.sequence, 1);
  assert.equal(first.body.extended, false);
  assert.equal(first.body.wallet.committedCents, 50_000);
  assert.equal(first.body.wallet.availableCents, 450_000);

  const ownBid = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: 60_000 },
  });
  assert.equal(ownBid.status, 400);
  assert.equal(ownBid.body.error, "ALREADY_LEADING");

  const belowIncrement = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: 50_000 },
  });
  assert.equal(belowIncrement.status, 400);
  assert.equal(belowIncrement.body.error, "BID_BELOW_MINIMUM");
  assert.equal(belowIncrement.body.details.minCents, 55_000);

  const noBalance = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: 900_000 },
  });
  assert.equal(noBalance.status, 400);
  assert.equal(noBalance.body.error, "INSUFFICIENT_BALANCE");
  assert.equal(noBalance.body.details.availableCents, 500_000);

  const second = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: bruno.token,
    body: { amountCents: 55_000 },
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.sequence, 2);
  assert.equal(second.body.wallet.committedCents, 55_000);

  const anaWallet = await request("/wallet", { token: ana.token });
  assert.equal(anaWallet.status, 200);
  assert.equal(anaWallet.body.committedCents, 0);
  assert.equal(anaWallet.body.availableCents, 500_000);

  const third = await request(`/lots/${lot.id}/bids`, {
    method: "POST",
    token: ana.token,
    body: { amountCents: 60_000 },
  });
  assert.equal(third.status, 201);
  assert.equal(third.body.sequence, 3);

  const room = await request(`/lots/${lot.id}/room`);
  assert.equal(room.status, 200);
  assert.equal(room.body.lot.currentBidCents, 60_000);
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
  assert.equal(refunded.body.totalCents, 500_000);
  assert.equal(refunded.body.committedCents, 0);
  assert.equal(refunded.body.availableCents, 500_000);
});

test("mesma obra pode ser publicada novamente (sem regra extra no enunciado)", async () => {
  const lot = await createLot({
    startAt: new Date(Date.now() + 3_600_000).toISOString(),
    endAt: new Date(Date.now() + 7_200_000).toISOString(),
  });
  assert.equal(lot.status, "scheduled");
  assert.equal(lot.title, ARTWORK.title);
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
    body: { amountCents: 50_000 },
  });
  assert.equal(bid.status, 201);
  assert.equal(bid.body.extended, true);
  assert.ok(new Date(bid.body.endAt).getTime() > originalEnd);
});
