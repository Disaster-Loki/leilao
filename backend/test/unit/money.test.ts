import assert from "node:assert/strict";
import test from "node:test";
import { parseReais, reaisToString, POSTGRES_BIGINT_MAX } from "../../src/money";
import { computeBidHash, GENESIS } from "../../src/modules/bids/hash";

const values = [
  "1", "10", "100", "123456", "2147483648", "9007199254740993", "9223372036854775807",
];

for (const value of values) {
  test(`reais ${value} preservam-se em BigInt e JSON string`, () => {
    assert.equal(parseReais(value).toString(), value);
    assert.equal(reaisToString(parseReais(value)), value);
    assert.equal(JSON.stringify({ amountReais: reaisToString(parseReais(value)) }), `{"amountReais":"${value}"}`);
  });
}

test("o limite máximo corresponde ao BIGINT assinado do PostgreSQL", () => {
  assert.equal(POSTGRES_BIGINT_MAX.toString(), "9223372036854775807");
  assert.equal(parseReais("9223372036854775807"), POSTGRES_BIGINT_MAX);
});

test("o limite de negócio padrão por depósito é R$ 1.000.000.000", () => {
  const maxDepositReais = 1_000_000_000n;
  assert.ok(maxDepositReais <= POSTGRES_BIGINT_MAX);
  assert.equal((maxDepositReais + 1n).toString(), "1000000001");
});

test("limites configuráveis distinguem aceitação do máximo e excesso", () => {
  const maximum = 1_000_000_000n;
  const isAllowed = (amount: bigint) => amount >= 1n && amount <= maximum;
  assert.equal(isAllowed(maximum), true);
  assert.equal(isAllowed(maximum + 1n), false);
});

test("a representação histórica do hash é a mesma para number, string e BigInt", () => {
  const base = {
    prevHash: GENESIS,
    lotId: "lot-money-compat",
    sequence: 1,
    bidderId: "bidder-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  assert.equal(
    computeBidHash({ ...base, amountReais: 2147483648 }),
    computeBidHash({ ...base, amountReais: "2147483648" }),
  );
  assert.equal(
    computeBidHash({ ...base, amountReais: 2147483648n }),
    computeBidHash({ ...base, amountReais: "2147483648" }),
  );
});
