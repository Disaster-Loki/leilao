import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import {
  errorMessage,
  formatDateTime,
  formatTime,
  getBrowserTimeZoneLabel,
} from "../lib/utils";
import { formatReais, formatReaisInput, parseReais } from "../lib/money";
import type { Room, Wallet } from "../types";
import Countdown from "../components/Countdown";
import { imageSrc, PLACEHOLDER } from "../lib/image";
import Icon from "../components/Icon";

const CONFETTI_COLORS = [
  "#6366f1",
  "#a855f7",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#38bdf8",
];

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
  const [celebrate, setCelebrate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastEndRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const celebratedRef = useRef(false);
  const loadedLotIdRef = useRef<string | null>(null);
  const isBidder = user?.role === "bidder";

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const r = await api<Room>(`/lots/${id}/room`);
        if (cancelled) return;

        const end = new Date(r.lot.endAt).getTime();
        if (lastEndRef.current !== null && end > lastEndRef.current) {
          setNotice("Prazo prorrogado +2 min (lance nos últimos 2 minutos).");
        }
        lastEndRef.current = end;

        if (loadedLotIdRef.current !== r.lot.id) {
          loadedLotIdRef.current = r.lot.id;
          lastStatusRef.current = null;
          celebratedRef.current = false;
          setCelebrate(false);
        }

        const previousStatus = lastStatusRef.current;
        lastStatusRef.current = r.lot.status;
        if (
          previousStatus === "live" &&
          r.lot.status === "ended" &&
          r.myPosition === "leading" &&
          !celebratedRef.current
        ) {
          celebratedRef.current = true;
          setCelebrate(true);
        }

        setRoom(r);
        setLoadError(null);

        if (isBidder) {
          api<Wallet>("/wallet")
            .then((w) => {
              if (!cancelled) setWallet(w);
            })
            .catch(() => null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      }
    }

    void tick();
    const t = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, isBidder, refreshKey]);

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
      ? BigInt(lot.startPriceReais)
      : BigInt(lot.currentBidReais ?? "0") + BigInt(lot.minIncrementReais);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    let reais: bigint;
    try {
      reais = parseReais(amount);
      if (reais <= 0n) throw new Error("Informe um valor maior que zero.");
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : "Informe um valor válido." });
      return;
    }
    setSending(true);
    try {
      await api(`/lots/${id}/bids`, {
        method: "POST",
        body: JSON.stringify({ amountReais: reais.toString() }),
      });
      setFeedback({ ok: true, text: `Lance de ${formatReais(reais)} aceito!` });
      setAmount("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setFeedback({ ok: false, text: errorMessage(err) });
      setRefreshKey((k) => k + 1);
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
          src={imageSrc(lot.imageUrl)}
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
            <dd>
              {formatDateTime(lot.startAt)}
              <span className="muted"> ({getBrowserTimeZoneLabel()})</span>
            </dd>
            <dt>Fim</dt>
            <dd>
              {formatDateTime(lot.endAt)}
              <span className="muted"> ({getBrowserTimeZoneLabel()})</span>
            </dd>
          </dl>
          <Link to={`/audit/${lot.id}`} className="audit-link">
            <Icon name="shield" size={15} /> Auditar histórico de lances
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
                {formatReais(lot.currentBidReais ?? lot.startPriceReais)}
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
            mínimo {formatReais(lot.minIncrementReais)}
          </p>

          {lot.status === "scheduled" && (
            <div className="msg msg-info">
              <Icon name="clock" size={15} /> Começa em {formatDateTime(lot.startAt)}
              <span className="muted"> ({getBrowserTimeZoneLabel()})</span>
            </div>
          )}
          {ended && (
            <div className="msg msg-info">
              {lot.bidCount > 0
                ? "Lote encerrado e arrematado."
                : "Lote encerrado sem lances."}
            </div>
          )}
          {notice && <div className="msg msg-info">{notice}</div>}

          {/* Posição do utilizador */}
          {myPosition === "leading" && live && (
            <div className="msg msg-ok"><Icon name="check" size={15} /> Você está ganhando!</div>
          )}
          {myPosition === "outbid" && live && (
            <div className="msg msg-err"><Icon name="x" size={15} /> Você foi superado</div>
          )}
          {myPosition === "leading" && ended && (
            <div className="msg msg-ok">
              <Icon name="trophy" size={16} /> Você venceu! Veja o comprovante em{" "}
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
                  <Icon name="wallet" size={15} /> Disponível: <strong>{formatReais(wallet.availableReais)}</strong>
                </p>
              )}
              <div className="bid-input-row">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="bid-amount">Seu lance (R$)</label>
                  <input
                    id="bid-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={formatReaisInput(minNext)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAmount(formatReaisInput(minNext))}
              >
                Mínimo: {formatReais(minNext)}
              </button>
              <button
                className="btn btn-primary btn-block"
                disabled={sending}
              >
                {sending ? "Enviando…" : <><Icon name="gavel" size={16} /> Dar lance</>}
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
                    <td className="bid-value">{formatReais(b.amountReais)}</td>
                    <td className="muted">
                      {formatTime(b.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {celebrate && (
        <div
          className="win-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-title"
        >
          <div className="confetti" aria-hidden>
            {Array.from({ length: 44 }).map((_, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${(i * 37) % 100}%`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  animationDelay: `${(i % 12) * 0.14}s`,
                  animationDuration: `${2.2 + (i % 5) * 0.35}s`,
                  transform: `rotate(${(i * 53) % 360}deg)`,
                }}
              />
            ))}
          </div>
          <div className="win-card card">
            <span className="win-trophy" aria-hidden><Icon name="trophy" size={54} /></span>
            <span className="win-kicker">Leilão encerrado</span>
            <h2 id="win-title">Parabéns, venceu o leilão!</h2>
            <p className="muted">
              Arremataste <strong>{lot.title}</strong> por{" "}
              <strong className="win-amount">
                {formatReais(lot.currentBidReais ?? lot.startPriceReais)}
              </strong>
              .
            </p>
            <div className="win-actions">
              <Link to="/my/bids" className="btn btn-primary">
                Ver meus arremates
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCelebrate(false)}
              >
                Continuar a ver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
