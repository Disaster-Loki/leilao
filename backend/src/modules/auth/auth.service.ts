import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error";
import type { Role } from "../../middleware/auth";

function signToken(id: string, role: Role) {
  return jwt.sign({ id, role }, env.JWT_SECRET, { expiresIn: "7d" });
}

export async function register(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, input.name, passwordHash, input.role]
    );
    const user = rows[0];

    // Todo utilizador ganha carteira (o leiloeiro recebe valores de vendas nela)
    await client.query("INSERT INTO wallets (user_id) VALUES ($1)", [user.id]);

    await client.query("COMMIT");
    return { user, token: signToken(user.id, user.role) };
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") throw new AppError(409, "EMAIL_ALREADY_EXISTS");
    throw err;
  } finally {
    client.release();
  }
}

export async function login(emailRaw: string, password: string) {
  const { rows } = await pool.query(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
    [emailRaw.toLowerCase()]
  );
  const row = rows[0];
  // Mesma resposta para "email não existe" e "senha errada": não revela quais emails existem
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS");
  }
  const { password_hash, ...user } = row;
  return { user, token: signToken(user.id, user.role) };
}

export async function getMe(id: string) {
  const { rows } = await pool.query(
    "SELECT id, email, name, role FROM users WHERE id = $1",
    [id]
  );
  if (!rows[0]) throw new AppError(404, "USER_NOT_FOUND");
  return rows[0];
}