import { describe, expect, it } from "vitest";

import {
  isPermittedTransition,
  permittedTargets,
  STATUSES,
} from "../../src/tickets/domain.js";

/**
 * UNIT-02 — the status transition matrix, every cell (BR-25, BR-26, AC-20,
 * AC-21).
 *
 * The expected matrix is written out here from specification.md §5 rather than
 * derived from the module under test. A test that asked the module what it
 * permits and then asserted it permits exactly that would pass whatever the
 * module said.
 */

const PERMITTED: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

describe("UNIT-02 the status transition matrix", () => {
  it("knows the eight statuses of BR-24, in lifecycle order", () => {
    expect(STATUSES).toStrictEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "CANCELLED",
    ]);
  });

  it("answers every cell of the matrix — 64 of them — as §5 does", () => {
    const answers: Record<string, string[]> = {};

    for (const from of STATUSES) {
      answers[from] = [];

      for (const to of STATUSES) {
        const permitted = isPermittedTransition(from, to);

        expect(permitted, `${from} → ${to}`).toBe(
          PERMITTED[from]?.includes(to)
        );

        if (permitted) {
          answers[from]?.push(to);
        }
      }
    }

    expect(answers).toStrictEqual(PERMITTED);
  });

  it("refuses every transition out of CANCELLED, which is terminal (BR-26)", () => {
    for (const to of STATUSES) {
      expect(isPermittedTransition("CANCELLED", to), `to ${to}`).toBe(false);
    }

    expect(permittedTargets("CANCELLED")).toStrictEqual([]);
  });

  it("refuses a status as a transition to itself", () => {
    for (const status of STATUSES) {
      expect(isPermittedTransition(status, status), status).toBe(false);
    }
  });

  it("offers targets in lifecycle order, which is the order the control shows", () => {
    expect(permittedTargets("OPEN")).toStrictEqual([
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ]);
    expect(permittedTargets("RESOLVED")).toStrictEqual(["CLOSED", "REOPENED"]);
  });

  it("refuses a value that is not a status at all", () => {
    expect(isPermittedTransition("NEW", "DONE")).toBe(false);
    expect(isPermittedTransition("PENDING", "OPEN")).toBe(false);
    expect(permittedTargets("PENDING")).toStrictEqual([]);
  });
});
