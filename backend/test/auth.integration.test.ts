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

test("autenticação: duplicado, senha errada e sessão atual", async () => {
  const { ana } = getTestEnv();

  const duplicate = await request("/auth/register", {
    method: "POST",
    body: { email: "ana@teste.com", name: "Outra Ana", password: PASSWORD, role: "bidder" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "EMAIL_ALREADY_EXISTS");

  const wrong = await request("/auth/login", {
    method: "POST",
    body: { email: "ana@teste.com", password: "errada" },
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, "INVALID_CREDENTIALS");

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

  const depositAttempt = await request("/wallet/deposit", {
    method: "POST",
    token: auctioneer.token,
    body: { amountCents: 10_000 },
  });
  assert.equal(depositAttempt.status, 403);
  assert.equal(depositAttempt.body.error, "FORBIDDEN");

  const bidAttempt = await request(
    "/lots/00000000-0000-4000-8000-000000000000/bids",
    {
      method: "POST",
      token: auctioneer.token,
      body: { amountCents: 50_000 },
    }
  );
  assert.equal(bidAttempt.status, 403);
  assert.equal(bidAttempt.body.error, "FORBIDDEN");
});
