import { describe, expect, it } from "vitest";

import { parseTicketQuery } from "../../src/tickets/ticketQuery.js";

/**
 * UNIT-08 — parsing `statusGroup` and `followUp` (specification.md BR-29,
 * D-15; api-spec.md section 6). The parser is a pure function, so no HTTP and
 * no database.
 */

const SCOPES = ["requester", "queue"] as const;

describe("statusGroup", () => {
  it("accepts open on both scopes", () => {
    for (const scope of SCOPES) {
      const parsed = parseTicketQuery({ statusGroup: "open" }, scope);

      expect(parsed).toEqual({
        ok: true,
        value: expect.objectContaining({ statusGroup: "open" }),
      });
    }
  });

  it("treats a blank value as absent", () => {
    for (const scope of SCOPES) {
      const parsed = parseTicketQuery({ statusGroup: "" }, scope);

      expect(parsed.ok).toBe(true);
      expect(parsed.ok && parsed.value.statusGroup).toBeUndefined();
    }
  });

  it("refuses any other value, naming the parameter", () => {
    for (const bad of ["closed", "OPEN", "all", "open,closed"]) {
      const parsed = parseTicketQuery({ statusGroup: bad }, "queue");

      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && Object.keys(parsed.details)).toEqual([
        "statusGroup",
      ]);
    }
  });

  it("refuses a repeated value", () => {
    const parsed = parseTicketQuery({ statusGroup: ["open", "open"] }, "queue");

    expect(parsed.ok).toBe(false);
  });

  it("refuses it together with status", () => {
    for (const scope of SCOPES) {
      const parsed = parseTicketQuery(
        { statusGroup: "open", status: "NEW" },
        scope
      );

      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && Object.keys(parsed.details)).toContain(
        "statusGroup"
      );
    }
  });

  it("allows a blank status next to statusGroup", () => {
    const parsed = parseTicketQuery(
      { statusGroup: "open", status: "" },
      "queue"
    );

    expect(parsed.ok).toBe(true);
  });
});

describe("followUp", () => {
  it("accepts mine on the queue", () => {
    const parsed = parseTicketQuery({ followUp: "mine" }, "queue");

    expect(parsed).toEqual({
      ok: true,
      value: expect.objectContaining({ followUp: "mine" }),
    });
  });

  it("treats a blank value as absent on the queue", () => {
    const parsed = parseTicketQuery({ followUp: "" }, "queue");

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.followUp).toBeUndefined();
  });

  it("refuses any other value, including an id", () => {
    for (const bad of ["theirs", "11", "MINE", "true"]) {
      const parsed = parseTicketQuery({ followUp: bad }, "queue");

      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && Object.keys(parsed.details)).toEqual(["followUp"]);
    }
  });

  it("is refused on the My Tickets scope", () => {
    const parsed = parseTicketQuery({ followUp: "mine" }, "requester");

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && Object.keys(parsed.details)).toEqual(["followUp"]);
  });
});
