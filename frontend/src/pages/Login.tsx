import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/utils";
import type { Role } from "../types";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("bidder");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await register({ name, email, password, role });
      navigate(user.role === "auctioneer" ? "/panel" : "/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">🏛</span>
          <h1 className="auth-title">Casa de Leilões</h1>
          <p className="muted auth-sub">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta grátis"}
          </p>
        </div>

        <form onSubmit={submit} className="form">
          {mode === "register" && (
            <>
              <div className="field">
                <label htmlFor="reg-name">Nome completo</label>
                <input
                  id="reg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  minLength={2}
                />
              </div>
              <div className="field">
                <label htmlFor="reg-role">Tipo de conta</label>
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="bidder">🙋 Licitante (dar lances)</option>
                  <option value="auctioneer">🔨 Leiloeiro (criar lotes)</option>
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">
              Senha{mode === "register" && <span className="muted" style={{fontWeight:400}}> — mín. 8 caracteres, 1 letra e 1 número</span>}
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Ex: Leilao123" : "••••••••"}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </div>

          {error && <p className="msg msg-err">{error}</p>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="auth-switch muted">
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "Criar conta" : "Fazer login"}
          </a>
        </p>

        <div className="auth-demo">
          <p className="muted">Contas de demonstração:</p>
          <div className="demo-chips">
            <button
              type="button"
              className="chip"
              onClick={() => { setEmail("leiloeiro@leilao.com"); setPassword("Leilao123"); setMode("login"); }}
            >
              🔨 Leiloeiro
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => { setEmail("ana@leilao.com"); setPassword("Leilao123"); setMode("login"); }}
            >
              🙋 Ana
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => { setEmail("bruno@leilao.com"); setPassword("Leilao123"); setMode("login"); }}
            >
              🙋 Bruno
            </button>
          </div>
          <Link to="/" className="muted" style={{ fontSize: "0.85rem" }}>
            Ver vitrine sem entrar →
          </Link>
        </div>
      </div>
    </div>
  );
}
