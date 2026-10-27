import { Link } from "react-router-dom";
import type { Lot } from "../types";
import { formatDateTime } from "../lib/utils";
import { formatCents } from "../lib/money";
import { imageSrc, PLACEHOLDER } from "../lib/image";
import Countdown from "./Countdown";

export { PLACEHOLDER } from "../lib/image";

interface Props {
  lot: Lot;
}

export default function LotCard({ lot }: Props) {
  const statusLabel: Record<string, string> = {
    live: "Ao vivo",
    scheduled: "Agendado",
    ended: "Encerrado",
    cancelled: "Cancelado",
  };

  const hasBid = lot.currentBidCents !== null;

  return (
    <Link to={`/lots/${lot.id}`} className={`lot-card card status-${lot.status}`}>
      <div className="lot-card-img-wrap">
        <img
          src={imageSrc(lot.imageUrl)}
          alt={lot.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
        <span className="lot-card-shade" aria-hidden />
        <span className={`badge badge-${lot.status}`}>
          {lot.status === "live" && <span className="badge-dot" />}
          {statusLabel[lot.status]}
        </span>
        <span className="lot-card-bids">
          {lot.bidCount} {lot.bidCount === 1 ? "lance" : "lances"}
        </span>
      </div>

      <div className="lot-card-body">
        <div className="lot-card-heading">
          <h3 className="lot-title clamp1">{lot.title}</h3>
          <p className="lot-artist muted clamp1">{lot.artist ?? "Artista desconhecido"}</p>
        </div>

        <div className="lot-card-price-row">
          <div>
            <span className="lot-price-label">
              {hasBid ? "Lance atual" : "Lance inicial"}
            </span>
            <p className="lot-price">
              {formatCents(hasBid ? lot.currentBidCents! : lot.startPriceCents)}
            </p>
          </div>
          {lot.status === "live" && (
            <span className="lot-card-timer">
              <span className="muted">Termina em</span>
              <Countdown endAt={lot.endAt} serverNow={lot.serverNow} />
            </span>
          )}
        </div>

        <div className="lot-card-footer">
          {lot.status === "scheduled" && (
            <span className="muted">Inicia {formatDateTime(lot.startAt)}</span>
          )}
          {lot.status === "ended" && (
            <span className="muted">
              {lot.bidCount > 0 ? "Arrematado" : "Encerrado sem lances"}
            </span>
          )}
          {lot.status === "live" && (
            <span className="lot-card-cta">Dar lance →</span>
          )}
        </div>
      </div>
    </Link>
  );
}
