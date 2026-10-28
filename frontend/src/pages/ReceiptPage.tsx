import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { errorMessage, formatDateTime, getBrowserTimeZoneLabel } from "../lib/utils";
import { formatReais } from "../lib/money";
import type { Receipt } from "../types";
import { imageSrc, PLACEHOLDER } from "../lib/image";
import Icon from "../components/Icon";

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Receipt>(`/receipts/${id}`)
      .then(setReceipt)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error) return <p className="msg msg-err center-msg">{error}</p>;
  if (!receipt) return <p className="muted center-msg">Carregando…</p>;

  return (
    <div className="page-wrap receipt-page">
      <div className="receipt-card card">
        <div className="receipt-stamp"><Icon name="trophy" size={18} /> Comprovante de Arremate</div>

        <div className="receipt-lot">
          <img
            className="receipt-img"
            src={imageSrc(receipt.imageUrl)}
            alt={receipt.title}
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER;
            }}
          />
          <div>
            <h1 className="receipt-title">{receipt.title}</h1>
            {receipt.artist && <p className="muted">{receipt.artist}</p>}
          </div>
        </div>

        <dl className="receipt-dl">
          <dt>Vencedor</dt>
          <dd className="winner-name">{receipt.winner}</dd>

          <dt>Valor arrematado</dt>
          <dd className="receipt-amount">{formatReais(receipt.amountReais)}</dd>

          <dt>Total de lances</dt>
          <dd>{receipt.bidCount}</dd>

          <dt>Data de emissão</dt>
          <dd>{formatDateTime(receipt.issuedAt)} <span className="muted">({getBrowserTimeZoneLabel()})</span></dd>

          <dt>ID do comprovante</dt>
          <dd className="mono muted">{receipt.id}</dd>

          <dt>Hash final da cadeia</dt>
          <dd className="mono hash-value">{receipt.finalHash}</dd>
        </dl>

        <div className="receipt-note">
          <p>
            O <strong>hash final</strong> é a "impressão digital" do último lance desta
            cadeia. Qualquer alteração no histórico invalida-o. Você pode verificar isso
            na página de auditoria.
          </p>
        </div>

        <div className="receipt-actions">
          <Link to={`/audit/${receipt.lotId}`} className="btn btn-primary">
            <Icon name="shield" size={15} /> Verificar auditoria
          </Link>
          <Link to={`/lots/${receipt.lotId}`} className="btn btn-ghost">
            Ver lote
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Link copiado!");
            }}
          >
            <Icon name="receipt" size={15} /> Copiar link
          </button>
        </div>
      </div>
    </div>
  );
}
