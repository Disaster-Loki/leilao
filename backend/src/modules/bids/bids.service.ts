import { pool } from "../../db/pool";
import { AppError } from "../../middleware/error";
import { computeBidHash, pseudonym } from "./hash";
import { getLot } from "../lots/lots.service";
import { getWallet } from "../wallet/wallet.service";
import { reaisToString } from "../../money";

const EXTENSION_MS = 2 * 60 * 1000;

export async function placeBid(lotId: string, bidderId: string, amountReais: bigint) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Trava o lote. Quem chegar depois espera aqui.
    // clock_timestamp() e não now(): now() congela no início da transação,
    // o que seria errado para quem esperou pelo lock.
    const { rows } = await client.query(
      `SELECT id, start_price_reais, min_increment_reais, start_at, end_at,
              cancelled_at, current_bid_reais, leader_id, bid_count, head_hash,
              clock_timestamp() AS now
         FROM lots WHERE id = $1 FOR UPDATE`,
      [lotId]
    );
    const lot = rows[0];
    if (!lot || lot.cancelled_at) throw new AppError(404, "LOT_NOT_FOUND");

    // 2. Janela de tempo
    const now: Date = lot.now;
    if (now < lot.start_at) throw new AppError(400, "LOT_NOT_STARTED");
    if (now >= lot.end_at) throw new AppError(400, "LOT_ENDED");

    // 3. O líder não cobre o próprio lance
    if (lot.leader_id === bidderId) throw new AppError(400, "ALREADY_LEADING");

    // 4. Valor mínimo
    const amount = amountReais;
    const minReais =
      lot.bid_count === 0
        ? BigInt(lot.start_price_reais)
        : BigInt(lot.current_bid_reais) + BigInt(lot.min_increment_reais);
    if (amount < minReais) {
      throw new AppError(400, "BID_BELOW_MINIMUM", { minReais: reaisToString(minReais) });
    }

    // 5. Trava as carteiras envolvidas, sempre por ordem de id (evita deadlock)
    const ids = [bidderId, ...(lot.leader_id ? [lot.leader_id] : [])];
    const { rows: wallets } = await client.query(
      `SELECT user_id, total_reais, committed_reais
         FROM wallets WHERE user_id = ANY($1::uuid[]) ORDER BY user_id FOR UPDATE`,
      [ids]
    );
    const mine = wallets.find((w) => w.user_id === bidderId);
    if (!mine) throw new AppError(404, "WALLET_NOT_FOUND");

    const available = BigInt(mine.total_reais) - BigInt(mine.committed_reais);
    if (amount > available) {
      throw new AppError(400, "INSUFFICIENT_BALANCE", { availableReais: reaisToString(available) });
    }

    // 6. Devolve o comprometido ao líder anterior e compromete o novo
    if (lot.leader_id) {
      await client.query(
        "UPDATE wallets SET committed_reais = committed_reais - $1 WHERE user_id = $2",
        [String(lot.current_bid_reais), lot.leader_id]
      );
    }
    await client.query(
      "UPDATE wallets SET committed_reais = committed_reais + $1 WHERE user_id = $2",
      [amount.toString(), bidderId]
    );

    // 7. Grava o lance, encadeado ao anterior
    const sequence = lot.bid_count + 1;
    const prevHash: string = lot.head_hash;
    const hash = computeBidHash({
      prevHash, lotId, sequence, bidderId, amountReais: amount, createdAt: now,
    });
    await client.query(
      `INSERT INTO bids (lot_id, bidder_id, sequence, amount_reais, created_at, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [lotId, bidderId, sequence, amount.toString(), now, prevHash, hash]
    );

    // 8. Atualiza o lote e aplica o anti-sniping, na mesma transação
    const extended = lot.end_at.getTime() - now.getTime() <= EXTENSION_MS;
    const newEnd = extended ? new Date(now.getTime() + EXTENSION_MS) : lot.end_at;
    await client.query(
      `UPDATE lots
          SET current_bid_reais = $1, leader_id = $2, bid_count = $3,
              head_hash = $4, end_at = $5
        WHERE id = $6`,
      [amount.toString(), bidderId, sequence, hash, newEnd, lotId]
    );

    await client.query("COMMIT");

    return {
      sequence,
      amountReais: amount.toString(),
      extended,
      endAt: newEnd,
      lot: await getLot(lotId),
      wallet: await getWallet(bidderId),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Dados da sala: lote + histórico (com pseudónimos) + posição de quem está a ver
export async function getRoom(lotId: string, viewerId?: string) {
  const lot = await getLot(lotId);

  const { rows: lotRows } = await pool.query("SELECT leader_id FROM lots WHERE id = $1", [lotId]);
  const leaderId: string | null = lotRows[0]?.leader_id ?? null;

  const { rows } = await pool.query(
    `SELECT bidder_id, sequence, amount_reais, created_at
       FROM bids WHERE lot_id = $1 ORDER BY sequence DESC`,
    [lotId]
  );

  const bids = rows.map((b) => ({
    sequence: b.sequence,
    amountReais: String(b.amount_reais),
    createdAt: b.created_at,
    bidder: pseudonym(b.bidder_id, lotId),
    isMine: viewerId ? b.bidder_id === viewerId : false,
  }));

  let myPosition: "none" | "leading" | "outbid" = "none";
  if (viewerId) {
    if (leaderId === viewerId) myPosition = "leading";
    else if (bids.some((b) => b.isMine)) myPosition = "outbid";
  }

  return { lot, bids, myPosition };
}