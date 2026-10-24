import { AppError } from "../../middleware/error";

const BASE = "https://api.artic.edu/api/v1";
const IIIF = "https://www.artic.edu/iiif/2";
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FIELDS =
  "id,title,artist_display,date_display,medium_display,image_id,is_public_domain,place_of_origin,dimensions,classification_title";

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

function toArtwork(a: any): Artwork {
  const img = a.image_id ? `${IIIF}/${a.image_id}` : null;
  return {
    externalId: String(a.id),
    title: a.title,
    artist: a.artist_display ?? null,
    dateDisplay: a.date_display ?? null,
    medium: a.medium_display ?? null,
    imageUrl: img ? `${img}/full/843,/0/default.jpg` : null,
    thumbnailUrl: img ? `${img}/full/200,/0/default.jpg` : null,
    attributes: {
      source: "Art Institute of Chicago",
      sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
      placeOfOrigin: a.place_of_origin ?? null,
      dimensions: a.dimensions ?? null,
      classification: a.classification_title ?? null,
    },
  };
}

export async function searchArtworks(q: string): Promise<Artwork[]> {
  const url = `${BASE}/artworks/search?q=${encodeURIComponent(q)}&limit=30&fields=${FIELDS}`;
  const json = await getJson(url);
  return (json.data as any[])
    .filter((a) => a.image_id && a.is_public_domain) // só com imagem e domínio público
    .map(toArtwork);
}

export async function getArtwork(externalId: string): Promise<Artwork> {
  const json = await getJson(`${BASE}/artworks/${externalId}?fields=${FIELDS}`);
  return toArtwork(json.data);
}