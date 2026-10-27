import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { errorMessage, formatMoney, parseMoney } from "../lib/utils";
import type { Wallet as WalletData } from "../types";
import Icon from "../components/Icon";

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<WalletData>("/wallet")
      .then(setWallet)
      .catch((e) => setMsg({ ok: false, text: errorMessage(e) }))
      .finally(() => setLoading(false));
  }, []);

  async function deposit(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents) {
      setMsg({ ok: false, text: "Informe um valor válido, ex: 500,00" });
      return;
    }
    try {
      const w = await api<WalletData>("/wallet/deposit", {
        method: "POST",
        body: JSON.stringify({ amountCents: cents }),
      });
      setWallet(w);
      setMsg({ ok: true, text: `Depósito de ${formatMoney(cents)} realizado!` });
      setAmount("");
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    }
  }

  return (
    <div className="page-wrap">
      <h1>Carteira</h1>

      {loading ? (
        <p className="muted">Carregando…</p>
      ) : wallet ? (
        <div className="wallet-stats">
          <div className="stat-card card">
            <p className="stat-label muted"><Icon name="wallet" size={13} /> Saldo Total</p>
            <p className="stat-value">{formatMoney(wallet.totalCents)}</p>
          </div>
          <div className="stat-card card">
            <p className="stat-label muted"><Icon name="lock" size={13} /> Comprometido</p>
            <p className="stat-value">{formatMoney(wallet.committedCents)}</p>
            <p className="stat-hint muted">Reservado nos seus lances vencedores</p>
          </div>
          <div className="stat-card card stat-card-highlight">
            <p className="stat-label muted"><Icon name="check" size={13} /> Disponível</p>
            <p className="stat-value">{formatMoney(wallet.availableCents)}</p>
            <p className="stat-hint muted">Pode usar em novos lances</p>
          </div>
        </div>
      ) : null}

      {/*
      <div className="wallet-explain card">
        <h2>Como funciona</h2>
        <ul>
          <li>
            <strong>Comprometido:</strong> quando você lidera um lote, o valor do
            seu lance fica reservado. Se for superado, volta imediatamente ao
            disponível.
          </li>
          <li>
            <strong>Disponível:</strong> saldo que pode usar agora (Total −
            Comprometido).
          </li>
          <li>
            <strong>Liquidação:</strong> ao ganhar um lote, o valor é debitado do
            total e creditado ao leiloeiro.
          </li>
        </ul>
      </div>
      */}

      {user?.role === "bidder" ? (
        <div className="deposit-form card">
          <h2>Depósito simulado</h2>
          <p className="muted">
            Isto é um leilão de demonstração — o saldo é fictício.
          </p>
          <form onSubmit={deposit} className="form">
            <div className="field">
              <label htmlFor="deposit-amount">Valor a depositar (R$)</label>
              <input
                id="deposit-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500,00"
                inputMode="decimal"
              />
            </div>
            <div className="quick-amounts">
              {[500, 1000, 5000, 10000].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  onClick={() => setAmount((v).toFixed(2).replace(".", ","))}
                >
                  {formatMoney(v * 100)}
                </button>
              ))}
            </div>
            <button className="btn btn-primary">Depositar</button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ padding: "1rem" }}>
          <p className="muted">
            Como leiloeiro, você recebe aqui o valor dos lotes vendidos.
          </p>
        </div>
      )}

      {msg && (
        <p className={msg.ok ? "msg msg-ok" : "msg msg-err"}>{msg.text}</p>
      )}
    </div>
  );
}
