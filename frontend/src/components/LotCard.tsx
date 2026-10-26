import { Link } from "react-router-dom";
import type { Lot } from "../types";
import { formatMoney, formatDateTime } from "../lib/utils";
import Countdown from "./Countdown";

export const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280">
      <rect width="100%" height="100%" fill="#1e1e2e"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-family="system-ui" font-size="14">Sem imagem</text>
    </svg>`
  );

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

  return (
    <Link to={`/lots/${lot.id}`} className={`lot-card card status-${lot.status}`}>
      <div className="lot-card-img-wrap">
        <img
          src={lot.imageUrl ?? PLACEHOLDER}
          alt={lot.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
        <span className={`badge badge-${lot.status}`}>{statusLabel[lot.status]}</span>
      </div>
      <div className="lot-card-body">
        <h3 className="lot-title">{lot.title}</h3>
        {lot.artist && <p className="lot-artist muted clamp1">{lot.artist}</p>}
        <p className="lot-price">
          {lot.currentBidCents !== null
            ? formatMoney(lot.currentBidCents)
            : `Início: ${formatMoney(lot.startPriceCents)}`}
        </p>
        <div className="lot-meta">
          <span className="muted">
            {lot.bidCount} {lot.bidCount === 1 ? "lance" : "lances"}
          </span>
          {lot.status === "live" && (
            <span>
              Termina em{" "}
              <Countdown endAt={lot.endAt} serverNow={lot.serverNow} />
            </span>
          )}
          {lot.status === "scheduled" && (
            <span className="muted">Inicia {formatDateTime(lot.startAt)}</span>
          )}
          {lot.status === "ended" && (
            <span className="muted">
              {lot.bidCount > 0 ? "Arrematado" : "Sem lances"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
