import { describe, expect, it } from "vitest";

import { ownTicketsOf, readableTicketsOf } from "../../src/auth/scope.js";

/**
 * UNIT-01 — the role-to-query-scope mapping (D-08, BR-19).
 *
 * Pure: no database. The API suites prove the fragment is applied; this proves
 * the fragment is the right one for each role.
 */

const USER_ID = 42;

describe("readableTicketsOf", () => {
  it("UNIT-01 constrains a Requester to the tickets they raised", () => {
    expect(readableTicketsOf({ id: USER_ID, role: "REQUESTER" })).toStrictEqual(
      { requesterId: USER_ID }
    );
  });

  it.each(["IT_STAFF", "ADMIN"] as const)(
    "UNIT-01 applies no constraint for %s",
    (role) => {
      expect(readableTicketsOf({ id: USER_ID, role })).toStrictEqual({});
    }
  );
});

describe("ownTicketsOf", () => {
  // Upload, removal and My Tickets are "mine" whatever the role (api-spec.md §6).
  it("constrains every role to the tickets they raised", () => {
    expect(ownTicketsOf({ id: USER_ID })).toStrictEqual({
      requesterId: USER_ID,
    });
  });
});
