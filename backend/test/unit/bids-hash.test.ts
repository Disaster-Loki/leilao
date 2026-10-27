import test from "node:test";
import assert from "node:assert/strict";
import { computeBidHash, GENESIS, pseudonym } from "../../src/modules/bids/hash";

const base = {
  prevHash: GENESIS,
  lotId: "lot-1",
  sequence: 1,
  bidderId: "user-1",
  amountCents: 100_000,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

test("o hash é determinístico para o mesmo lance", () => {
  assert.equal(computeBidHash(base), computeBidHash({ ...base }));
});

test("alterar o valor invalida o hash", () => {
  assert.notEqual(computeBidHash(base), computeBidHash({ ...base, amountCents: 100_001 }));
});

test("alterar o licitante invalida o hash", () => {
  assert.notEqual(computeBidHash(base), computeBidHash({ ...base, bidderId: "user-2" }));
});

test("alterar o timestamp invalida o hash", () => {
  assert.notEqual(
    computeBidHash(base),
    computeBidHash({ ...base, createdAt: new Date("2026-01-01T00:00:01.000Z") })
  );
});

test("o pseudónimo é estável dentro do lote e diferente entre lotes", () => {
  const a = pseudonym("user-1", "lot-1");
  assert.equal(a, pseudonym("user-1", "lot-1"));
  assert.notEqual(a, pseudonym("user-1", "lot-2"));
  assert.notEqual(a, pseudonym("user-2", "lot-1"));
});

test("o pseudónimo não expõe o id do utilizador", () => {
  const p = pseudonym("user-1", "lot-1");
  assert.match(p, /^Licitante #[0-9A-F]{6}$/);
  assert.ok(!p.includes("user-1"));
});
