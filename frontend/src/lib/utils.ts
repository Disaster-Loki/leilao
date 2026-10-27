import type { ApiError } from "../api/client";
import { formatCents } from "./money";

export function getBrowserTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(seconds);
  const unit = absSeconds < 60 ? "second" : absSeconds < 3600 ? "minute" : absSeconds < 86400 ? "hour" : "day";
  const divisor = unit === "second" ? 1 : unit === "minute" ? 60 : unit === "hour" ? 3600 : 86400;
  return new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" }).format(
    Math.round(seconds / divisor),
    unit,
  );
}

export function toDatetimeLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDatetimeLocalInput(value: string): Date {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return new Date(NaN);
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ─── Tradução de erros da API ───
export function errorMessage(e: unknown): string {
  const err = (e ?? {}) as ApiError;

  const details = err.details;
  const d: Record<string, unknown> = Array.isArray(details)
    ? {}
    : ((details ?? {}) as Record<string, unknown>);

  switch (err.error) {
    case "BID_BELOW_MINIMUM":
      return typeof d.minCents === "string"
        ? `O seu lance está abaixo do mínimo permitido. O valor mínimo é ${formatCents(d.minCents)}.`
        : "O seu lance está abaixo do mínimo permitido.";
    case "INSUFFICIENT_BALANCE":
      return typeof d.availableCents === "string"
        ? `Saldo insuficiente. O valor disponível é ${formatCents(d.availableCents)}.`
        : "Saldo insuficiente.";
    case "DEPOSIT_BELOW_MINIMUM":
      return "O depósito está abaixo do valor mínimo permitido.";
    case "DEPOSIT_ABOVE_MAXIMUM":
      return "O depósito excede o valor máximo permitido.";
    case "WALLET_ABOVE_MAXIMUM":
      return "Este depósito excederia o saldo máximo permitido na carteira.";
    case "ALREADY_LEADING":
      return "Já está a ganhar este lote, não pode cobrir o seu próprio lance.";
    case "LOT_NOT_STARTED":
      return "Este lote ainda não começou.";
    case "LOT_ENDED":
      return "Este leilão já terminou.";
    case "LOT_NOT_FOUND":
      return "Lote não encontrado.";
    case "LOT_ALREADY_CANCELLED":
      return "Este lote já foi cancelado.";
    case "LOT_ALREADY_SETTLED":
      return "Não é possível cancelar um lote já arrematado.";
    case "RECEIPT_NOT_FOUND":
      return "Comprovante não encontrado.";
    case "WALLET_NOT_FOUND":
      return "Carteira não encontrada.";
    case "INVALID_CREDENTIALS":
      return "E-mail ou palavra-passe incorretos.";
    case "EMAIL_ALREADY_EXISTS":
      return "Já existe uma conta com este e-mail.";
    case "UNAUTHENTICATED":
    case "INVALID_TOKEN":
      return "Sessão expirada. Inicie sessão novamente.";
    case "FORBIDDEN":
      return "Sem permissão para esta ação.";
    case "VALIDATION_ERROR": {
      if (Array.isArray(details) && details.length > 0) {
        const first = details[0] as Record<string, unknown>;
        if (typeof first?.message === "string") return first.message;
      }
      return "Dados inválidos. Verifique os campos.";
    }
    case "EXTERNAL_API_UNAVAILABLE":
      return "O serviço de busca está temporariamente indisponível. Tente novamente.";
    case "ARTWORK_NOT_FOUND":
      return "Obra não encontrada na API externa.";
    case "NETWORK_ERROR":
      return "Sem ligação com o servidor. Tente novamente.";
    case "API_NOT_CONFIGURED":
      return "A URL da API não está configurada neste ambiente.";
    case "INVALID_RESPONSE":
      return "O servidor devolveu uma resposta inválida. Verifique a configuração da API.";
    default:
      return typeof err.message === "string" ? err.message : "Ocorreu um erro inesperado.";
  }
}
