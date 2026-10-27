import assert from "node:assert/strict";
import test from "node:test";
import { apiToCents, centsToApi, formatCents, parseReaisToCents } from "../src/lib/money";

const cases: [string, string, string][] = [
  ["0,01", "1", "R$ 0,01"],
  ["0,10", "10", "R$ 0,10"],
  ["1", "100", "R$ 1,00"],
  ["1.234,56", "123456", "R$ 1.234,56"],
  ["1234,5", "123450", "R$ 1.234,50"],
  ["1234", "123400", "R$ 1.234,00"],
  ["1 234,56", "123456", "R$ 1.234,56"],
  ["21.474.836,48", "2147483648", "R$ 21.474.836,48"],
  ["90.071.992.547.409,93", "9007199254740993", "R$ 90.071.992.547.409,93"],
  ["92.233.720.368.547.758,07", "9223372036854775807", "R$ 92.233.720.368.547.758,07"],
];

for (const [input, cents, formatted] of cases) {
  test(`parseia e formata ${input} sem perda de precisão`, () => {
    assert.equal(parseReaisToCents(input), BigInt(cents));
    assert.equal(formatCents(cents), formatted);
    assert.equal(apiToCents(centsToApi(BigInt(cents))), BigInt(cents));
  });
}

for (const input of ["", "1,234", "1.23,45", "-1,00", "1e3", "12,", "abc"]) {
  test(`rejeita entrada monetária inválida ${JSON.stringify(input)}`, () => {
    assert.throws(() => parseReaisToCents(input));
  });
}

test("espaços exteriores e espaços de grupo são aceites", () => {
  assert.equal(parseReaisToCents(" 1 234,56 "), 123456n);
});

test("não aceita número JSON nem centavos com zeros à esquerda", () => {
  assert.throws(() => apiToCents("01"));
  assert.throws(() => apiToCents("1.0"));
});