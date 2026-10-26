/**
 * Seed: insere utilizadores de teste, carteiras, um lote ao vivo e lances.
 * O PDF do teste exige: "um leiloeiro, dois clientes e ao menos um lote
 * publicado com lances abertos, para que possamos percorrer o fluxo sem
 * montar tudo do zero."
 *
 * Execução: npm run seed (na pasta backend)
 * Idempotente: usa ON CONFLICT DO NOTHING; seguro correr várias vezes.
 */

import bcrypt from "bcryptjs";
import { pool } from "./pool";
import { computeBidHash, GENESIS } from "../modules/bids/hash";

const PASSWORD = "Leilao@123"; // ≥8 chars, maiúscula, minúscula, número e especial

// O AIC bloqueia o hotlink das imagens IIIF via Cloudflare. O Wikimedia
// Commons tem o mesmo quadro em domínio público, servido por um CDN aberto.
const SEED_IMAGE_URL =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Claude_Monet_-_Water_Lilies_-_1933.1157_-_Art_Institute_of_Chicago.jpg/960px-Claude_Monet_-_Water_Lilies_-_1933.1157_-_Art_Institute_of_Chicago.jpg";

const users = [
  {
    email: "leiloeiro@leilao.com",
    name: "Leiloeiro Demo",
    role: "auctioneer",
    deposit: 0,
  },
  {
    email: "ana@leilao.com",
    name: "Ana Licitante",
    role: "bidder",
    deposit: 500_000,
  },
  {
    email: "bruno@leilao.com",
    name: "Bruno Licitante",
    role: "bidder",
    deposit: 500_000,
  },
] as const;

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ids: Record<string, string> = {};

    // ── Utilizadores e carteiras ──────────────────────────────────────────
    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [u.email, u.name, passwordHash, u.role]
      );
      ids[u.role === "auctioneer" ? "auctioneer" : u.email] = rows[0].id;

      // Garante que a carteira existe
      await client.query(
        `INSERT INTO wallets (user_id, total_cents)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [rows[0].id, u.deposit]
      );
      if (u.deposit > 0) {
        // Só regista o depósito se a carteira acabou de ser criada
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount_cents)
           SELECT $1, 'deposit', $2
           WHERE NOT EXISTS (
             SELECT 1 FROM wallet_transactions
             WHERE user_id = $1 AND type = 'deposit'
           )`,
          [rows[0].id, u.deposit]
        );
      }
    }

    // Resgatar os IDs dos licitantes pelo email
    const anaId = ids["ana@leilao.com"];
    const brunoId = ids["bruno@leilao.com"];
    const auctioneerId = ids["auctioneer"];

    // ── Lote ao vivo (começa agora, termina daqui a 2 h) ─────────────────
    const now = new Date();
    const startAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 min atrás
    const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 horas

    // Artwork snapshot da API do Art Institute (Claude Monet - Water Lilies)
    // Só reutiliza um lote que ainda esteja aberto; se o anterior já terminou,
    // cria um novo para o avaliador ter sempre um leilão ao vivo com lances.
    const { rows: existingLot } = await client.query(
      `SELECT id FROM lots
       WHERE external_id = $1 AND auctioneer_id = $2
         AND cancelled_at IS NULL AND settled_at IS NULL AND end_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      ["16568", auctioneerId]
    );

    let lotId: string;

    if (existingLot[0]) {
      lotId = existingLot[0].id;
      // Corrige lotes antigos que apontavam para a imagem bloqueada do AIC.
      await client.query(
        `UPDATE lots
         SET image_url = $1
         WHERE id = $2 AND (image_url IS NULL OR image_url LIKE '%artic.edu%')`,
        [SEED_IMAGE_URL, lotId]
      );
      console.log("Lote já existe, reutilizando:", lotId);
    } else {
      const { rows: lotRows } = await client.query(
        `INSERT INTO lots (
           auctioneer_id, external_id, title, artist, date_display, medium,
           image_url, attributes, start_price_cents, min_increment_cents,
           start_at, end_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          auctioneerId,
          "16568",
          "Water Lilies",
          "Claude Monet",
          "1906",
          "Oil on canvas",
          SEED_IMAGE_URL,
          JSON.stringify({
            place_of_origin: "France",
            dimensions: "89.9 × 94.1 cm (35 3/8 × 37 1/16 in.)",
            medium_display: "Oil on canvas",
          }),
          100_000, // lance inicial: R$ 1.000,00
          10_000,  // incremento: R$ 100,00
          startAt,
          endAt,
        ]
      );
      lotId = lotRows[0].id;
      console.log("Lote criado:", lotId);
    }

    // ── Lances (se o lote ainda não tiver lances) ─────────────────────────
    const { rows: bidCheck } = await client.query(
      "SELECT bid_count FROM lots WHERE id = $1",
      [lotId]
    );

    if (bidCheck[0].bid_count === 0) {
      const bidsToPlace = [
        { bidderId: anaId, amountCents: 100_000 },   // R$ 1.000,00 (lance inicial)
        { bidderId: brunoId, amountCents: 110_000 },  // R$ 1.100,00
        { bidderId: anaId, amountCents: 120_000 },    // R$ 1.200,00 (Ana está ganhando)
      ];

      let prevHash = GENESIS;
      let sequence = 0;
      let leaderId = "";
      let lastAmount = 0;

      for (const bid of bidsToPlace) {
        sequence++;
        const createdAt = new Date(now.getTime() - (bidsToPlace.length - sequence) * 60_000);
        const hash = computeBidHash({
          prevHash,
          lotId,
          sequence,
          bidderId: bid.bidderId,
          amountCents: bid.amountCents,
          createdAt,
        });

        await client.query(
          `INSERT INTO bids (lot_id, bidder_id, sequence, amount_cents, created_at, prev_hash, hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [lotId, bid.bidderId, sequence, bid.amountCents, createdAt, prevHash, hash]
        );

        // Devolve comprometido ao líder anterior
        if (leaderId) {
          await client.query(
            "UPDATE wallets SET committed_cents = committed_cents - $1 WHERE user_id = $2",
            [lastAmount, leaderId]
          );
        }
        // Compromete o novo
        await client.query(
          "UPDATE wallets SET committed_cents = committed_cents + $1 WHERE user_id = $2",
          [bid.amountCents, bid.bidderId]
        );

        prevHash = hash;
        leaderId = bid.bidderId;
        lastAmount = bid.amountCents;
      }

      // Actualiza o lote com o estado dos lances
      await client.query(
        `UPDATE lots
         SET bid_count = $1, current_bid_cents = $2, leader_id = $3, head_hash = $4
         WHERE id = $5`,
        [sequence, lastAmount, leaderId, prevHash, lotId]
      );

      console.log(`${sequence} lances inseridos. Líder: Ana (R$ 1.200,00)`);
    } else {
      console.log("Lote já tem lances, nada inserido.");
    }

    await client.query("COMMIT");
    console.log("\nSeed concluído.\n");
    console.log("Credenciais (senha: Leilao@123):");
    console.log("  Leiloeiro: leiloeiro@leilao.com");
    console.log("  Licitante: ana@leilao.com");
    console.log("  Licitante: bruno@leilao.com");
    console.log(`\nLote ao vivo: /lots/${lotId}`);
    console.log(`Auditoria:    /audit/${lotId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();