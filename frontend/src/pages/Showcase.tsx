import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { errorMessage } from "../lib/utils";
import type { Lot, Showcase as ShowcaseData } from "../types";
import LotCard from "../components/LotCard";

function Section({
  title,
  emoji,
  lots,
}: {
  title: string;
  emoji: string;
  lots: Lot[];
}) {
  if (lots.length === 0) return null;
  return (
    <section className="showcase-section">
      <h2 className="section-title">
        <span className="section-emoji">{emoji}</span>
        {title}
        <span className="section-count">{lots.length}</span>
      </h2>
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api<ShowcaseData>(
        `/lots${q ? `?q=${encodeURIComponent(q)}` : ""}`
      );
      setData(d);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(input.trim());
  }

  const total =
    (data?.live.length ?? 0) +
    (data?.scheduled.length ?? 0) +
    (data?.ended.length ?? 0);

  return (
    <div className="showcase">
      <div className="showcase-hero">
        <h1 className="hero-title">Leilões de Arte Online</h1>
        <p className="hero-sub muted">
          Disputas em tempo real · Saldo verificável · Histórico imutável
        </p>
        <form onSubmit={search} className="search-bar">
          <input
            id="search-input"
            placeholder="Buscar por título ou artista…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            Buscar
          </button>
          {q && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setInput("");
                setQ("");
              }}
            >
              Limpar
            </button>
          )}
        </form>
      </div>

      {error && <p className="msg msg-err">{error}</p>}

      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card skeleton-card" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">🔍</p>
          <p>{q ? `Nenhum resultado para "${q}".` : "Nenhum lote disponível agora."}</p>
        </div>
      ) : (
        <>
          <Section title="Ao vivo agora" emoji="🔴" lots={data?.live ?? []} />
          <Section title="Agendados" emoji="📅" lots={data?.scheduled ?? []} />
          <Section title="Encerrados" emoji="✅" lots={data?.ended ?? []} />
        </>
      )}
    </div>
  );
}
