import type { ApiError } from "../api/client";

// ─── Formatação de dinheiro ───
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  return cents > 0 ? cents : null;
}

export function toInputMoney(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
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

  // details pode ser um array de issues Zod ou um objecto com campos extra
  const details = err.details;
  const d: Record<string, unknown> = Array.isArray(details)
    ? {}
    : ((details ?? {}) as Record<string, unknown>);

  switch (err.error) {
    case "BID_BELOW_MINIMUM":
      return typeof d.minCents === "number"
        ? `Lance abaixo do mínimo permitido (${formatMoney(d.minCents)}).`
        : "Lance abaixo do mínimo permitido.";
    case "INSUFFICIENT_BALANCE":
      return typeof d.availableCents === "number"
        ? `Saldo insuficiente. Disponível: ${formatMoney(d.availableCents)}.`
        : "Saldo insuficiente.";
    case "ALREADY_LEADING":
      return "Você já está ganhando este lote.";
    case "LOT_NOT_STARTED":
      return "Este lote ainda não foi iniciado.";
    case "LOT_ENDED":
      return "Este lote já foi encerrado.";
    case "LOT_NOT_FOUND":
      return "Lote não encontrado.";
    case "LOT_HAS_BIDS":
      return "Não é possível cancelar um lote com lances.";
    case "LOT_ALREADY_CANCELLED":
      return "Este lote já foi cancelado.";
    case "RECEIPT_NOT_FOUND":
      return "Comprovante não encontrado.";
    case "WALLET_NOT_FOUND":
      return "Carteira não encontrada.";
    case "INVALID_CREDENTIALS":
      return "E-mail ou senha incorretos.";
    case "EMAIL_ALREADY_EXISTS":
      return "Já existe uma conta com este e-mail.";
    case "UNAUTHENTICATED":
    case "INVALID_TOKEN":
      return "Sessão expirada. Entre novamente.";
    case "FORBIDDEN":
      return "Sem permissão para esta ação.";
    case "VALIDATION_ERROR": {
      // O backend devolve err.issues do Zod — mostramos a primeira mensagem específica
      // Ex: "A senha deve conter pelo menos uma letra maiúscula"
      if (Array.isArray(details) && details.length > 0) {
        const first = details[0] as Record<string, unknown>;
        if (typeof first?.message === "string") return first.message;
      }
      return "Dados inválidos. Verifique os campos.";
    }
    case "EXTERNAL_API_UNAVAILABLE":
      return "Serviço de busca indisponível. Tente novamente.";
    case "ARTWORK_NOT_FOUND":
      return "Obra não encontrada na API externa.";
    case "NETWORK_ERROR":
      return "Sem conexão com o servidor. Tente novamente.";
    default:
      return "Ocorreu um erro inesperado.";
  }
}
