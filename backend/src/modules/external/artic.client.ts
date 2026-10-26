import { AppError } from "../../middleware/error";

const BASE = "https://api.artic.edu/api/v1";
const IIIF = "https://www.artic.edu/iiif/2";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const TIMEOUT_MS = 5000;
const COMMONS_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const COMMONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FIELDS =
  "id,title,artist_display,date_display,medium_display,image_id,is_public_domain,place_of_origin,dimensions,classification_title,main_reference_number";

export interface Artwork {
  externalId: string;
  title: string;
  artist: string | null;
  dateDisplay: string | null;
  medium: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  attributes: Record<string, unknown>;
}

const cache = new Map<string, { at: number; data: unknown }>();
const commonsCache = new Map<string, { at: number; url: string | null }>();

async function getJson(url: string): Promise<any> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    // timeout, DNS, sem rede...
    throw new AppError(503, "EXTERNAL_API_UNAVAILABLE");
  }
  if (res.status === 404) throw new AppError(404, "ARTWORK_NOT_FOUND");
  if (!res.ok) throw new AppError(503, "EXTERNAL_API_UNAVAILABLE");

  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

function commonsQuery(a: any): string | null {
  // O número de inventário é o identificador mais fiável: os ficheiros do AIC
  // no Wikimedia Commons incluem o accession number no nome.
  const accession = typeof a.main_reference_number === "string"
    ? a.main_reference_number.trim()
    : "";
  if (accession) return `"${accession}" Art Institute of Chicago`;
  if (a.title) {
    return `"${a.title}" ${a.artist_display ?? ""} Art Institute of Chicago`.trim();
  }
  return null;
}

async function resolveCommonsImage(a: any): Promise<string | null> {
  if (!a.image_id) return null;

  const key = String(a.image_id);
  const cached = commonsCache.get(key);
  if (cached && Date.now() - cached.at < COMMONS_CACHE_TTL_MS) return cached.url;

  const query = commonsQuery(a);
  if (!query) return null;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "3",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "960",
    format: "json",
  });

  let url: string | null = null;
  try {
    const res = await fetch(`${COMMONS_API}?${params}`, {
      headers: {
        "User-Agent": "CasaDeLeiloes/1.0 (https://github.com/Disaster-Loki/leilao)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(COMMONS_TIMEOUT_MS),
    });
    if (res.ok) {
      const json: any = await res.json();
      const pages = Object.values(json.query?.pages ?? {}) as any[];
      pages.sort((x, y) => (x.index ?? 99) - (y.index ?? 99));
      const file = pages.find((p) => p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url);
      const candidate = file?.imageinfo?.[0]?.thumburl ?? file?.imageinfo?.[0]?.url ?? null;
      if (candidate && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(candidate)) {
        url = String(candidate).split("?")[0];
      }
    }
  } catch {
    // Se o Commons falhar, o lote continua a ser criado; a imagem cai no
    // proxy do AIC ou no placeholder do front-end.
  }

  commonsCache.set(key, { at: Date.now(), url });
  return url;
}

async function toArtwork(a: any): Promise<Artwork> {
  const img = a.image_id ? `${IIIF}/${a.image_id}` : null;
  const commonsUrl = await resolveCommonsImage(a);
  return {
    externalId: String(a.id),
    title: a.title,
    artist: a.artist_display ?? null,
    dateDisplay: a.date_display ?? null,
    medium: a.medium_display ?? null,
    imageUrl: commonsUrl ?? (img ? `${img}/full/843,/0/default.jpg` : null),
    thumbnailUrl: commonsUrl ?? (img ? `${img}/full/200,/0/default.jpg` : null),
    attributes: {
      source: "Art Institute of Chicago",
      sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
      placeOfOrigin: a.place_of_origin ?? null,
      dimensions: a.dimensions ?? null,
      classification: a.classification_title ?? null,
    },
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function searchArtworks(q: string): Promise<Artwork[]> {
  const url = `${BASE}/artworks/search?q=${encodeURIComponent(q)}&limit=30&fields=${FIELDS}`;
  const json = await getJson(url);
  const works = (json.data as any[]).filter(
    (a) => a.image_id && a.is_public_domain // só com imagem e domínio público
  );
  return mapLimit(works, 6, toArtwork);
}

export async function getArtwork(externalId: string): Promise<Artwork> {
  const json = await getJson(`${BASE}/artworks/${externalId}?fields=${FIELDS}`);
  return toArtwork(json.data);
}