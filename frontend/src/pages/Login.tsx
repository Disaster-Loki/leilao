import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/utils";
import type { Role } from "../types";

// Regras de senha — espelham o Zod do backend
const PASSWORD_RULES = [
  { id: "len",     label: "Mínimo 8 caracteres",          test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "Uma letra maiúscula (A-Z)",     test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Uma letra minúscula (a-z)",     test: (p: string) => /[a-z]/.test(p) },
  { id: "number",  label: "Um número (0-9)",               test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "Um carácter especial (!@#$%…)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const pct = (passed / PASSWORD_RULES.length) * 100;
  const color =
    passed <= 1 ? "var(--err)" :
    passed <= 3 ? "var(--warn)" :
    "var(--ok)";

  return (
    <div className="pwd-strength">
      <div className="pwd-bar-track">
        <div
          className="pwd-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <ul className="pwd-rules">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className={`pwd-rule ${ok ? "pwd-rule-ok" : ""}`}>
              <span className="pwd-rule-icon">{ok ? "✓" : "○"}</span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<Role>("bidder");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  // Verifica se todas as regras passam (bloqueia submit no registo)
  const pwdValid = !isRegister || PASSWORD_RULES.every((r) => r.test(password));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (isRegister && !pwdValid) return;
    setError(null);
    setBusy(true);
    try {
      const user = isRegister
        ? await register({ name, email, password, role })
        : await login(email, password);
      navigate(user.role === "auctioneer" ? "/panel" : "/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setError(null);
    setPassword("");
    setMode(isRegister ? "login" : "register");
  }

  function fillDemo(em: string, pw: string) {
    setEmail(em);
    setPassword(pw);
    setMode("login");
    setError(null);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">🏛</span>
          <h1 className="auth-title">Casa de Leilões</h1>
          <p className="muted auth-sub">
            {isRegister ? "Crie sua conta grátis" : "Entre na sua conta"}
          </p>
        </div>

        <form onSubmit={submit} className="form">
          {isRegister && (
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
                  <option value="bidder">🙋 Licitante — deposita e dá lances</option>
                  <option value="auctioneer">🔨 Leiloeiro — cria e gere lotes</option>
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
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Senha</label>
            <div className="pwd-input-wrap">
              <input
                id="auth-password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "Crie uma senha forte" : "••••••••"}
                required
                minLength={isRegister ? 8 : 1}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
            {/* Indicador de força — só no registo e quando há texto */}
            {isRegister && password.length > 0 && (
              <PasswordStrength password={password} />
            )}
          </div>

          {error && <p className="msg msg-err">{error}</p>}

          <button
            className="btn btn-primary btn-block"
            disabled={busy || (isRegister && !pwdValid)}
          >
            {busy
              ? "Aguarde…"
              : isRegister
              ? "Criar conta"
              : "Entrar"}
          </button>
        </form>

        <p className="auth-switch muted">
          {isRegister ? "Já tem conta? " : "Não tem conta? "}
          <a href="#" onClick={(e) => { e.preventDefault(); switchMode(); }}>
            {isRegister ? "Fazer login" : "Criar conta"}
          </a>
        </p>

        <div className="auth-demo">
          <p className="muted">Contas de demonstração:</p>
          <div className="demo-chips">
            <button type="button" className="chip"
              onClick={() => fillDemo("leiloeiro@leilao.com", "Leilao123")}>
              🔨 Leiloeiro
            </button>
            <button type="button" className="chip"
              onClick={() => fillDemo("ana@leilao.com", "Leilao123")}>
              🙋 Ana
            </button>
            <button type="button" className="chip"
              onClick={() => fillDemo("bruno@leilao.com", "Leilao123")}>
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
