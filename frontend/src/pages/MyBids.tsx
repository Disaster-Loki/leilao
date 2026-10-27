import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { errorMessage, formatDateTime } from "../lib/utils";
import { formatCents } from "../lib/money";
import type { MyBid } from "../types";
import { imageSrc, PLACEHOLDER } from "../lib/image";
import Icon from "../components/Icon";

export default function MyBids() {
  const [bids, setBids] = useState<MyBid[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MyBid[]>("/my/bids")
      .then(setBids)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="msg msg-err center-msg">{error}</p>;
  if (!bids) return <p className="muted center-msg">Carregando…</p>;

  const resultLabel: Record<string, string> = {
    leading: "Ganhando",
    outbid: "Superado",
    won: "Vencedor",
    lost: "Não venceu",
  };

  return (
    <div className="page-wrap">
      <h1>Meus Arremates</h1>
      {bids.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon"><Icon name="search" size={40} /></p>
          <p>Você ainda não deu nenhum lance.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Ver vitrine
          </Link>
        </div>
      ) : (
        <div className="mybids-list">
          {bids.map((b) => (
            <div key={b.lotId} className="mybid-card card">
              <img
                className="mybid-img"
                src={imageSrc(b.imageUrl)}
                alt={b.title}
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER;
                }}
              />
              <div className="mybid-info">
                <Link to={`/lots/${b.lotId}`} className="mybid-title">
                  {b.title}
                </Link>
                {b.artist && <p className="muted">{b.artist}</p>}
                <p className="muted">{formatDateTime(b.endAt)}</p>
                <div className="mybid-meta">
                  <span className={`result-badge result-${b.result}`}>
                    {resultLabel[b.result]}
                  </span>
                  <span className="muted">
                      Meu melhor lance: <strong>{formatCents(b.myBestCents)}</strong>
                  </span>
                  {b.status === "ended" && (
                    <span className="muted">
                      Lance final: <strong>{formatCents(b.currentBidCents)}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="mybid-actions">
                <Link to={`/lots/${b.lotId}`} className="btn btn-ghost btn-sm">
                  Ver lote
                </Link>
                {b.receiptId && (
                  <Link
                    to={`/receipts/${b.receiptId}`}
                    className="btn btn-primary btn-sm"
                  >
                    <Icon name="receipt" size={15} /> Comprovante
                  </Link>
                )}
                <Link
                  to={`/audit/${b.lotId}`}
                  className="btn btn-ghost btn-sm"
                >
                  <Icon name="shield" size={15} /> Auditoria
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
