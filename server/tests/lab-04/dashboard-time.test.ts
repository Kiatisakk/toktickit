import { describe, expect, it } from "vitest";

import { bangkokDayStart } from "../../src/dashboard/time.js";

/**
 * UNIT-06 — the Bangkok day boundary (specification.md BR-23, AC-29).
 *
 * Every instant is fixed; nothing here reads the wall clock.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAYS_IN_YEAR = 365;

const startOf = (instant: string): string =>
  bangkokDayStart(new Date(instant)).toISOString();

describe("bangkokDayStart", () => {
  it("is the instant itself at exactly Bangkok midnight", () => {
    // 17:00:00Z is 00:00:00 in Bangkok on the 6th.
    expect(startOf("2026-10-05T17:00:00.000Z")).toBe(
      "2026-10-05T17:00:00.000Z"
    );
  });

  it("stays on the same Bangkok day one millisecond after midnight", () => {
    expect(startOf("2026-10-05T17:00:00.001Z")).toBe(
      "2026-10-05T17:00:00.000Z"
    );
  });

  it("stays on the earlier Bangkok day one millisecond before midnight", () => {
    // 16:59:59.999Z is 23:59:59.999 on the 5th in Bangkok.
    expect(startOf("2026-10-05T16:59:59.999Z")).toBe(
      "2026-10-04T17:00:00.000Z"
    );
  });

  it("is the previous UTC evening for a mid-morning UTC instant", () => {
    expect(startOf("2026-10-05T03:20:00.000Z")).toBe(
      "2026-10-04T17:00:00.000Z"
    );
  });

  it("never shifts by daylight saving across a year", () => {
    const offsets = new Set<number>();

    for (let day = 0; day < DAYS_IN_YEAR; day += 1) {
      const noonUtc = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0));

      // Noon UTC is 19:00 Bangkok, so T0 is always 19 hours earlier.
      offsets.add(noonUtc.getTime() - bangkokDayStart(noonUtc).getTime());
    }

    expect([...offsets]).toEqual([19 * HOUR_MS]);
  });

  it("handles a year boundary", () => {
    expect(startOf("2026-12-31T17:00:00.000Z")).toBe(
      "2026-12-31T17:00:00.000Z"
    );
    expect(startOf("2026-12-31T16:59:59.999Z")).toBe(
      "2026-12-30T17:00:00.000Z"
    );
  });
});
