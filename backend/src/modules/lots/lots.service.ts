import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { getArtwork } from "../external/artic.client";
import { settleDueLots } from "../settlement/settlement.service";
import { centsToString } from "../../money";

// Estado calculado pelo relógio do banco (modelo híbrido)
export const STATUS_SQL = `
  CASE
    WHEN cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN now() < start_at THEN 'scheduled'
    WHEN now() < end_at THEN 'live'
    ELSE 'ended'
  END`;

const PUBLIC_COLUMNS = `
  id, title, artist, date_display, medium, image_url, attributes,
  start_price_cents, min_increment_cents, start_at, end_at,
  current_bid_cents, bid_count, settled_at,
  ${STATUS_SQL} AS status,
  now() AS server_now`;

function mapLot(r: any) {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    dateDisplay: r.date_display,
    medium: r.medium,
    imageUrl: r.image_url,
    attributes: r.attributes,
    startPriceCents: centsToString(r.start_price_cents),
    minIncrementCents: centsToString(r.min_increment_cents),
    startAt: r.start_at,
    endAt: r.end_at,
    currentBidCents: r.current_bid_cents === null ? null : centsToString(r.current_bid_cents),
    bidCount: r.bid_count,
    settledAt: r.settled_at,
    status: r.status as "scheduled" | "live" | "ended" | "cancelled",
    serverNow: r.server_now, // o front usa isto na contagem regressiva
  };
}

export async function createLot(
  auctioneerId: string,
  input: {
    externalId: string;
    startPriceCents: bigint;
    minIncrementCents: bigint;
    startAt: Date;
    endAt: Date;
  }
) {
  // Única chamada à API externa: snapshot dos dados do item
  const art = await getArtwork(input.externalId);

  const { rows } = await pool.query(
    `INSERT INTO lots
       (auctioneer_id, external_id, title, artist, date_display, medium,
        image_url, attributes, start_price_cents, min_increment_cents, start_at, end_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      auctioneerId, art.externalId, art.title, art.artist, art.dateDisplay, art.medium,
      art.imageUrl, JSON.stringify(art.attributes),
      input.startPriceCents.toString(), input.minIncrementCents.toString(), input.startAt, input.endAt,
    ]
  );
  return mapLot(rows[0]);
}

// Vitrine pública: nunca devolve cancelados
export async function listShowcase(search?: string) {
  await settleDueLots();
  const params: unknown[] = [];
  let where = "cancelled_at IS NULL";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (title ILIKE $1 OR artist ILIKE $1 OR medium ILIKE $1)`;
  }
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM lots WHERE ${where} ORDER BY end_at ASC`,
    params
  );
  const lots = rows.map(mapLot);
  return {
    live: lots.filter((l) => l.status === "live"),
    scheduled: lots.filter((l) => l.status === "scheduled"),
    ended: lots.filter((l) => l.status === "ended").reverse(), // mais recentes primeiro
  };
}

export async function getLot(id: string) {
  await settleDueLots();
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM lots WHERE id = $1 AND cancelled_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw new AppError(404, "LOT_NOT_FOUND");
  return mapLot(rows[0]);
}

// Painel do leiloeiro: os seus lotes (incluindo cancelados) e resultados
export async function listMine(auctioneerId: string) {
  await settleDueLots();
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM lots WHERE auctioneer_id = $1 ORDER BY created_at DESC`,
    [auctioneerId]
  );
  const lots = rows.map(mapLot);
  const totalReceivedCents = lots
    .filter((l) => l.settledAt && l.currentBidCents)
    .reduce((sum, l) => sum + BigInt(l.currentBidCents ?? "0"), 0n);
  return { lots, totalReceivedCents: totalReceivedCents.toString() };
}

export async function cancelLot(lotId: string, auctioneerId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Mesmo lock que os lances usam — cancelar e dar lance não se atropelam
    const { rows } = await client.query(
      `SELECT auctioneer_id, bid_count, cancelled_at, settled_at,
              leader_id, current_bid_cents FROM lots WHERE id = $1 FOR UPDATE`,
      [lotId]
    );
    const lot = rows[0];
    if (!lot) throw new AppError(404, "LOT_NOT_FOUND");
    if (lot.auctioneer_id !== auctioneerId) throw new AppError(403, "FORBIDDEN");
    if (lot.cancelled_at) throw new AppError(409, "LOT_ALREADY_CANCELLED");
    if (lot.settled_at) throw new AppError(409, "LOT_ALREADY_SETTLED");

    // Estorno automático: devolve o valor comprometido ao licitante líder
    if (lot.leader_id && lot.current_bid_cents) {
      await client.query(
        "UPDATE wallets SET committed_cents = committed_cents - $1 WHERE user_id = $2",
        [String(lot.current_bid_cents), lot.leader_id]
      );
    }

    await client.query("UPDATE lots SET cancelled_at = now() WHERE id = $1", [lotId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

