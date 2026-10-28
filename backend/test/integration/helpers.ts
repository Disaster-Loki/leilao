import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "pg";
import { app } from "../../src/app";
import { pool } from "../../src/db/pool";

export const PASSWORD = "Leilao@123";

export const ARTWORK = {
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

export const COMMONS_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/test/water-lilies.jpg";

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

const realFetch = globalThis.fetch;
let externalDown = false;
let server: Server | undefined;
let baseUrl = "";

export interface Session {
  token: string;
  user: { id: string; email: string; name: string; role: "auctioneer" | "bidder" };
}

export interface ApiResponse {
  status: number;
  body: any;
}

export interface TestEnv {
  auctioneer: Session;
  ana: Session;
  bruno: Session;
}

let env: TestEnv | undefined;

export function setExternalDown(value: boolean) {
  externalDown = value;
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

export async function request(
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

async function deposit(session: Session, amountReais: string) {
  const res = await request("/wallet/deposit", {
    method: "POST",
    token: session.token,
    body: { amountReais },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
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

export async function setupTestEnv(): Promise<TestEnv> {
  mockFetch();
  await resetDatabase();

  await new Promise<void>((resolvePromise) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server!.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolvePromise();
    });
  });

  const auctioneer = await register("leiloeiro@teste.com", "Leiloeiro Teste", "auctioneer");
  const ana = await register("ana@teste.com", "Ana Teste", "bidder");
  const bruno = await register("bruno@teste.com", "Bruno Teste", "bidder");
  await deposit(ana, "5000");
  await deposit(bruno, "5000");

  env = { auctioneer, ana, bruno };
  return env;
}

export function getTestEnv(): TestEnv {
  if (!env) throw new Error("Ambiente de teste não inicializado.");
  return env;
}

export async function teardownTestEnv() {
  if (server) {
    await new Promise<void>((resolvePromise, reject) => {
      server!.close((err) => (err ? reject(err) : resolvePromise()));
      server!.closeAllConnections?.();
    });
    server = undefined;
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
}

export function auctionPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    externalId: "12345",
    startPriceReais: "500",
    minIncrementReais: "50",
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 3_600_000).toISOString(),
    ...overrides,
  };
}

export async function createLot(overrides: Record<string, unknown> = {}) {
  const { auctioneer } = getTestEnv();
  const res = await request("/lots", {
    method: "POST",
    token: auctioneer.token,
    body: auctionPayload(overrides),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
