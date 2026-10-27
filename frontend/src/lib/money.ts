const MAX_CENTS = 9_223_372_036_854_775_807n;

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

export function parseReaisToCents(input: string): bigint {
  const value = input.trim().replace(/\u00a0/g, " ");
  if (!value) throw new MoneyInputError("Informe um valor válido.");

  let integerPart: string;
  let decimalPart = "";
  if (value.includes(",")) {
    if ((value.match(/,/g) ?? []).length !== 1) {
      throw new MoneyInputError("Informe no máximo duas casas decimais.");
    }
    [integerPart, decimalPart] = value.split(",");
    if (!/^\d{1,2}$/.test(decimalPart)) {
      throw new MoneyInputError("Informe no máximo duas casas decimais.");
    }
    if (!/^(?:\d+|\d{1,3}(?:[ .]\d{3})+)$/.test(integerPart)) {
      throw new MoneyInputError("Informe um valor válido.");
    }
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value) || /^\d{1,3}(?: \d{3})+$/.test(value)) {
    integerPart = value;
  } else if (/^\d+(?:\.\d{1,2})?$/.test(value)) {
    [integerPart, decimalPart = ""] = value.split(".");
  } else {
    throw new MoneyInputError("Informe um valor válido com no máximo duas casas decimais.");
  }

  const integerDigits = integerPart.replace(/[ .]/g, "");
  const cents = BigInt(integerDigits) * 100n + BigInt((decimalPart + "00").slice(0, 2));
  if (cents > MAX_CENTS) throw new MoneyInputError("O valor excede o limite suportado.");
  return cents;
}

export function formatCents(cents: string | bigint): string {
  const value = typeof cents === "bigint" ? cents : apiToCents(cents);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const reais = absolute / 100n;
  const centavos = (absolute % 100n).toString().padStart(2, "0");
  const grouped = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(reais);
  return `${negative ? "-" : ""}R$ ${grouped},${centavos}`;
}

export function formatReaisInput(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  const reais = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(absolute / 100n);
  const centavos = (absolute % 100n).toString().padStart(2, "0");
  return `${reais},${centavos}`;
}

export function centsToApi(cents: bigint): string {
  if (cents < 0n || cents > MAX_CENTS) throw new RangeError("Valor em centavos fora do limite BIGINT.");
  return cents.toString();
}

export function apiToCents(value: string): bigint {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new TypeError("Valor monetário da API inválido.");
  const cents = BigInt(value);
  if (cents > MAX_CENTS) throw new RangeError("Valor monetário da API excede BIGINT.");
  return cents;
}
