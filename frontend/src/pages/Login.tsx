import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../lib/utils";
import type { Role } from "../types";
import Icon from "../components/Icon";

// Regras de senha — espelham o Zod do backend
const PASSWORD_RULES = [
  { id: "len",     label: "Mínimo 8 caracteres",          test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "Uma letra maiúscula (A-Z)",     test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Uma letra minúscula (a-z)",     test: (p: string) => /[a-z]/.test(p) },
  { id: "number",  label: "Um número (0-9)",               test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "Um carácter especial (!@#$%…)", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
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
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand-panel">
          <Link to="/" className="brand auth-brand">
            <span className="brand-mark">CL</span>
            <span className="brand-copy">
              <span className="brand-text">Casa de Leilões</span>
              <span className="brand-tag">Arte · ao vivo</span>
            </span>
          </Link>

          <div className="auth-brand-body">
            <span className="auth-eyebrow">Leilões de arte online</span>
            <h1>
              Onde grandes obras encontram <span className="hero-accent">novos colecionadores.</span>
            </h1>
            <p>
              Disputas em tempo real com total transparência: saldo reservado de
              forma segura e cada lance registado numa cadeia de hashes
              verificável.
            </p>

            <ul className="auth-features">
              <li>
                <span className="auth-feature-icon"><Icon name="bolt" size={17} /></span>
                <div>
                  <strong>Lances em tempo real</strong>
                  <span>Prorrogação automática nos últimos minutos.</span>
                </div>
              </li>
              <li>
                <span className="auth-feature-icon"><Icon name="lock" size={17} /></span>
                <div>
                  <strong>Saldo comprometido</strong>
                  <span>O valor só é reservado enquanto está a ganhar.</span>
                </div>
              </li>
              <li>
                <span className="auth-feature-icon"><Icon name="receipt" size={17} /></span>
                <div>
                  <strong>Histórico auditável</strong>
                  <span>Comprovante e auditoria de cada arremate.</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="auth-brand-stats">
            <div><strong>100%</strong><span>domínio público</span></div>
            <div><strong>+2 min</strong><span>extensão anti-snipe</span></div>
            <div><strong>SHA-256</strong><span>cadeia de lances</span></div>
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="auth-form-top">
            <span className="auth-form-kicker">
              {isRegister ? "Criar conta" : "Bem-vindo de volta"}
            </span>
          </div>

          <div className="auth-form-head">
            <h2>{isRegister ? "Comece a licitar hoje" : "Entrar na sua conta"}</h2>
            <p className="muted">
              {isRegister
                ? "Leva menos de um minuto. Depois escolha a sua primeira obra."
                : "Aceda à vitrine, aos seus lances e à carteira."}
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
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="reg-role">Tipo de conta</label>
                  <select
                    id="reg-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    <option value="bidder">Licitante — dou lances</option>
                    <option value="auctioneer">Leiloeiro — crio lotes</option>
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
                  <Icon name={showPwd ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
              {isRegister && password.length > 0 && (
                <PasswordStrength password={password} />
              )}
            </div>

            {error && <p className="msg msg-err">{error}</p>}

            <button
              className="btn btn-primary btn-block auth-submit"
              disabled={busy || (isRegister && !pwdValid)}
            >
              {busy
                ? "Aguarde…"
                : isRegister
                ? "Criar conta gratuita"
                : "Entrar na conta"}
            </button>
          </form>

          <p className="auth-switch muted">
            {isRegister ? "Já tem conta? " : "Não tem conta? "}
            <button type="button" className="link-btn" onClick={switchMode}>
              {isRegister ? "Fazer login" : "Criar conta"}
            </button>
          </p>

          <div className="auth-demo">
            <p className="auth-demo-label">
              <span>Contas de demonstração</span>
            </p>
            <div className="demo-chips">
              <button type="button" className="chip"
                onClick={() => fillDemo("leiloeiro@leilao.com", "Leilao@123")}>
                Leiloeiro
              </button>
              <button type="button" className="chip"
                onClick={() => fillDemo("ana@leilao.com", "Leilao@123")}>
                Ana
              </button>
              <button type="button" className="chip"
                onClick={() => fillDemo("bruno@leilao.com", "Leilao@123")}>
                Bruno
              </button>
            </div>
            <Link to="/" className="auth-guest-link">
              Ver vitrine sem entrar →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
