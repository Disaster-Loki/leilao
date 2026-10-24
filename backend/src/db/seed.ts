import bcrypt from "bcryptjs";
import { pool } from "./pool";

const PASSWORD = "123456";

const users = [
  { email: "leiloeiro@leilao.com", name: "Leiloeiro Demo", role: "auctioneer", deposit: 0 },
  { email: "ana@leilao.com", name: "Ana Licitante", role: "bidder", deposit: 500_000 },
  { email: "bruno@leilao.com", name: "Bruno Licitante", role: "bidder", deposit: 500_000 },
] as const;

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [u.email, u.name, passwordHash, u.role]
      );

      // Só cria carteira e depósito se o utilizador acabou de ser criado
      if (rows[0]) {
        const id = rows[0].id;
        await client.query(
          "INSERT INTO wallets (user_id, total_cents) VALUES ($1, $2)",
          [id, u.deposit]
        );
        if (u.deposit > 0) {
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount_cents)
             VALUES ($1, 'deposit', $2)`,
            [id, u.deposit]
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log("Seed concluído.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();