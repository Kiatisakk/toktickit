import { describe, expect, it } from "vitest";

import {
  ACTION_STATES,
  followUpStateOf,
  isPermittedActionTransition,
} from "../../src/actions/domain.js";
import type { ActionState } from "../../src/actions/domain.js";
import {
  mergeFollowUp,
  validateCancel,
  validateComplete,
  validateCreateAction,
  validateEditAction,
  validateRequestId,
  validateVersion,
} from "../../src/actions/validation.js";
import {
  evaluateResolutionGate,
  gateFactsOf,
  validateResolutionSummary,
} from "../../src/tickets/resolutionGate.js";

/**
 * UNIT-01, UNIT-02, UNIT-04, UNIT-07 and UNIT-09 — the Action rules that need
 * neither HTTP nor a database (BR-03, BR-08, BR-09, BR-14, BR-19, BR-35).
 *
 * Expected values are written out here from specification.md rather than
 * derived from the modules under test.
 */

const NOW = new Date("2026-10-05T03:00:00.000Z");
const UUID = "0b3f4c1e-7a52-4c1b-9d86-2f3a5e8c1d90";

const repeat = (length: number): string => "x".repeat(length);

const okCreate = (overrides: Record<string, unknown> = {}) =>
  validateCreateAction(
    { requestId: UUID, description: "Replaced cable", ...overrides },
    NOW
  );

const detailsOf = (result: {
  ok: boolean;
  details?: Record<string, string>;
}) => (result.ok ? null : Object.keys(result.details ?? {}));

describe("UNIT-01 the Action state machine", () => {
  const PERMITTED: Record<ActionState, ActionState[]> = {
    PLANNED: ["DONE", "CANCELLED"],
    DONE: [],
    CANCELLED: [],
  };

  it("knows the three states of BR-03", () => {
    expect([...ACTION_STATES]).toStrictEqual(["PLANNED", "DONE", "CANCELLED"]);
  });

  for (const from of ACTION_STATES) {
    for (const to of ACTION_STATES) {
      const allowed = PERMITTED[from].includes(to);

      it(`${from} -> ${to} is ${allowed ? "permitted" : "refused"}`, () => {
        expect(isPermittedActionTransition(from, to)).toBe(allowed);
      });
    }
  }
});

describe("UNIT-02 follow-up state derivation", () => {
  const cases: {
    required: boolean;
    state: ActionState;
    followers: ActionState[];
    expected: string;
  }[] = [
    {
      required: false,
      state: "PLANNED",
      followers: [],
      expected: "NOT_REQUIRED",
    },
    { required: false, state: "DONE", followers: [], expected: "NOT_REQUIRED" },
    {
      required: false,
      state: "CANCELLED",
      followers: [],
      expected: "NOT_REQUIRED",
    },
    { required: true, state: "CANCELLED", followers: [], expected: "VOID" },
    {
      required: true,
      state: "CANCELLED",
      followers: ["DONE"],
      expected: "VOID",
    },
    { required: true, state: "PLANNED", followers: [], expected: "OPEN" },
    { required: true, state: "DONE", followers: [], expected: "OPEN" },
    { required: true, state: "DONE", followers: ["PLANNED"], expected: "OPEN" },
    {
      required: true,
      state: "DONE",
      followers: ["CANCELLED"],
      expected: "OPEN",
    },
    {
      required: true,
      state: "DONE",
      followers: ["PLANNED", "CANCELLED"],
      expected: "OPEN",
    },
    { required: true, state: "DONE", followers: ["DONE"], expected: "CLOSED" },
    {
      required: true,
      state: "PLANNED",
      followers: ["DONE"],
      expected: "CLOSED",
    },
    {
      required: true,
      state: "DONE",
      followers: ["PLANNED", "DONE"],
      expected: "CLOSED",
    },
  ];

  for (const c of cases) {
    it(`required=${c.required} state=${c.state} followers=[${c.followers.join(",")}] is ${c.expected}`, () => {
      expect(
        followUpStateOf(
          { followUpRequired: c.required, state: c.state },
          c.followers
        )
      ).toBe(c.expected);
    });
  }
});

