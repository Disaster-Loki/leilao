const MAX_REAIS = 9_223_372_036_854_775_807n;

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseReais(input: string): bigint {
  const value = input.trim().replace(/\u00a0/g, " ");
  if (!value) throw new MoneyInputError("Informe um valor válido.");

  if (!/^\d+$/.test(value) && !/^\d{1,3}(?:[. ]\d{3})+$/.test(value)) {
    throw new MoneyInputError("Informe um valor válido em reais, usando apenas dígitos.");
  }

  const reais = BigInt(value.replace(/[ .]/g, ""));
  if (reais > MAX_REAIS) throw new MoneyInputError("O valor excede o limite suportado.");
  return reais;
}

export function formatReais(value: string | bigint): string {
  const reais = typeof value === "bigint" ? value : BigInt(value);
  const negative = reais < 0n;
  const absolute = negative ? -reais : reais;
  return `${negative ? "-" : ""}R$ ${groupDigits(absolute.toString())}`;
}

export function formatReaisInput(reais: bigint): string {
  const absolute = reais < 0n ? -reais : reais;
  return groupDigits(absolute.toString());
}
