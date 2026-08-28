import { describe, expect, it } from "vitest";

import { prisma } from "../../src/prisma.js";
import {
  claimTicketNumber,
  formatTicketNumber,
  TICKET_NUMBER_PATTERN,
} from "../../src/tickets/ticketNumber.js";

/**
 * UNIT-01 — the format matches what both labsheet figures show.
 * UNIT-02 — the sequence advances, and starts again in a new year.
 *
 * The formatter is pure and tested without a database. The claim is not: its
 * whole reason for existing is that PostgreSQL serialises it, so testing it
 * against anything else would test the wrong thing.
 */

describe("formatTicketNumber", () => {
  it("produces TKT-<year>-<six digits>", () => {
    expect(formatTicketNumber(2025, 1234)).toBe("TKT-2025-001234");
  });

  it("pads the sequence to six digits", () => {
    expect(formatTicketNumber(2025, 1)).toBe("TKT-2025-000001");
  });

  it("matches the figures in the labsheet", () => {
    // The My Tickets illustration shows TKT-2025-001227 through TKT-2025-001234.
    expect(formatTicketNumber(2025, 1234)).toBe("TKT-2025-001234");
    expect(formatTicketNumber(2025, 1227)).toBe("TKT-2025-001227");
  });

  it("does not truncate a sequence past six digits", () => {
    // Better a seven-digit number than a silently wrong one; the year would
    // have to produce a million tickets first.
    expect(formatTicketNumber(2025, 1_234_567)).toBe("TKT-2025-1234567");
  });

  it("always satisfies the documented pattern for realistic sequences", () => {
    for (const sequence of [1, 42, 999, 100_000, 999_999]) {
      expect(formatTicketNumber(2026, sequence)).toMatch(TICKET_NUMBER_PATTERN);
    }
  });
});

describe("claimTicketNumber", () => {
  // Years far enough out that nothing else in the suite shares a counter row.
  const YEAR_A = 3001;
  const YEAR_B = 3002;

  const cleanup = () =>
    prisma.ticketCounter.deleteMany({
      where: { year: { in: [YEAR_A, YEAR_B] } },
    });

  it("starts a new year at 000001", async () => {
    await cleanup();

    const first = await prisma.$transaction((tx) =>
      claimTicketNumber(tx, YEAR_A)
    );

    expect(first).toBe(`TKT-${YEAR_A}-000001`);

    await cleanup();
  });

  it("advances on each claim", async () => {
    await cleanup();

    // Written out rather than looped: these have to run one after another for
    // the assertion to mean anything, and running them together is a different
    // test, at the bottom of this file.
    const first = await prisma.$transaction((tx) =>
      claimTicketNumber(tx, YEAR_A)
    );
    const second = await prisma.$transaction((tx) =>
      claimTicketNumber(tx, YEAR_A)
    );
    const third = await prisma.$transaction((tx) =>
      claimTicketNumber(tx, YEAR_A)
    );

    expect([first, second, third]).toEqual([
      `TKT-${YEAR_A}-000001`,
      `TKT-${YEAR_A}-000002`,
      `TKT-${YEAR_A}-000003`,
    ]);

    await cleanup();
  });

  // BR-04. Each year keeps its own counter, so a new year restarts rather than
  // carrying on from where the last one stopped.
  it("restarts the sequence in a different year", async () => {
    await cleanup();

    await prisma.$transaction((tx) => claimTicketNumber(tx, YEAR_A));
    await prisma.$transaction((tx) => claimTicketNumber(tx, YEAR_A));
    const nextYear = await prisma.$transaction((tx) =>
      claimTicketNumber(tx, YEAR_B)
    );

    expect(nextYear).toBe(`TKT-${YEAR_B}-000001`);

    await cleanup();
  });

  // The reason this is a single INSERT … ON CONFLICT … RETURNING rather than a
  // read followed by a write. Under a read-then-write, several of these would
  // read the same value and claim the same number.
  it("gives every concurrent claim a different number", async () => {
    await cleanup();

    const claims = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.$transaction((tx) => claimTicketNumber(tx, YEAR_A))
      )
    );

    expect(new Set(claims).size).toBe(claims.length);

    await cleanup();
  });
});