describe("UNIT-04 Action input validation", () => {
  it("accepts a description of 1 and of 2000 characters, and refuses 2001", () => {
    expect(okCreate({ description: "a" }).ok).toBe(true);
    expect(okCreate({ description: repeat(2000) }).ok).toBe(true);
    expect(detailsOf(okCreate({ description: repeat(2001) }))).toStrictEqual([
      "description",
    ]);
  });

  it("counts a description after trimming, and refuses a blank one", () => {
    expect(detailsOf(okCreate({ description: "   " }))).toStrictEqual([
      "description",
    ]);

    const padded = okCreate({ description: `  ${repeat(2000)}  ` });

    expect(padded.ok && padded.value.description).toBe(repeat(2000));
  });

  it("refuses a missing description", () => {
    expect(
      detailsOf(validateCreateAction({ requestId: UUID }, NOW))
    ).toStrictEqual(["description"]);
  });

  it("bounds result at 1 to 2000 and allows it absent or null", () => {
    expect(okCreate({ result: repeat(2000) }).ok).toBe(true);
    expect(okCreate({ result: null }).ok).toBe(true);
    expect(okCreate().ok).toBe(true);
    expect(detailsOf(okCreate({ result: repeat(2001) }))).toStrictEqual([
      "result",
    ]);
    expect(detailsOf(okCreate({ result: "  " }))).toStrictEqual(["result"]);
  });

  it("bounds attachment notes at 1000", () => {
    expect(okCreate({ attachmentNotes: repeat(1000) }).ok).toBe(true);
    expect(
      detailsOf(okCreate({ attachmentNotes: repeat(1001) }))
    ).toStrictEqual(["attachmentNotes"]);
  });

  it("requires the note exactly when follow-up is required (BR-08)", () => {
    expect(
      okCreate({ followUpRequired: true, followUpNote: "Check in a week" }).ok
    ).toBe(true);
    expect(
      okCreate({ followUpRequired: true, followUpNote: repeat(1000) }).ok
    ).toBe(true);
    expect(
      detailsOf(
        okCreate({ followUpRequired: true, followUpNote: repeat(1001) })
      )
    ).toStrictEqual(["followUpNote"]);
    expect(detailsOf(okCreate({ followUpRequired: true }))).toStrictEqual([
      "followUpNote",
    ]);
    expect(
      detailsOf(okCreate({ followUpRequired: true, followUpNote: " " }))
    ).toStrictEqual(["followUpNote"]);
    expect(detailsOf(okCreate({ followUpNote: "Orphan" }))).toStrictEqual([
      "followUpNote",
    ]);
    expect(
      detailsOf(okCreate({ followUpRequired: false, followUpNote: "Orphan" }))
    ).toStrictEqual(["followUpNote"]);
    expect(okCreate({ followUpRequired: false, followUpNote: null }).ok).toBe(
      true
    );
  });

  it("allows an action time up to one minute ahead and refuses more", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

    expect(okCreate({ actionAt: at(60_000) }).ok).toBe(true);
    expect(okCreate({ actionAt: at(-86_400_000) }).ok).toBe(true);
    expect(detailsOf(okCreate({ actionAt: at(60_001) }))).toStrictEqual([
      "actionAt",
    ]);
  });

  it("refuses an action time that is not an ISO 8601 instant", () => {
    expect(detailsOf(okCreate({ actionAt: "yesterday" }))).toStrictEqual([
      "actionAt",
    ]);
    expect(detailsOf(okCreate({ actionAt: "2026-10-05" }))).toStrictEqual([
      "actionAt",
    ]);
    expect(detailsOf(okCreate({ actionAt: 1_759_633_200_000 }))).toStrictEqual([
      "actionAt",
    ]);
  });

  it("refuses wrong types and unknown fields, naming each", () => {
    expect(detailsOf(okCreate({ followUpRequired: "yes" }))).toStrictEqual([
      "followUpRequired",
    ]);
    expect(detailsOf(okCreate({ performedById: "7" }))).toStrictEqual([
      "performedById",
    ]);
    expect(detailsOf(okCreate({ performedById: 0 }))).toStrictEqual([
      "performedById",
    ]);
    expect(detailsOf(okCreate({ followsUpId: 1.5 }))).toStrictEqual([
      "followsUpId",
    ]);
    expect(
      detailsOf(
        okCreate({ recordedById: 1, state: "DONE", ticketId: 2, version: 3 })
      )
    ).toStrictEqual(["recordedById", "state", "ticketId", "version"]);
    expect(detailsOf(validateCreateAction(null, NOW))).not.toBeNull();
    expect(detailsOf(validateCreateAction([], NOW))).not.toBeNull();
  });

  it("returns defaults for everything left out", () => {
    const result = okCreate();

    expect(result).toStrictEqual({
      ok: true,
      value: {
        requestId: UUID,
        description: "Replaced cable",
        actionAt: null,
        result: null,
        performedById: null,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        followsUpId: null,
      },
    });
  });

  it("validates an edit with the same bounds and refuses fixed fields", () => {
    const edit = (body: Record<string, unknown>) =>
      validateEditAction({ version: 1, ...body }, NOW);

    expect(edit({ description: "New" }).ok).toBe(true);
    expect(detailsOf(edit({ description: repeat(2001) }))).toStrictEqual([
      "description",
    ]);
    expect(detailsOf(edit({}))).not.toBeNull();
    expect(
      detailsOf(
        edit({
          ticketId: 1,
          recordedById: 1,
          state: "DONE",
          followsUpId: 2,
          cancelReason: "x",
          createdAt: "x",
        })
      )
    ).toStrictEqual([
      "ticketId",
      "recordedById",
      "state",
      "followsUpId",
      "cancelReason",
      "createdAt",
    ]);
  });

  it("merges follow-up fields against the stored ones (BR-08, BR-10)", () => {
    expect(
      mergeFollowUp({ required: false, note: null }, { required: true })
    ).toStrictEqual({
      ok: false,
      details: { followUpNote: expect.any(String) },
    });
    expect(
      mergeFollowUp({ required: true, note: "n" }, { required: false })
    ).toStrictEqual({ ok: true, required: false, note: null });
    expect(
      mergeFollowUp({ required: true, note: "n" }, { note: "m" })
    ).toStrictEqual({ ok: true, required: true, note: "m" });
    expect(
      mergeFollowUp({ required: false, note: null }, { note: "m" })
    ).toStrictEqual({
      ok: false,
      details: { followUpNote: expect.any(String) },
    });
    expect(
      mergeFollowUp({ required: true, note: "n" }, { note: null })
    ).toStrictEqual({
      ok: false,
      details: { followUpNote: expect.any(String) },
    });
  });
});

