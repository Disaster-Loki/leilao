import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  PASSWORD,
  auctionPayload,
  getTestEnv,
  request,
  setupTestEnv,
  teardownTestEnv,
} from "./helpers";

before(setupTestEnv);
after(teardownTestEnv);

test("health responde e confirma a ligação ao banco", async () => {
  const res = await request("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.dbTime);
});

test("relógio da API devolve um instante ISO UTC com Z", async () => {
  const res = await request("/time");
  assert.equal(res.status, 200);
  assert.match(res.body.serverNow, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("autenticação: duplicado, senha errada e sessão atual", async () => {
  const { ana } = getTestEnv();
  const duplicate = await request("/auth/register", {
    method: "POST",
    body: { email: "ana@teste.com", name: "Outra Ana", password: PASSWORD, role: "bidder" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "EMAIL_ALREADY_EXISTS");
  assert.match(duplicate.body.message, /e-mail/);

  const wrong = await request("/auth/login", {
    method: "POST",
    body: { email: "ana@teste.com", password: "errada" },
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, "INVALID_CREDENTIALS");
  assert.match(wrong.body.message, /senha/);

  const me = await request("/auth/me", { token: ana.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.role, "bidder");
  assert.equal(me.body.email, "ana@teste.com");
});

test("permissões: licitante não cria lote e leiloeiro não deposita", async () => {
  const { ana, auctioneer } = getTestEnv();
  const create = await request("/lots", {
    method: "POST",
    token: ana.token,
    body: auctionPayload(),
  });
  assert.equal(create.status, 403);
  assert.equal(create.body.error, "FORBIDDEN");
  assert.match(create.body.message, /permissão/);

  const depositAttempt = await request("/wallet/deposit", {
    method: "POST",
    token: auctioneer.token,
    body: { amountCents: "10000" },
  });
  assert.equal(depositAttempt.status, 403);
  assert.equal(depositAttempt.body.error, "FORBIDDEN");
  assert.match(depositAttempt.body.message, /permissão/);

  const bidAttempt = await request("/lots/00000000-0000-4000-8000-000000000000/bids", {
    method: "POST",
    token: auctioneer.token,
    body: { amountCents: "50000" },
  });
  assert.equal(bidAttempt.status, 403);
  assert.equal(bidAttempt.body.error, "FORBIDDEN");
  assert.match(bidAttempt.body.message, /permissão/);
});

test("validação e depósito inválido devolvem mensagens em português", async () => {
  const { ana, auctioneer } = getTestEnv();
  const invalidLot = await request("/lots", {
    method: "POST",
    token: auctioneer.token,
    body: { ...auctionPayload(), startPriceCents: "inválido" },
  });
  assert.equal(invalidLot.status, 400);
  assert.equal(invalidLot.body.error, "VALIDATION_ERROR");
  assert.equal(typeof invalidLot.body.message, "string");
  assert.doesNotMatch(invalidLot.body.message, /expected|received|invalid/i);

  const invalidDeposit = await request("/wallet/deposit", {
    method: "POST",
    token: ana.token,
    body: { amountCents: "0" },
  });
  assert.equal(invalidDeposit.status, 400);
  assert.equal(invalidDeposit.body.error, "DEPOSIT_BELOW_MINIMUM");
  assert.equal(invalidDeposit.body.message, "O depósito está abaixo do valor mínimo permitido.");
});

test("depósitos aceitam valores exatos até ao limite BIGINT", async () => {
  for (const cents of ["1", "10000", "2147483647", "2147483648", "100000000000", "9007199254740993", "9223372036854775807"]) {
    const account = await request("/auth/register", {
      method: "POST",
      body: { email: `money-${cents}@teste.com`, name: "Conta Teste", password: PASSWORD, role: "bidder" },
    });
    assert.equal(account.status, 201);
    const response = await request("/wallet/deposit", {
      method: "POST",
      token: account.body.token,
      body: { amountCents: cents },
    });
    assert.equal(response.status, 201, `${cents}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.totalCents, cents);
    assert.equal(typeof response.body.totalCents, "string");
  }
});

test("depósito rejeita number JSON e zeros à esquerda", async () => {
  const { ana } = getTestEnv();
  for (const amountCents of [2147483648, "01"]) {
    const response = await request("/wallet/deposit", {
      method: "POST",
      token: ana.token,
      body: { amountCents },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "VALIDATION_ERROR");
    assert.equal(typeof response.body.message, "string");
  }
});

test("saldo acima do teto configurado é rejeitado sem erro 500", async () => {
  const { ana } = getTestEnv();
  const response = await request("/wallet/deposit", {
    method: "POST",
    token: ana.token,
    body: { amountCents: "9223372036854275808" },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "WALLET_ABOVE_MAXIMUM");
  assert.match(response.body.message, /saldo máximo/);
});