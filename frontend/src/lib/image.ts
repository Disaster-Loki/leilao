const API = import.meta.env.VITE_API_URL as string;

export const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1f2333"/>
          <stop offset="1" stop-color="#13161e"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-family="system-ui" font-size="14">Imagem indisponível</text>
    </svg>`
  );

/**
 * O Art Institute bloqueia pedidos de imagem feitos diretamente pelo browser
 * (Cloudflare). Passamos as imagens pela nossa API para que funcionem sempre.
 */
export function imageSrc(url: string | null | undefined): string {
  if (!url) return PLACEHOLDER;
  if (url.startsWith("data:")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("artic.edu") && parsed.pathname.startsWith("/iiif/2/")) {
      return `${API}/external/image?src=${encodeURIComponent(url)}`;
    }
  } catch {
    return PLACEHOLDER;
  }
  return url;
}
