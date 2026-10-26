import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { errorMessage, formatMoney, formatDateTime } from "../lib/utils";
import type { ArtworkResult, Lot } from "../types";

interface PanelData {
  lots: Lot[];
  totalReceivedCents: number;
}

export default function AuctioneerPanel() {
  const [data, setData] = useState<PanelData | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ArtworkResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ArtworkResult | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);
  const [lotMsg, setLotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // Criar lote: campos
  const [startPrice, setStartPrice] = useState("10000,00");
  const [minIncrement, setMinIncrement] = useState("1000,00");
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });

  const load = useCallback(async () => {
    try {
      const d = await api<PanelData>("/lots/mine");
      setData(d);
    } catch {
      /* ignora erros de refresh */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function searchArtworks(e: FormEvent) {
    e.preventDefault();
    if (searchQ.trim().length < 2) return;
    setSearchError(null);
    setResults(null);
    setSelected(null);
    setSearching(true);
    try {
      const r = await api<ArtworkResult[]>(
        `/external/artworks?q=${encodeURIComponent(searchQ.trim())}`
      );
      setResults(r);
    } catch (err) {
      setSearchError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  function parseCents(s: string): number | null {
    const v = s.trim().replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    const [int, dec = ""] = v.split(".");
    return Number(int) * 100 + Number((dec + "00").slice(0, 2));
  }

  async function createLot(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLotError(null);
    setLotMsg(null);
    const startPriceCents = parseCents(startPrice);
    const minIncrementCents = parseCents(minIncrement);
    if (!startPriceCents || !minIncrementCents) {
      setLotError("Verifique os valores de preço e incremento.");
      return;
    }
    setBusy(true);
    try {
      await api("/lots", {
        method: "POST",
        body: JSON.stringify({
          externalId: selected.externalId,
          startPriceCents,
          minIncrementCents,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });
      setLotMsg(`Lote "${selected.title}" criado com sucesso! ✓`);
      setSelected(null);
      setResults(null);
      load();
    } catch (err) {
      setLotError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelLot(lotId: string, title: string, bidCount: number) {
    const msg = bidCount > 0
      ? `Cancelar "${title}"?\n\nO lote tem ${bidCount} lance(s). O valor comprometido será devolvido automaticamente ao licitante.`
      : `Cancelar "${title}"?`;
    if (!confirm(msg)) return;
    setCancelMsg(null);
    try {
      await api(`/lots/${lotId}/cancel`, { method: "POST" });
      setCancelMsg(`Lote "${title}" cancelado${bidCount > 0 ? " — estorno realizado." : "."}`);
      load();
    } catch (err) {
      setCancelMsg(errorMessage(err));
    }
  }

  const statusLabel: Record<string, string> = {
    live: "🔴 Ao vivo",
    scheduled: "📅 Agendado",
    ended: "✅ Encerrado",
    cancelled: "❌ Cancelado",
  };

  return (
    <div className="page-wrap">
      <h1>Painel do Leiloeiro</h1>

      {data && (
        <div className="panel-summary card">
          <span>Total de lotes: <strong>{data.lots.length}</strong></span>
          <span>
            Total recebido:{" "}
            <strong className="ok-text">
              {formatMoney(data.totalReceivedCents)}
            </strong>
          </span>
        </div>
      )}

      {/* Busca de obras */}
      <div className="panel-section card">
        <h2>1. Buscar obra na API (Art Institute of Chicago)</h2>
        <form onSubmit={searchArtworks} className="form">
          <div className="field">
            <label htmlFor="artwork-search">Pesquisar obra</label>
            <div className="input-row">
              <input
                id="artwork-search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Ex: monet, starry night, portrait…"
                minLength={2}
              />
              <button className="btn btn-primary" disabled={searching}>
                {searching ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>
        </form>

        {searchError && <p className="msg msg-err">{searchError}</p>}

        {results !== null && (
          <div className="artwork-results">
            {results.length === 0 ? (
              <p className="muted">Nenhuma obra encontrada.</p>
            ) : (
              <div className="artwork-grid">
                {results.map((r) => (
                  <button
                    key={r.externalId}
                    type="button"
                    className={`artwork-item card ${selected?.externalId === r.externalId ? "artwork-selected" : ""}`}
                    onClick={() => setSelected(r)}
                  >
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.title} />
                    ) : (
                      <div className="artwork-no-img">Sem imagem</div>
                    )}
                    <div className="artwork-info">
                      <p className="artwork-title">{r.title}</p>
                      {r.artist && <p className="muted">{r.artist}</p>}
                    </div>
                    {selected?.externalId === r.externalId && (
                      <span className="artwork-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Criar lote */}
      {selected && (
        <div className="panel-section card">
          <h2>2. Criar lote com "{selected.title}"</h2>
          <form onSubmit={createLot} className="form">
            <div className="fields-row">
              <div className="field">
                <label htmlFor="start-price">Lance inicial (R$)</label>
                <input
                  id="start-price"
                  value={startPrice}
                  onChange={(e) => setStartPrice(e.target.value)}
                  placeholder="10.000,00"
                  inputMode="decimal"
                />
              </div>
              <div className="field">
                <label htmlFor="min-increment">Incremento mínimo (R$)</label>
                <input
                  id="min-increment"
                  value={minIncrement}
                  onChange={(e) => setMinIncrement(e.target.value)}
                  placeholder="1.000,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="fields-row">
              <div className="field">
                <label htmlFor="start-at">Início do leilão</label>
                <input
                  id="start-at"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="end-at">Fim do leilão</label>
                <input
                  id="end-at"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
            {lotError && <p className="msg msg-err">{lotError}</p>}
            {lotMsg && <p className="msg msg-ok">{lotMsg}</p>}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Criando…" : "🔨 Criar Lote"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Meus lotes */}
      <div className="panel-section">
        <h2>Meus lotes</h2>
        {cancelMsg && (
          <p className={cancelMsg.includes("cancelado") ? "msg msg-ok" : "msg msg-err"}>
            {cancelMsg}
          </p>
        )}
        {!data ? (
          <p className="muted">Carregando…</p>
        ) : data.lots.length === 0 ? (
          <p className="muted">Você ainda não criou nenhum lote.</p>
        ) : (
          <div className="lots-table-wrap card">
            <table className="bids-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Fim</th>
                  <th>Lance atual</th>
                  <th>Lances</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.lots.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <a href={`/lots/${l.id}`}>{l.title}</a>
                    </td>
                    <td>
                      <span className={`badge badge-${l.status}`}>
                        {statusLabel[l.status]}
                      </span>
                    </td>
                    <td className="muted">{formatDateTime(l.endAt)}</td>
                    <td>
                      {l.currentBidCents !== null
                        ? formatMoney(l.currentBidCents)
                        : <span className="muted">—</span>}
                    </td>
                    <td className="muted">{l.bidCount}</td>
                    <td>
                      {(l.status === "scheduled" || l.status === "live") && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => cancelLot(l.id, l.title, l.bidCount)}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
