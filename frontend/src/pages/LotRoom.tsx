import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  errorMessage,
  formatMoney,
  formatDateTime,
  parseMoney,
  toInputMoney,
} from "../lib/utils";
import type { Room, Wallet } from "../types";
import Countdown from "../components/Countdown";
import { PLACEHOLDER } from "../components/LotCard";

export default function LotRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastEndRef = useRef<number | null>(null);
  const isBidder = user?.role === "bidder";

  const load = useCallback(async () => {
    try {
      const r = await api<Room>(`/lots/${id}/room`);
      const end = new Date(r.lot.endAt).getTime();
      if (lastEndRef.current !== null && end > lastEndRef.current) {
        setNotice("⏱ Prazo prorrogado +2 min (lance nos últimos 2 minutos).");
      }
      lastEndRef.current = end;
      setRoom(r);
      setLoadError(null);
      if (isBidder) {
        api<Wallet>("/wallet").then(setWallet).catch(() => null);
      }
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id, isBidder]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  if (loadError && !room) {
    return <p className="msg msg-err center-msg">{loadError}</p>;
  }
  if (!room) {
    return <p className="muted center-msg">Carregando…</p>;
  }

  const { lot, bids, myPosition } = room;
  const live = lot.status === "live";
  const ended = lot.status === "ended";
  const minNext =
    lot.bidCount === 0
      ? lot.startPriceCents
      : (lot.currentBidCents ?? 0) + lot.minIncrementCents;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const cents = parseMoney(amount);
    if (!cents) {
      setFeedback({ ok: false, text: "Informe um valor válido, ex: 150,00" });
      return;
    }
    setSending(true);
    try {
      await api(`/lots/${id}/bids`, {
        method: "POST",
        body: JSON.stringify({ amountCents: cents }),
      });
      setFeedback({ ok: true, text: `Lance de ${formatMoney(cents)} aceito! ✓` });
      setAmount("");
      load();
    } catch (err) {
      setFeedback({ ok: false, text: errorMessage(err) });
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="room-layout">
      {/* Coluna esquerda: info da obra */}
      <div className="room-info">
        <img
          className="room-img"
          src={lot.imageUrl ?? PLACEHOLDER}
          alt={lot.title}
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
        <div className="room-meta card">
          <h1 className="room-title">{lot.title}</h1>
          <dl className="attrs">
            {lot.artist && (
              <>
                <dt>Artista</dt>
                <dd>{lot.artist}</dd>
              </>
            )}
            {lot.dateDisplay && (
              <>
                <dt>Data</dt>
                <dd>{lot.dateDisplay}</dd>
              </>
            )}
            {lot.medium && (
              <>
                <dt>Técnica</dt>
                <dd>{lot.medium}</dd>
              </>
            )}
            {typeof lot.attributes.place_of_origin === "string" && (
              <>
                <dt>Origem</dt>
                <dd>{lot.attributes.place_of_origin as string}</dd>
              </>
            )}
            {typeof lot.attributes.dimensions === "string" && (
              <>
                <dt>Dimensões</dt>
                <dd>{lot.attributes.dimensions as string}</dd>
              </>
            )}
            <dt>Início</dt>
            <dd>{formatDateTime(lot.startAt)}</dd>
            <dt>Fim</dt>
            <dd>{formatDateTime(lot.endAt)}</dd>
          </dl>
          <Link to={`/audit/${lot.id}`} className="audit-link">
            🔍 Auditar histórico de lances
          </Link>
        </div>
      </div>

      {/* Coluna direita: lances */}
      <div className="room-panel">
        <div className="bid-panel card">
          <div className="bid-panel-header">
            <div>
              <p className="muted panel-label">
                {ended
                  ? "Lance final"
                  : lot.bidCount === 0
                  ? "Lance inicial"
                  : "Lance atual"}
              </p>
              <p className="bid-amount">
                {formatMoney(lot.currentBidCents ?? lot.startPriceCents)}
              </p>
            </div>
            {live && (
              <div className="countdown-box">
                <p className="muted panel-label">Tempo restante</p>
                <Countdown endAt={lot.endAt} serverNow={lot.serverNow} />
              </div>
            )}
          </div>

          <p className="muted bid-meta">
            {lot.bidCount} {lot.bidCount === 1 ? "lance" : "lances"} · incremento
            mínimo {formatMoney(lot.minIncrementCents)}
          </p>

          {lot.status === "scheduled" && (
            <div className="msg msg-info">
              📅 Começa em {formatDateTime(lot.startAt)}
            </div>
          )}
          {ended && (
            <div className="msg msg-info">
              {lot.bidCount > 0
                ? "✅ Lote encerrado e arrematado."
                : "Lote encerrado sem lances."}
            </div>
          )}
          {notice && <div className="msg msg-info">{notice}</div>}

          {/* Posição do utilizador */}
          {myPosition === "leading" && live && (
            <div className="msg msg-ok">✔ Você está ganhando!</div>
          )}
          {myPosition === "outbid" && live && (
            <div className="msg msg-err">✖ Você foi superado</div>
          )}
          {myPosition === "leading" && ended && (
            <div className="msg msg-ok">
              🏆 Você venceu! Veja o comprovante em{" "}
              <Link to="/my/bids">Meus Arremates</Link>.
            </div>
          )}
          {myPosition === "outbid" && ended && (
            <div className="msg msg-err">Você não venceu este lote.</div>
          )}

          {/* Formulário de lance */}
          {live && isBidder && (
            <form onSubmit={submit} className="bid-form">
              {wallet && (
                <p className="muted wallet-hint">
                  💰 Disponível: <strong>{formatMoney(wallet.availableCents)}</strong>
                </p>
              )}
              <div className="bid-input-row">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="bid-amount">Seu lance (R$)</label>
                  <input
                    id="bid-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={toInputMoney(minNext)}
                    inputMode="decimal"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAmount(toInputMoney(minNext))}
              >
                Mínimo: {formatMoney(minNext)}
              </button>
              <button
                className="btn btn-primary btn-block"
                disabled={sending}
              >
                {sending ? "Enviando…" : "🔨 Dar Lance"}
              </button>
              {feedback && (
                <div className={feedback.ok ? "msg msg-ok" : "msg msg-err"}>
                  {feedback.text}
                </div>
              )}
            </form>
          )}

          {live && user?.role === "auctioneer" && (
            <p className="muted" style={{ textAlign: "center" }}>
              Leiloeiros não podem dar lances.
            </p>
          )}
          {live && !user && (
            <p style={{ textAlign: "center" }}>
              <Link to="/login">Entre como licitante</Link> para dar lances.
            </p>
          )}
        </div>

        {/* Histórico */}
        <div className="bids-history card">
          <h2 className="history-title">Histórico de lances</h2>
          {bids.length === 0 ? (
            <p className="muted" style={{ padding: "1rem" }}>
              Ainda sem lances.
            </p>
          ) : (
            <table className="bids-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Licitante</th>
                  <th>Valor</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {[...bids].reverse().map((b) => (
                  <tr key={b.sequence} className={b.isMine ? "row-mine" : ""}>
                    <td className="muted">{b.sequence}</td>
                    <td>
                      {b.bidder}
                      {b.isMine && <span className="you-badge"> (você)</span>}
                    </td>
                    <td className="bid-value">{formatMoney(b.amountCents)}</td>
                    <td className="muted">
                      {new Date(b.createdAt).toLocaleTimeString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