describe("UNIT-07 version parsing", () => {
  it("accepts a positive integer", () => {
    expect(validateVersion(1)).toStrictEqual({ ok: true, value: 1 });
    expect(validateVersion(42)).toStrictEqual({ ok: true, value: 42 });
  });

  it.each([
    undefined,
    null,
    0,
    -1,
    1.5,
    "1",
    true,
    [],
    {},
    Number.NaN,
    2 ** 53,
  ])("refuses %s with details.version", (value) => {
    const result = validateVersion(value);

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.details)).toStrictEqual([
      "version",
    ]);
  });
});

describe("UNIT-09 requestId validation", () => {
  it("accepts a UUID", () => {
    expect(validateRequestId(UUID)).toStrictEqual({ ok: true, value: UUID });
  });

  it.each([undefined, null, "", "   ", "not-a-uuid", `${UUID}0`, 12, {}, true])(
    "refuses %s with details.requestId",
    (value) => {
      const result = validateRequestId(value);

      expect(result.ok).toBe(false);
      expect(!result.ok && Object.keys(result.details)).toStrictEqual([
        "requestId",
      ]);
    }
  );

  it("is refused on create when missing", () => {
    expect(
      detailsOf(validateCreateAction({ description: "x" }, NOW))
    ).toContain("requestId");
  });
});

