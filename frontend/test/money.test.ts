import assert from "node:assert/strict";
import test from "node:test";
import { formatBRL, formatCentsInput, parseCents } from "../src/lib/money";

const cases: [string, string, string][] = [
  ["0", "0", "R$ 0,00"],
  ["1", "100", "R$ 1,00"],
  ["1,5", "150", "R$ 1,50"],
  ["1.234", "123400", "R$ 1.234,00"],
  ["1 234", "123400", "R$ 1.234,00"],
  ["1.234,56", "123456", "R$ 1.234,56"],
  ["R$ 1.234,56", "123456", "R$ 1.234,56"],
  ["21.474.836", "2147483600", "R$ 21.474.836,00"],
  ["9.007.199.254.740,99", "900719925474099", "R$ 9.007.199.254.740,99"],
];

for (const [input, cents, formatted] of cases) {
  test(`parseia e formata ${input} sem perda de precisão`, () => {
    assert.equal(parseCents(input), BigInt(cents));
    assert.equal(formatBRL(cents), formatted);
    assert.equal(formatBRL(BigInt(cents)), formatted);
  });
}

for (const input of ["", "1,234", "1.234,567", "-1", "1e3", "12,", "abc", "1.23", "01", "1.234.56"]) {
  test(`rejeita entrada monetária inválida ${JSON.stringify(input)}`, () => {
    assert.throws(() => parseCents(input));
  });
}

test("espaços exteriores e espaços de grupo são aceites", () => {
  assert.equal(parseCents(" 1 234 "), 123400n);
});

test("formatar para edição devolve reais e centavos agrupados", () => {
  assert.equal(formatCentsInput(123456n), "1.234,56");
  assert.equal(formatCentsInput(123400n), "1.234,00");
  assert.equal(formatCentsInput(9223372036854775807n), "92.233.720.368.547.758,07");
});
