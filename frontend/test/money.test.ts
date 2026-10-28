import assert from "node:assert/strict";
import test from "node:test";
import { formatReais, formatReaisInput, parseReais } from "../src/lib/money";

const cases: [string, string, string][] = [
  ["0", "0", "R$ 0"],
  ["1", "1", "R$ 1"],
  ["1.234", "1234", "R$ 1.234"],
  ["1 234", "1234", "R$ 1.234"],
  ["21.474.836", "21474836", "R$ 21.474.836"],
  ["9.007.199.254.740.993", "9007199254740993", "R$ 9.007.199.254.740.993"],
  ["9.223.372.036.854.775.807", "9223372036854775807", "R$ 9.223.372.036.854.775.807"],
];

for (const [input, reais, formatted] of cases) {
  test(`parseia e formata ${input} sem perda de precisão`, () => {
    assert.equal(parseReais(input), BigInt(reais));
    assert.equal(formatReais(reais), formatted);
    assert.equal(formatReais(BigInt(reais)), formatted);
  });
}

for (const input of ["", "1,234", "1.234,56", "-1", "1e3", "12,", "abc"]) {
  test(`rejeita entrada monetária inválida ${JSON.stringify(input)}`, () => {
    assert.throws(() => parseReais(input));
  });
}

test("espaços exteriores e espaços de grupo são aceites", () => {
  assert.equal(parseReais(" 1 234 "), 1234n);
});

test("formatar para edição devolve apenas os dígitos agrupados", () => {
  assert.equal(formatReaisInput(1234n), "1.234");
  assert.equal(formatReaisInput(9223372036854775807n), "9.223.372.036.854.775.807");
});
