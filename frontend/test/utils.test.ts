import assert from "node:assert/strict";
import test from "node:test";
import { formatTime, fromDatetimeLocalInput, toDatetimeLocalInput } from "../src/lib/utils";

const originalTimezone = process.env.TZ;
const instant = "2026-10-27T13:00:00.000Z";

for (const [timezone, expectedTime] of [
  ["Africa/Luanda", "14:00"],
  ["UTC", "13:00"],
  ["America/Sao_Paulo", "10:00"],
] as const) {
  test(`datas e hora local mantêm o instante em ${timezone}`, () => {
    process.env.TZ = timezone;
    const date = new Date(instant);
    const localInput = toDatetimeLocalInput(date);
    assert.equal(fromDatetimeLocalInput(localInput).toISOString(), instant);
    assert.ok(Number.isNaN(fromDatetimeLocalInput("").getTime()));
    const seedInstant = new Date(Date.parse(instant) + 5 * 60_000).toISOString();
    assert.equal(seedInstant, "2026-10-27T13:05:00.000Z");
    assert.ok(formatTime(instant).includes(expectedTime));

    const start = Date.parse(instant);
    const end = Date.parse("2026-10-27T14:00:00.000Z");
    const statusAt = (now: number) => now < start ? "scheduled" : now < end ? "live" : "ended";
    assert.equal(statusAt(Date.parse("2026-10-27T12:59:00.000Z")), "scheduled");
    assert.equal(statusAt(Date.parse("2026-10-27T13:00:00.000Z")), "live");
    assert.equal(statusAt(Date.parse("2026-10-27T14:00:00.000Z")), "ended");
  });
}

test("restaura o fuso do processo após os testes", () => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
