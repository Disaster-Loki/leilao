import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { pseudonym } from "../bids/hash";
import { STATUS_SQL } from "../lots/lots.service";
import { settleDueLots } from "../settlement/settlement.service";
import { centsToString } from "../../money";

// Comprovante público (link partilhável). Sem dados pessoais: o vencedor é um pseudónimo.
export async function getReceipt(id: string) {
  const { rows } = await pool.query(
    `SELECT r.id, r.amount_cents, r.final_hash, r.created_at, r.winner_id,
            l.id AS lot_id, l.title, l.artist, l.image_url, l.bid_count
       FROM receipts r JOIN lots l ON l.id = r.lot_id
      WHERE r.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) throw new AppError(404, "RECEIPT_NOT_FOUND");
  return {
    id: r.id,
    lotId: r.lot_id,
    title: r.title,
    artist: r.artist,
    imageUrl: r.image_url,
    amountCents: centsToString(r.amount_cents),
    bidCount: r.bid_count,
    winner: pseudonym(r.winner_id, r.lot_id),
    finalHash: r.final_hash,
    issuedAt: r.created_at,
  };
}

// "Meus arremates": todos os lotes em que o utilizador deu lance
export async function listMyBids(userId: string) {
  await settleDueLots();
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.artist, l.image_url, l.end_at, l.current_bid_cents,
            l.leader_id, l.bid_count,
            ${STATUS_SQL} AS status,
            (SELECT max(amount_cents) FROM bids b WHERE b.lot_id = l.id AND b.bidder_id = $1) AS my_best,
            r.id AS receipt_id
       FROM lots l
       LEFT JOIN receipts r ON r.lot_id = l.id
      WHERE l.cancelled_at IS NULL
        AND EXISTS (SELECT 1 FROM bids b WHERE b.lot_id = l.id AND b.bidder_id = $1)
      ORDER BY l.end_at DESC`,
    [userId]
  );

  return rows.map((r) => {
    const mine = r.leader_id === userId;
    const ended = r.status === "ended";
    return {
      lotId: r.id,
      title: r.title,
      artist: r.artist,
      imageUrl: r.image_url,
      status: r.status as "scheduled" | "live" | "ended",
      endAt: r.end_at,
      currentBidCents: centsToString(r.current_bid_cents),
      myBestCents: centsToString(r.my_best),
      // live: leading/outbid · ended: won/lost
      result: ended ? (mine ? "won" : "lost") : mine ? "leading" : "outbid",
      receiptId: ended && mine ? r.receipt_id : null,
    };
  });
}