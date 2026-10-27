import assert from "node:assert/strict";
import test from "node:test";

const originalTimezone = process.env.TZ;
const instant = "2026-10-27T13:00:00.000Z";

for (const timezone of ["Africa/Luanda", "UTC", "America/Sao_Paulo"]) {
  test(`serialização ISO e estado do lote são invariantes em ${timezone}`, () => {
    process.env.TZ = timezone;
    const stored = new Date(instant);
    assert.equal(stored.toISOString(), instant);

    const startsAt = Date.parse(instant);
    const endsAt = Date.parse("2026-10-27T14:00:00.000Z");
    const statusAt = (now: number) => now < startsAt ? "scheduled" : now < endsAt ? "live" : "ended";
    assert.equal(statusAt(Date.parse("2026-10-27T12:59:00.000Z")), "scheduled");
    assert.equal(statusAt(Date.parse("2026-10-27T13:00:00.000Z")), "live");
    assert.equal(statusAt(Date.parse("2026-10-27T14:00:00.000Z")), "ended");
  });
}

test("restaura o fuso original do processo", () => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
