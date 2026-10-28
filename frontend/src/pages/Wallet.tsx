import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../lib/utils";
import { formatReais, formatReaisInput, parseReais } from "../lib/money";
import type { Wallet as WalletData } from "../types";
import Icon from "../components/Icon";

interface DepositLimits {
  minDepositReais: string;
  maxDepositReais: string;
  maxWalletReais: string;
}

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [depositLimits, setDepositLimits] = useState<DepositLimits | null>(null);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);

  useEffect(() => {
    Promise.all([api<WalletData>("/wallet"), api<DepositLimits>("/wallet/limits")])
      .then(([walletData, limits]) => {
        setWallet(walletData);
        setDepositLimits(limits);
      })
      .catch((error) => setMsg({ ok: false, text: errorMessage(error) }))
      .finally(() => setLoading(false));
  }, []);

  async function deposit(e: FormEvent) {
    e.preventDefault();
    let reais: bigint;
    try {
      reais = parseReais(amount);
    } catch (error) {
      setMsg({ ok: false, text: error instanceof Error ? error.message : "Informe um valor válido, ex: 500" });
      return;
    }

    if (!depositLimits || !wallet) {
      setMsg({ ok: false, text: "Não foi possível carregar os limites da carteira. Tente novamente." });
      return;
    }
    if (reais < BigInt(depositLimits.minDepositReais)) {
      setMsg({ ok: false, text: "O depósito está abaixo do valor mínimo permitido." });
      return;
    }
    if (reais > BigInt(depositLimits.maxDepositReais)) {
      setMsg({ ok: false, text: `O depósito máximo é ${formatReais(depositLimits.maxDepositReais)}.` });
      return;
    }
    if (BigInt(wallet.totalReais) + reais > BigInt(depositLimits.maxWalletReais)) {
      setMsg({ ok: false, text: "Este depósito excederia o saldo máximo permitido na carteira." });
      return;
    }

    setDepositing(true);
    try {
      const updated = await api<WalletData>("/wallet/deposit", {
        method: "POST",
        body: JSON.stringify({ amountReais: reais.toString() }),
      });
      setWallet(updated);
      setMsg({ ok: true, text: `Depósito de ${formatReais(reais)} realizado!` });
      setAmount("");
    } catch (error) {
      setMsg({ ok: false, text: errorMessage(error) });
    } finally {
      setDepositing(false);
    }
  }

  return (
    <div className="page-wrap wallet-page">
      <h1>Carteira</h1>
      <section
        className={`wallet-stats-section ${user?.role === "bidder" ? "wallet-stats-bidder" : "wallet-stats-other"}`}
        aria-label="Resumo da carteira"
      >
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : wallet ? (
          <div className="wallet-stats">
            <div className="stat-card card">
              <p className="stat-label muted"><Icon name="wallet" size={13} /> Saldo Total</p>
              <p className="stat-value">{formatReais(wallet.totalReais)}</p>
            </div>
            {user?.role === "bidder" && (
              <div className="stat-card card">
                <p className="stat-label muted"><Icon name="lock" size={13} /> Comprometido</p>
                <p className="stat-value">{formatReais(wallet.committedReais)}</p>
                <p className="stat-hint muted">Reservado nos seus lances vencedores</p>
              </div>
            )}
            <div className="stat-card card stat-card-highlight">
              <p className="stat-label muted"><Icon name="check" size={13} /> Disponível</p>
              <p className="stat-value">{formatReais(wallet.availableReais)}</p>
              <p className="stat-hint muted">Pode usar em novos lances</p>
            </div>
          </div>
        ) : null}
      </section>

      {user?.role === "bidder" ? (
        <section className="deposit-form card">
          <h2>Depósito simulado</h2>
          <p className="muted">Isto é um leilão de demonstração — o saldo é fictício.</p>
          <form onSubmit={deposit} className="form">
            <div className="field">
              <label htmlFor="deposit-amount">Valor a depositar (R$)</label>
              <input
                id="deposit-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => {
                  try { setAmount(formatReaisInput(parseReais(amount))); } catch { /* manter para correção */ }
                }}
                placeholder="500"
                inputMode="numeric"
              />
            </div>
            {depositLimits && <p className="muted">Depósito máximo: {formatReais(depositLimits.maxDepositReais)}.</p>}
            <div className="quick-amounts">
              {[500n, 1_000n, 5_000n, 10_000n].map((reais) => (
                <button key={reais.toString()} type="button" className="chip" onClick={() => setAmount(formatReaisInput(reais))}>
                  {formatReais(reais)}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={depositing || loading}>
              {depositing ? "Depositando…" : "Depositar"}
            </button>
          </form>
        </section>
      ) : (
        <section className="wallet-receive-info card" />
      )}

      {msg && <p className={msg.ok ? "msg msg-ok" : "msg msg-err"}>{msg.text}</p>}
    </div>
  );
}
