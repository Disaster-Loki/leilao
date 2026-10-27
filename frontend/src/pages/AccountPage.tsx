import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../lib/utils";
import Icon from "../components/Icon";

export default function AccountPage() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!currentPassword) {
      setMessage({ ok: false, text: "Informe a senha atual para confirmar as alterações." });
      return;
    }

    const changes: { name?: string; email?: string; newPassword?: string; currentPassword: string } = {
      currentPassword,
    };
    if (name.trim() !== user?.name) changes.name = name.trim();
    if (email.trim().toLowerCase() !== user?.email) changes.email = email.trim();
    if (newPassword) changes.newPassword = newPassword;
    if (Object.keys(changes).length === 1) {
      setMessage({ ok: false, text: "Altere pelo menos um dado da conta." });
      return;
    }

    setBusy(true);
    try {
      const updated = await updateProfile(changes);
      setName(updated.name);
      setEmail(updated.email);
      setCurrentPassword("");
      setNewPassword("");
      setMessage({ ok: true, text: "Dados da conta atualizados com sucesso." });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!currentPassword) {
      setMessage({ ok: false, text: "Informe a senha atual antes de eliminar a conta." });
      return;
    }
    if (!confirm("Tem a certeza de que pretende eliminar a conta? Esta ação não pode ser desfeita.")) return;

    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount(currentPassword);
      navigate("/", { replace: true });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <span className="page-eyebrow">Perfil e segurança</span>
          <h1>A minha conta</h1>
          <p className="muted">Atualize os seus dados pessoais e a senha de acesso.</p>
        </div>
      </header>

      <section className="card" style={{ padding: "clamp(1.25rem, 3vw, 2rem)", maxWidth: 680, margin: "0 auto" }}>
        <form className="form" onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="account-name">Nome</label>
            <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="account-email">E-mail</label>
            <input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="account-new-password">Nova senha <span className="muted">(opcional)</span></label>
            <input id="account-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={100} autoComplete="new-password" placeholder="Deixe em branco para manter a senha atual" />
          </div>
          <div className="field">
            <label htmlFor="account-current-password">Senha atual para confirmar</label>
            <input id="account-current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" />
          </div>
          {message && <p className={message.ok ? "msg msg-ok" : "msg msg-err"}>{message.text}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="check" size={16} /> {busy ? "A guardar…" : "Guardar alterações"}
          </button>
          <p className="muted" style={{ fontSize: ".88rem" }}>
            A senha atual é pedida para confirmar alterações de segurança.
          </p>
          <hr />
          <div>
            <h2>Eliminar conta</h2>
            <p className="muted">Contas com lotes, lances ou movimentos financeiros mantêm-se para preservar o histórico e a auditoria.</p>
            <button className="btn btn-danger" type="button" onClick={removeAccount} disabled={busy}>
              Eliminar a minha conta
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
