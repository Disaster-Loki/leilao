import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "pg";
import { app } from "../src/app";
import { pool } from "../src/db/pool";

const PASSWORD = "Leilao@123";
const RAW_DB_URL = process.env.DATABASE_URL;

if (!RAW_DB_URL) {
  throw new Error("DATABASE_URL não definido. Corra os testes com npm run test:integration.");
}

const DB_URL: string = RAW_DB_URL;
const dbName = decodeURIComponent(new URL(DB_URL).pathname.replace(/^\//, ""));
if (!/test/i.test(dbName)) {
  throw new Error(
    `Recusado: DATABASE_URL aponta para "${dbName}". Use uma base cujo nome contenha "test".`
  );
}

const ARTWORK = {
  id: 12345,
  title: "Obra de Teste",
  artist_display: "Artista de Teste",
  date_display: "1900",
  medium_display: "Óleo sobre tela",
  image_id: "test-image",
  is_public_domain: true,
  place_of_origin: "Portugal",
  dimensions: "100 × 80 cm",
  classification_title: "Pintura",
  main_reference_number: "123.456",
};

const COMMONS_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/test/water-lilies.jpg";

const realFetch = globalThis.fetch;
let externalDown = false;
let server: Server | undefined;
let baseUrl = "";

let auctioneer: Session;
let ana: Session;
let bruno: Session;

interface Session {
  token: string;
  user: { id: string; email: string; name: string; role: "auctioneer" | "bidder" };
}

interface ApiResponse {
  status: number;
  body: any;
}

function mockFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith("https://commons.wikimedia.org/")) {
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              1: {
                index: 1,
                imageinfo: [{ thumburl: `${COMMONS_IMAGE}?width=960` }],
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.startsWith("https://api.artic.edu/")) {
      if (externalDown) throw new TypeError("fetch failed");
      if (url.includes("/artworks/search")) {
        return new Response(JSON.stringify({ data: [ARTWORK] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const match = url.match(/\/artworks\/(\d+)/);
      if (match) {
        return new Response(
          JSON.stringify({ data: { ...ARTWORK, id: Number(match[1]) } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    }

    return realFetch(input, init);
  }) as typeof fetch;
}

async function request(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

async function register(
  email: string,
  name: string,
  role: "auctioneer" | "bidder"
): Promise<Session> {
  const res = await request("/auth/register", {
    method: "POST",
    body: { email, name, password: PASSWORD, role },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body as Session;
}

async function deposit(session: Session, amountCents: number) {
  const res = await request("/wallet/deposit", {
    method: "POST",
    token: session.token,
    body: { amountCents },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
}

function auctionPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    externalId: "12345",
    startPriceCents: 50_000,
    minIncrementCents: 5_000,
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 3_600_000).toISOString(),
    ...overrides,
  };
}

async function createLot(overrides: Record<string, unknown> = {}) {
  const res = await request("/lots", {
    method: "POST",
    token: auctioneer.token,
    body: auctionPayload(overrides),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function resetDatabase() {
  const { runner } = await import("node-pg-migrate");
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }

  await runner({
    databaseUrl: DB_URL,
    dir: resolve(process.cwd(), "migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}

before(async () => {
  mockFetch();
  await resetDatabase();

  await new Promise<void>((resolvePromise) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server!.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolvePromise();
    });
  });

  auctioneer = await register("leiloeiro@teste.com", "Leiloeiro Teste", "auctioneer");
  ana = await register("ana@teste.com", "Ana Teste", "bidder");
  bruno = await register("bruno@teste.com", "Bruno Teste", "bidder");
  await deposit(ana, 500_000);
  await deposit(bruno, 500_000);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolvePromise, reject) => {
      server!.close((err) => (err ? reject(err) : resolvePromise()));
      server!.closeAllConnections?.();
    });
  }

  await pool.end();

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }

  globalThis.fetch = realFetch;
});

test("health responde e confirma a ligação ao banco", async () => {
  const res = await request("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.dbTime);
});

test("autenticação: duplicado, senha errada e sessão atual", async () => {
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

test("API externa: busca protegida e falha isolada da vitrine", async () => {
  const unauthorized = await request("/external/artworks?q=teste");
  assert.equal(unauthorized.status, 401);

  const search = await request("/external/artworks?q=teste", { token: auctioneer.token });
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 1);
  assert.equal(search.body[0].title, ARTWORK.title);

  externalDown = true;
  try {
    const offline = await request("/external/artworks?q=offline", {
      token: auctioneer.token,
    });
    assert.equal(offline.status, 503);
    assert.equal(offline.body.error, "EXTERNAL_API_UNAVAILABLE");

    const showcase = await request("/lots");
    assert.equal(showcase.status, 200);
    assert.ok(Array.isArray(showcase.body.live));
  } finally {
    externalDown = false;
  }
});

test("lote agendado não aceita lances antes da hora", async () => {
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

test("liquidação: débito, crédito, comprovante público e auditoria", async () => {
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

test("mesma obra pode ser publicada novamente (sem regra extra no enunciado)", async () => {
  const lot = await createLot({
    startAt: new Date(Date.now() + 3_600_000).toISOString(),
    endAt: new Date(Date.now() + 7_200_000).toISOString(),
  });
  assert.equal(lot.status, "scheduled");
  assert.equal(lot.title, ARTWORK.title);
});

test("anti-sniping: lance nos últimos 2 minutos prorroga o fim", async () => {
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

test("auditoria deteta alteração direta no banco", async () => {
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
