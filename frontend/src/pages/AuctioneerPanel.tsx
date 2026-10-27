import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { errorMessage, formatDateTime, fromDatetimeLocalInput, getBrowserTimeZoneLabel, toDatetimeLocalInput } from "../lib/utils";
import { centsToApi, formatCents, formatReaisInput, parseReaisToCents } from "../lib/money";
import { imageSrc, PLACEHOLDER } from "../lib/image";
import Icon from "../components/Icon";
import type { ArtworkResult, Lot } from "../types";

interface PanelData {
  lots: Lot[];
  totalReceivedCents: string;
}

export default function AuctioneerPanel() {
  const [data, setData] = useState<PanelData | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ArtworkResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ArtworkResult | null>(null);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);
  const [lotMsg, setLotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const createPanelRef = useRef<HTMLDivElement>(null);

  const [startPrice, setStartPrice] = useState("10000,00");
  const [minIncrement, setMinIncrement] = useState("1000,00");
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return toDatetimeLocalInput(d);
  });
  const [endAt, setEndAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return toDatetimeLocalInput(d);
  });

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const d = await api<PanelData>("/lots/mine");
        if (!cancelled) setData(d);
      } catch {
        // ignora erros de refresh
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function searchArtworks(e: FormEvent) {
    e.preventDefault();
    if (searchQ.trim().length < 2) return;
    setSearchError(null);
    setResults(null);
    setSelected(null);
    setSearching(true);
    try {
      const r = await api<ArtworkResult[]>(`/external/artworks?q=${encodeURIComponent(searchQ.trim())}`);
      setResults(r);
    } catch (err) {
      setSearchError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  function selectArtwork(artwork: ArtworkResult) {
    setSelected(artwork);
    setLotError(null);
    setLotMsg(null);
    window.setTimeout(() => {
      createPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function beginEdit(lot: Lot) {
    setEditingLot(lot);
    setSelected(null);
    setStartPrice(formatReaisInput(BigInt(lot.startPriceCents)));
    setMinIncrement(formatReaisInput(BigInt(lot.minIncrementCents)));
    setStartAt(toDatetimeLocalInput(new Date(lot.startAt)));
    setEndAt(toDatetimeLocalInput(new Date(lot.endAt)));
    setLotError(null);
    setLotMsg(null);
    createPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createLot(e: FormEvent) {
    e.preventDefault();
    if (!selected && !editingLot) return;
    setLotError(null);
    setLotMsg(null);
    let startPriceCents: bigint;
    let minIncrementCents: bigint;
    try {
      startPriceCents = parseReaisToCents(startPrice);
      minIncrementCents = parseReaisToCents(minIncrement);
      if (startPriceCents <= 0n || minIncrementCents <= 0n) {
        throw new Error("Os valores devem ser maiores que zero.");
      }
    } catch (error) {
      setLotError(error instanceof Error ? error.message : "Verifique os valores de preço e incremento.");
      return;
    }
    setBusy(true);
    try {
      await api(editingLot ? `/lots/${editingLot.id}` : "/lots", {
        method: editingLot ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(selected ? { externalId: selected.externalId } : {}),
          startPriceCents: centsToApi(startPriceCents),
          minIncrementCents: centsToApi(minIncrementCents),
          startAt: fromDatetimeLocalInput(startAt).toISOString(),
          endAt: fromDatetimeLocalInput(endAt).toISOString(),
        }),
      });
      setLotMsg(editingLot ? "Lote atualizado com sucesso." : `Lote "${selected!.title}" criado com sucesso!`);
      setSelected(null);
      setEditingLot(null);
      setResults(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setLotError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLot(lot: Lot) {
    if (!confirm(`Eliminar o lote "${lot.title}"? Esta ação não pode ser desfeita.`)) return;
    setCancelMsg(null);
    try {
      await api(`/lots/${lot.id}`, { method: "DELETE" });
      setCancelMsg(`Lote "${lot.title}" eliminado.`);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setCancelMsg(errorMessage(error));
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
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelMsg(errorMessage(err));
    }
  }

  const statusLabel: Record<string, string> = {
    live: "Ao vivo",
    scheduled: "Agendado",
    ended: "Encerrado",
    cancelled: "Cancelado",
  };

  const liveCount = data?.lots.filter((l) => l.status === "live").length ?? 0;
  const scheduledCount = data?.lots.filter((l) => l.status === "scheduled").length ?? 0;
  const endedCount = data?.lots.filter((l) => l.status === "ended").length ?? 0;

  return (
    <div className="container-wide panel-page">
      <header className="page-heading">
        <div>
          <span className="page-eyebrow">Gestão de leilões</span>
          <h1>Painel do Leiloeiro</h1>
          <p className="muted">
            Pesquise obras, publique novos lotes e acompanhe os resultados.
          </p>
        </div>
        <div className="page-heading-actions">
          <Link to="/" className="btn btn-ghost">Ver vitrine</Link>
        </div>
      </header>

      {data && (
        <div className="stat-strip">
          <div className="stat-mini card">
            <span className="stat-mini-icon"><Icon name="gallery" size={17} /></span>
            <div><strong>{data.lots.length}</strong><span>lotes no total</span></div>
          </div>
          <div className="stat-mini card">
            <span className="stat-mini-icon"><Icon name="dot" size={17} /></span>
            <div><strong>{liveCount}</strong><span>ao vivo</span></div>
          </div>
          <div className="stat-mini card">
            <span className="stat-mini-icon"><Icon name="clock" size={17} /></span>
            <div><strong>{scheduledCount}</strong><span>agendados</span></div>
          </div>
          <div className="stat-mini card">
            <span className="stat-mini-icon"><Icon name="wallet" size={17} /></span>
            <div>
              <strong className="ok-text">{formatCents(data.totalReceivedCents)}</strong>
              <span>recebido ({endedCount} encerrados)</span>
            </div>
          </div>
        </div>
      )}

      <div className="panel-layout">
        <div className="panel-main">
          {/* Busca de obras */}
          <section className="panel-section card">
            <div className="section-heading">
              <div>
                <h2>1. Buscar obra na API</h2>
                <p className="section-subtitle muted">
                  Art Institute of Chicago · escolha uma obra para criar o lote
                </p>
              </div>
            </div>

            <form onSubmit={searchArtworks} className="search-bar search-bar-panel">
              <span className="search-icon" aria-hidden><Icon name="search" size={16} /></span>
              <input
                id="artwork-search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Ex: monet, water lilies, portrait…"
                minLength={2}
                aria-label="Pesquisar obra"
              />
              <button className="btn btn-primary" disabled={searching}>
                {searching ? "Buscando…" : "Buscar obra"}
              </button>
            </form>

            {searchError && <p className="msg msg-err">{searchError}</p>}

            {results !== null && (
              <div className="artwork-results">
                {results.length === 0 ? (
                  <p className="muted">Nenhuma obra encontrada.</p>
                ) : (
                  <>
                    <p className="results-meta muted">
                      {results.length} obras encontradas — selecione uma para preencher o
                      formulário à direita.
                    </p>
                    <div className="artwork-grid">
                      {results.map((r) => (
                        <button
                          key={r.externalId}
                          type="button"
                          className={`artwork-item card ${selected?.externalId === r.externalId ? "artwork-selected" : ""}`}
                          onClick={() => selectArtwork(r)}
                        >
                          <div className="artwork-media">
                            <img
                              src={imageSrc(r.imageUrl)}
                              alt={r.title}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = PLACEHOLDER;
                              }}
                            />
                            {selected?.externalId === r.externalId && (
                              <span className="artwork-check"><Icon name="check" size={12} /></span>
                            )}
                          </div>
                          <div className="artwork-info">
                            <p className="artwork-title clamp1">{r.title}</p>
                            {r.artist && <p className="muted clamp1">{r.artist}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Meus lotes */}
          <section className="panel-section card">
            <div className="section-heading">
              <div>
                <h2>Meus lotes</h2>
                <p className="section-subtitle muted">
                  Estado, resultados e ações de cada lote publicado
                </p>
              </div>
            </div>

            {cancelMsg && (
              <p className={cancelMsg.includes("cancelado") || cancelMsg.includes("eliminado") ? "msg msg-ok" : "msg msg-err"}>
                {cancelMsg}
              </p>
            )}
            {!data ? (
              <p className="muted">Carregando…</p>
            ) : data.lots.length === 0 ? (
              <p className="muted">Você ainda não criou nenhum lote.</p>
            ) : (
              <div className="lots-table-wrap">
                <table className="bids-table lots-table">
                  <thead>
                    <tr>
                      <th>Obra</th>
                      <th>Status</th>
                      <th>Início</th>
                      <th>Fim</th>
                      <th>Lance atual</th>
                      <th>Lances</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lots.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div className="lot-cell">
                            <img
                              src={imageSrc(l.imageUrl)}
                              alt=""
                              onError={(e) => {
                                e.currentTarget.src = PLACEHOLDER;
                              }}
                            />
                            <div>
                              <Link to={`/lots/${l.id}`} className="lot-cell-title">
                                {l.title}
                              </Link>
                              <span className="muted clamp1">{l.artist ?? "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${l.status}`}>
                            {statusLabel[l.status]}
                          </span>
                        </td>
                        <td className="muted">{formatDateTime(l.startAt)} <span className="muted">({getBrowserTimeZoneLabel()})</span></td>
                        <td className="muted">{formatDateTime(l.endAt)} <span className="muted">({getBrowserTimeZoneLabel()})</span></td>
                        <td>
                          {l.currentBidCents !== null
                            ? <strong>{formatCents(l.currentBidCents)}</strong>
                            : <span className="muted">—</span>}
                        </td>
                        <td className="muted">{l.bidCount}</td>
                        <td>
                          {l.status === "scheduled" && l.bidCount === 0 && (
                            <div className="row-actions">
                              <button className="btn btn-sm btn-ghost" onClick={() => beginEdit(l)}>Editar</button>
                              <button className="btn btn-sm btn-danger" onClick={() => void deleteLot(l)}>Eliminar</button>
                            </div>
                          )}
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
          </section>
        </div>

        {/* Formulário fixo ao lado dos resultados */}
        <aside
          className={`panel-aside${selected || editingLot ? " panel-aside-active" : ""}`}
          ref={createPanelRef}
        >
          <div className="create-card card">
            {selected || editingLot ? (
              <>
                <div className="create-preview">
                  <img
                    src={imageSrc(selected?.imageUrl ?? editingLot?.imageUrl)}
                    alt={selected?.title ?? editingLot?.title ?? ""}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER;
                    }}
                  />
                  <div className="create-preview-info">
                    <span className="create-kicker">Obra selecionada</span>
                    <strong>{selected?.title ?? editingLot?.title}</strong>
                    <span className="muted clamp1">{selected?.artist ?? editingLot?.artist ?? "—"}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost create-clear"
                    onClick={() => {
                      setSelected(null);
                      setEditingLot(null);
                    }}
                    aria-label="Limpar seleção"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>

                <h2>{editingLot ? "Editar lote" : "2. Criar lote"}</h2>
                {editingLot && !selected && <p className="muted">A obra não muda. Para a substituir, pesquise e selecione outra obra na secção à esquerda.</p>}
                <form onSubmit={createLot} className="form create-form">
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
                  <p className="muted" style={{ marginTop: "-0.25rem" }}>
                    Fuso do navegador: {getBrowserTimeZoneLabel()}
                  </p>
                  {lotError && <p className="msg msg-err">{lotError}</p>}
                  {lotMsg && <p className="msg msg-ok">{lotMsg}</p>}
                  <button className="btn btn-primary btn-block" disabled={busy}>
                    {busy ? "A guardar…" : <><Icon name="gavel" size={16} /> {editingLot ? "Guardar alterações" : "Publicar lote"}</>}
                  </button>
                </form>
              </>
            ) : (
              <div className="create-empty">
                <span className="create-empty-icon"><Icon name="gallery" size={32} /></span>
                <h2>Publicar um novo lote</h2>
                <p className="muted">
                  Pesquise uma obra à esquerda e selecione-a. O formulário de criação aparece aqui mesmo, sem precisar de rolar a página.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
