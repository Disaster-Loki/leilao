import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { errorMessage } from "../lib/utils";
import type { Lot, Showcase as ShowcaseData } from "../types";
import LotCard from "../components/LotCard";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

type StatusFilter = "all" | "live" | "scheduled" | "ended";
type SortOrder = "ending" | "price-asc" | "price-desc" | "newest";

const STATUS_OPTIONS: { id: StatusFilter; label: string; icon: IconName }[] = [
  { id: "all", label: "Todos", icon: "grid" },
  { id: "live", label: "Ao vivo", icon: "dot" },
  { id: "scheduled", label: "Agendados", icon: "clock" },
  { id: "ended", label: "Encerrados", icon: "check" },
];

function priceOf(lot: Lot) {
  return lot.currentBidCents ?? lot.startPriceCents;
}

function sortLots(lots: Lot[], order: SortOrder) {
  const copy = [...lots];
  switch (order) {
    case "price-asc":
      return copy.sort((a, b) => priceOf(a) - priceOf(b));
    case "price-desc":
      return copy.sort((a, b) => priceOf(b) - priceOf(a));
    case "newest":
      return copy.sort(
        (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
      );
    default:
      return copy.sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime());
  }
}

function Section({
  title,
  subtitle,
  icon,
  lots,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  lots: Lot[];
}) {
  if (lots.length === 0) return null;
  return (
    <section className="showcase-section">
      <div className="section-heading">
        <div>
          <h2 className="section-title">
            <span className="section-icon"><Icon name={icon} size={16} /></span>
            {title}
            <span className="section-count">{lots.length}</span>
          </h2>
          <p className="section-subtitle muted">{subtitle}</p>
        </div>
      </div>
      <div className="lot-grid">
        {lots.map((l) => (
          <LotCard key={l.id} lot={l} />
        ))}
      </div>
    </section>
  );
}

export default function Showcase() {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("ending");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const d = await api<ShowcaseData>(
          `/lots${q ? `?q=${encodeURIComponent(q)}` : ""}`
        );
        if (cancelled) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [q]);

  const allLots = useMemo(
    () =>
      data
        ? [...data.live, ...data.scheduled, ...data.ended]
        : [],
    [data]
  );

  const counts = useMemo(
    () => ({
      all: allLots.length,
      live: data?.live.length ?? 0,
      scheduled: data?.scheduled.length ?? 0,
      ended: data?.ended.length ?? 0,
    }),
    [allLots.length, data]
  );

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(input.trim());
  }

  function clearSearch() {
    setInput("");
    setQ("");
  }

  const total = counts.all;
  const showSections = status === "all";
  const visibleLots =
    status === "all" ? allLots : allLots.filter((l) => l.status === status);
  const statusEmptyLabel: Record<StatusFilter, string> = {
    all: "Nenhum lote disponível agora.",
    live: "Nenhum lote ao vivo neste momento.",
    scheduled: "Nenhum lote agendado.",
    ended: "Nenhum lote encerrado.",
  };

  return (
    <div className="showcase">
      <section className="showcase-hero">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="hero-inner">
          <span className="hero-eyebrow">
            <span className="hero-pulse" /> Leilões a decorrer em tempo real
          </span>
          <h1 className="hero-title">
            Descubra arte. <span className="hero-accent">Dê o seu lance.</span>
          </h1>
          <p className="hero-sub">
            Obras de domínio público do Art Institute of Chicago, com saldo
            verificável e histórico de lances à prova de alteração.
          </p>

          <form onSubmit={search} className="search-bar" role="search">
            <span className="search-icon" aria-hidden>
              <Icon name="search" size={18} />
            </span>
            <input
              id="search-input"
              placeholder="Buscar por título, artista ou técnica…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Buscar lotes"
            />
            <button className="btn btn-primary" type="submit">
              Buscar
            </button>
            {q && (
              <button type="button" className="btn btn-ghost search-clear" onClick={clearSearch}>
                Limpar
              </button>
            )}
          </form>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{counts.live}</strong>
              <span>ao vivo</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.scheduled}</strong>
              <span>agendados</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.ended}</strong>
              <span>encerrados</span>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="msg msg-err">{error}</p>}

      <div className="filter-bar">
        <div className="filter-pills" role="tablist" aria-label="Filtrar por estado">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={status === opt.id}
              className={`filter-chip${status === opt.id ? " filter-chip-active" : ""}`}
              onClick={() => setStatus(opt.id)}
            >
              <span className="filter-chip-icon"><Icon name={opt.icon} size={13} /></span>
              {opt.label}
              <span className="filter-chip-count">{counts[opt.id]}</span>
            </button>
          ))}
        </div>

        <div className="filter-right">
          <label className="sort-field" htmlFor="sort-lots">
            <span className="muted">Ordenar</span>
            <select
              id="sort-lots"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
            >
              <option value="ending">Termina em breve</option>
              <option value="newest">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </label>
        </div>
      </div>

      {q && !loading && (
        <p className="results-meta muted">
          Resultados para <strong>“{q}”</strong> — {total} lote
          {total === 1 ? "" : "s"}
        </p>
      )}

      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card skeleton-card" />
          ))}
        </div>
      ) : total === 0 || (!showSections && visibleLots.length === 0) ? (
        <div className="empty-state">
          <p className="empty-icon"><Icon name="search" size={40} /></p>
          <p>
            {q ? `Nenhum resultado para “${q}”.` : statusEmptyLabel[status]}
          </p>
          {(q || status !== "all") && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (q) clearSearch();
                setStatus("all");
              }}
              style={{ marginTop: "1rem" }}
            >
              Ver todos os lotes
            </button>
          )}
        </div>
      ) : showSections ? (
        <>
          <Section
            title="Ao vivo agora"
            subtitle="Lotes a receber lances neste momento"
            icon="dot"
            lots={sortLots(data?.live ?? [], sort)}
          />
          <Section
            title="Próximos leilões"
            subtitle="Agendados e prontos para começar"
            icon="clock"
            lots={sortLots(data?.scheduled ?? [], sort)}
          />
          <Section
            title="Já encerrados"
            subtitle="Resultados e obras arrematadas"
            icon="check"
            lots={sortLots(data?.ended ?? [], sort)}
          />
        </>
      ) : (
        <div className="lot-grid">
          {sortLots(visibleLots, sort).map((l) => (
            <LotCard key={l.id} lot={l} />
          ))}
        </div>
      )}
    </div>
  );
}
