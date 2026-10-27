export const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;
export const CENTS_PATTERN = /^(0|[1-9]\d*)$/;

export function centsToString(value: bigint | string): string {
  return typeof value === "bigint" ? value.toString() : value;
}

export function parseCents(value: string): bigint {
  return BigInt(value);
}