const MAX_CENTS = 9_223_372_036_854_775_807n;

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Converte a entrada em pt-BR para centavos inteiros.
// Aceita "1.234,56", "1234,56", "1234", "1 234" e "R$ 1.234,56".
export function parseCents(input: string): bigint {
  const value = input
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/^R\$\s*/i, "")
    .replace(/ /g, "");

  if (!value) throw new MoneyInputError("Informe um valor válido.");

  const match = value.match(/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/);
  if (!match) {
    throw new MoneyInputError("Informe um valor válido em reais, como 1.234,56.");
  }

  const [integerPart, decimalPart = ""] = value.split(",");
  const digits = integerPart.replace(/\./g, "");
  if (/^0\d/.test(digits)) {
    throw new MoneyInputError("Informe um valor válido em reais, como 1.234,56.");
  }

  const cents =
    BigInt(digits) * 100n + BigInt((decimalPart + "00").slice(0, 2));
  if (cents > MAX_CENTS) throw new MoneyInputError("O valor excede o limite suportado.");
  return cents;
}

export function formatBRL(value: string | bigint): string {
  const cents = typeof value === "bigint" ? value : BigInt(value);
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const reais = absolute / 100n;
  const centavos = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}R$ ${groupDigits(reais.toString())},${centavos}`;
}

export function formatCentsInput(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  const reais = absolute / 100n;
  const centavos = (absolute % 100n).toString().padStart(2, "0");
  return `${groupDigits(reais.toString())},${centavos}`;
}