describe("UNIT-04 an action time must be a real calendar moment (review of PR 81)", () => {
  it.each([
    ["30 February", "2026-02-30T10:00:00Z"],
    ["29 February in a common year", "2026-02-29T10:00:00Z"],
    ["31 April", "2026-04-31T10:00:00Z"],
    ["month 13", "2026-13-01T10:00:00Z"],
    ["month 0", "2026-00-10T10:00:00Z"],
    ["day 0", "2026-03-00T10:00:00Z"],
    ["hour 24", "2026-03-10T24:00:00Z"],
    ["minute 60", "2026-03-10T10:60:00Z"],
    ["second 60", "2026-03-10T10:00:60Z"],
    ["an offset of 24 hours", "2026-03-10T10:00:00+24:00"],
    ["an offset of 60 minutes", "2026-03-10T10:00:00+05:60"],
  ])("refuses %s rather than rolling it into the next month", (_name, raw) => {
    expect(detailsOf(okCreate({ actionAt: raw }))).toStrictEqual(["actionAt"]);
  });

  it("still accepts 29 February in a leap year, the last second of a day and an offset", () => {
    expect(okCreate({ actionAt: "2024-02-29T10:00:00Z" }).ok).toBe(true);
    expect(okCreate({ actionAt: "2026-03-10T23:59:59.999Z" }).ok).toBe(true);
    expect(okCreate({ actionAt: "2026-03-10T10:00+07:00" }).ok).toBe(true);
  });

  it("applies the same check to an edit", () => {
    expect(
      detailsOf(
        validateEditAction(
          { version: 1, actionAt: "2026-02-30T10:00:00Z" },
          NOW
        )
      )
    ).toStrictEqual(["actionAt"]);
  });
});

// JSON.parse makes `__proto__` an own key, as a request body does.
const bodyWith = (key: string, rest: Record<string, unknown>): unknown =>
  JSON.parse(
    `{${JSON.stringify(key)}: 1, ${Object.entries(rest)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ")}}`
  );

describe("UNIT-04 keys that exist on every object are not fields (review of PR 81)", () => {
  const INHERITED = ["__proto__", "constructor", "toString", "hasOwnProperty"];

  it.each(INHERITED)("%s is refused by name on create", (key) => {
    const result = validateCreateAction(
      bodyWith(key, { requestId: UUID, description: "x" }),
      NOW
    );

    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.details)).toStrictEqual([key]);
    expect(result.ok ? null : result.details[key]).toBe(
      "This field is not accepted here."
    );
  });

  it.each(INHERITED)(
    "%s is refused by name on edit, complete and cancel",
    (key) => {
      const edit = validateEditAction(bodyWith(key, { version: 1 }), NOW);
      const complete = validateComplete(bodyWith(key, { version: 1 }));
      const cancel = validateCancel(
        bodyWith(key, { version: 1, cancelReason: "x" })
      );

      for (const result of [edit, complete, cancel]) {
        expect(result.ok).toBe(false);
        expect(Object.keys(result.ok ? {} : result.details)).toContain(key);
        expect(result.ok ? null : result.details[key]).toBe(
          "This field is not accepted here."
        );
      }
    }
  );
});

const FACTS = (unmet: {
  done: boolean;
  followUp: boolean;
  planned: boolean;
}) => ({
  doneActions: unmet.done ? 0 : 2,
  openFollowUps: unmet.followUp ? 2 : 0,
  plannedActions: unmet.planned ? 1 : 0,
});

