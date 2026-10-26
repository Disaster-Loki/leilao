import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { errorMessage, formatMoney } from "../lib/utils";
import type { AuditResult } from "../types";

export default function AuditPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AuditResult>(`/audit/${lotId}`)
      .then(setResult)
      .catch((e) => setError(errorMessage(e)));
  }, [lotId]);

  if (error) return <p className="msg msg-err center-msg">{error}</p>;
  if (!result) return <p className="muted center-msg">Carregando auditoria…</p>;

  const issueLabels: Record<string, string> = {
    SEQUENCE_GAP: "Sequência com buraco (lance removido ou inserido)",
    PREV_HASH_MISMATCH: "prev_hash não bate (cadeia quebrada)",
    HASH_MISMATCH: "Hash inválido (dado alterado ou segredo errado)",
    HEAD_HASH_MISMATCH: "Head hash do lote não coincide (último lance removido?)",
    BID_COUNT_MISMATCH: "Contagem de lances diverge do lote",
    CURRENT_BID_MISMATCH: "Valor atual diverge do último lance",
    LEADER_MISMATCH: "Líder diverge do último lance",
    RECEIPT_MISSING: "Comprovante não encontrado para lote liquidado",
    RECEIPT_HASH_MISMATCH: "Hash do comprovante não bate com a cadeia",
    RECEIPT_AMOUNT_MISMATCH: "Valor do comprovante diverge do lance final",
    SETTLEMENT_MISMATCH: "Movimentação financeira diverge do lance final",
  };

  return (
    <div className="page-wrap audit-page">
      <div className="audit-header">
        <h1>Auditoria do Lote</h1>
        <p className="muted">{result.title}</p>
        <Link to={`/lots/${result.lotId}`} className="btn btn-ghost btn-sm">
          ← Ver lote
        </Link>
      </div>

      {/* Veredito */}
      <div className={`verdict-banner ${result.valid ? "verdict-ok" : "verdict-fail"}`}>
        {result.valid ? (
          <>
            <span className="verdict-icon">✅</span>
            <div>
              <strong>Histórico íntegro</strong>
              <p>
                {result.bidCount} lances verificados. A cadeia de hashes está
                consistente e nenhuma adulteração foi detectada.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="verdict-icon">🚨</span>
            <div>
              <strong>Adulteração detectada!</strong>
              {result.firstFailure && (
                <p>
                  Primeira falha no lance #{result.firstFailure.sequence ?? "?"}: {" "}
                  <code>{result.firstFailure.code}</code> —{" "}
                  {issueLabels[result.firstFailure.code] ?? result.firstFailure.code}
                </p>
              )}
              <p>Total de problemas: {result.issues.length}</p>
            </div>
          </>
        )}
      </div>

      {/* Resumo */}
      <div className="audit-summary card">
        <dl className="receipt-dl">
          <dt>ID do lote</dt>
          <dd className="mono muted">{result.lotId}</dd>
          <dt>Status</dt>
          <dd>{result.status}</dd>
          <dt>Lances auditados</dt>
          <dd>{result.bidCount}</dd>
          <dt>Head hash (último lance)</dt>
          <dd className="mono hash-value">{result.headHash || "—"}</dd>
        </dl>
      </div>

      {/* Issues se houver */}
      {result.issues.length > 0 && (
        <div className="audit-issues card">
          <h2>Problemas encontrados</h2>
          <table className="bids-table">
            <thead>
              <tr>
                <th>Lance #</th>
                <th>Código</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {result.issues.map((issue, i) => (
                <tr key={i} className="row-issue">
                  <td>{issue.sequence ?? "Lote"}</td>
                  <td><code>{issue.code}</code></td>
                  <td>{issueLabels[issue.code] ?? issue.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lances */}
      <div className="audit-bids card">
        <h2>Cadeia de lances</h2>
        <p className="muted audit-explain">
          Cada lance carrega o hash do anterior (HMAC-SHA256 com segredo do servidor).
          Alterar qualquer campo — valor, licitante, timestamp — invalida o hash e todos
          os seguintes.
        </p>
        {result.bids.length === 0 ? (
          <p className="muted" style={{ padding: "1rem" }}>
            Nenhum lance registado.
          </p>
        ) : (
          <div className="audit-table-wrap">
            <table className="bids-table audit-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Licitante</th>
                  <th>Valor</th>
                  <th>Hora</th>
                  <th>Hash</th>
                  <th>OK?</th>
                </tr>
              </thead>
              <tbody>
                {result.bids.map((b) => {
                  const hasIssue = result.issues.some(
                    (iss) => iss.sequence === b.sequence
                  );
                  return (
                    <tr key={b.sequence} className={hasIssue ? "row-issue" : ""}>
                      <td className="muted">{b.sequence}</td>
                      <td>{b.bidder}</td>
                      <td>{formatMoney(b.amountCents)}</td>
                      <td className="muted">
                        {new Date(b.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td>
                        <span className="mono hash-mini" title={b.hash}>
                          {b.hash.slice(0, 8)}…
                        </span>
                      </td>
                      <td className={hasIssue ? "err-text" : "ok-text"}>
                        {hasIssue ? "✖" : "✔"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="audit-footer card">
        <h2>Como funciona a verificação</h2>
        <ol className="audit-steps">
          <li>
            <strong>Cadeia de hashes:</strong> Cada lance tem um hash calculado com
            HMAC-SHA256 sobre (hash anterior, lote, sequência, licitante, valor,
            data). O segredo fica só no servidor — sem ele, não é possível forjar hashes
            válidos.
          </li>
          <li>
            <strong>Head hash:</strong> O lote guarda o hash do último lance e a
            contagem total. Remover o último lance invalida estas âncoras.
          </li>
          <li>
            <strong>Comprovante:</strong> Inclui o hash final da cadeia. O vencedor
            pode guardar o comprovante e comparar com a auditoria futuramente.
          </li>
          <li>
            <strong>Limitação assumida:</strong> Quem tem acesso ao banco{" "}
            <em>e</em> ao segredo HMAC pode forjar uma cadeia inteira. Por isso o segredo
            é guardado fora do banco, em variável de ambiente.
          </li>
        </ol>
      </div>
    </div>
  );
}