describe("UNIT-03 the resolution gate evaluator", () => {
  const KEYS = {
    done: "doneAction",
    followUp: "openFollowUp",
    planned: "plannedActions",
    summary: "resolutionSummary",
  } as const;

  const BOOLEANS = [false, true] as const;

  for (const done of BOOLEANS) {
    for (const followUp of BOOLEANS) {
      for (const planned of BOOLEANS) {
        for (const summary of BOOLEANS) {
          const expected: string[] = [];

          for (const [unmet, key] of [
            [done, KEYS.done],
            [followUp, KEYS.followUp],
            [planned, KEYS.planned],
            [summary, KEYS.summary],
          ] as const) {
            if (unmet) {
              expected.push(key);
            }
          }

          it(`unmet [${expected.join(", ") || "none"}] names exactly those`, () => {
            const details = evaluateResolutionGate(
              FACTS({ done, followUp, planned }),
              summary ? "" : "Replaced the access point."
            );

            expect(Object.keys(details).toSorted()).toStrictEqual(
              expected.toSorted()
            );
          });
        }
      }
    }
  }

  it("words each condition with its count", () => {
    const details = evaluateResolutionGate(
      { doneActions: 0, openFollowUps: 2, plannedActions: 1 },
      ""
    );

    expect(details).toStrictEqual({
      doneAction: "Record at least one completed action before resolving.",
      openFollowUp: "2 follow-ups are still open.",
      plannedActions:
        "Complete or cancel the 1 planned action before resolving.",
      resolutionSummary: "Enter a resolution summary.",
    });
    expect(
      evaluateResolutionGate(
        { doneActions: 1, openFollowUps: 1, plannedActions: 3 },
        "ok"
      )
    ).toStrictEqual({
      openFollowUp: "1 follow-up is still open.",
      plannedActions:
        "Complete or cancel the 3 planned actions before resolving.",
    });
  });

  it("counts the facts from the Actions: only a Done follower closes a follow-up, a cancelled one is void", () => {
    const facts = gateFactsOf([
      // Needs follow-up, followed up by a Done Action: closed.
      { id: 1, state: "DONE", followUpRequired: true, followsUpId: null },
      { id: 2, state: "DONE", followUpRequired: false, followsUpId: 1 },
      // Needs follow-up, only a Planned follower: still open (and a planned one).
      { id: 3, state: "DONE", followUpRequired: true, followsUpId: null },
      { id: 4, state: "PLANNED", followUpRequired: false, followsUpId: 3 },
      // Needs follow-up but cancelled: void.
      { id: 5, state: "CANCELLED", followUpRequired: true, followsUpId: null },
    ]);

    expect(facts).toStrictEqual({
      doneActions: 3,
      openFollowUps: 1,
      plannedActions: 1,
    });
    expect(gateFactsOf([])).toStrictEqual({
      doneActions: 0,
      openFollowUps: 0,
      plannedActions: 0,
    });
  });
});

/** No `resolutionSummary` field in the body (a literal `undefined` argument is formatted away). */
const NO_SUMMARY: unknown = undefined;

describe("UNIT-05 Resolution Summary validation", () => {
  it("keeps the trimmed value when resolving", () => {
    expect(
      validateResolutionSummary("RESOLVED", "  Fixed it.  ")
    ).toStrictEqual({ ok: true, value: "Fixed it." });
    expect(validateResolutionSummary("RESOLVED", repeat(2000))).toStrictEqual({
      ok: true,
      value: repeat(2000),
    });
  });

  it("passes an absent, empty or whitespace-only summary through for the gate to name", () => {
    for (const raw of [undefined, "", "   \n\t "]) {
      expect(validateResolutionSummary("RESOLVED", raw)).toStrictEqual({
        ok: true,
        value: "",
      });
    }
  });

  it("refuses more than 2000 characters after trimming, and a non-string", () => {
    for (const raw of [repeat(2001), `  ${repeat(2001)}  `, 5, null, {}, []]) {
      const result = validateResolutionSummary("RESOLVED", raw);

      expect(detailsOf(result)).toStrictEqual(["resolutionSummary"]);
    }
  });

  it("accepts 2000 characters that only fit once trimmed", () => {
    expect(validateResolutionSummary("RESOLVED", ` ${repeat(2000)} `).ok).toBe(
      true
    );
  });

  it("refuses a summary sent with any other target, and accepts none", () => {
    for (const target of ["OPEN", "IN_PROGRESS", "CLOSED", "REOPENED"]) {
      expect(
        detailsOf(validateResolutionSummary(target, "Fixed it.")),
        target
      ).toStrictEqual(["resolutionSummary"]);
      expect(
        validateResolutionSummary(target, NO_SUMMARY),
        target
      ).toStrictEqual({
        ok: true,
        value: undefined,
      });
    }
  });
});
