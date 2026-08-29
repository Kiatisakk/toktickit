import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchTickets } from "../../src/lib/api";

/**
 * UI-14 — the response is untrusted input.
 *
 * Raised in review of PR #27: the row guard checked nine of eleven fields and
 * then every row was cast to a caller-chosen type. `itPriority` and
 * `ticketOwner` were the two it skipped, and both are rendered — so a payload
 * with a number where a name belongs reached the component wearing a type it
 * did not have, and failed there instead of here.
 *
 * These tests exist to make that class of hole expensive to reopen: a field
 * added to the row without being added to the guard now has a failing test
 * waiting for it.
 */

const ROW = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Laptop battery drains quickly",
  requestedPriority: "MEDIUM",
  itPriority: null,
  currentStatus: "NEW",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-02T09:00:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  ticketOwner: null,
};

const META = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 };

const respondWith = (body: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response)
    )
  );
};

const list = () => fetchTickets(new URLSearchParams(), 1);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a well-formed page", () => {
  it("is returned as it stands", async () => {
    respondWith({ data: [ROW], meta: META });

    const result = await list();

    expect(result.data[0]?.ticketNumber).toBe("TKT-2026-000001");
    expect(result.meta.totalItems).toBe(1);
  });

  it("accepts a triaged row, where the two nullable fields are set", async () => {
    respondWith({
      data: [
        { ...ROW, itPriority: "HIGH", ticketOwner: { id: 9, name: "M Brown" } },
      ],
      meta: META,
    });

    const result = await list();

    expect(result.data[0]?.ticketOwner?.name).toBe("M Brown");
  });
});

describe("a malformed page is refused here, not downstream", () => {
  it.each([
    ["itPriority as a number", { itPriority: 3 }],
    ["ticketOwner as a string", { ticketOwner: "Michael Brown" }],
    ["ticketOwner without a name", { ticketOwner: { id: 9 } }],
    ["category as null", { category: null }],
    ["id as a string", { id: "1" }],
    ["a missing timestamp", { updatedAt: undefined }],
  ])("rejects %s", async (_label, override) => {
    respondWith({ data: [{ ...ROW, ...override }], meta: META });

    await expect(list()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a page whose metadata is missing", async () => {
    respondWith({ data: [ROW] });

    await expect(list()).rejects.toBeInstanceOf(ApiError);
  });

  // One bad row is a bad page. Rendering the rest would show a list that is
  // quietly short and give no reason to doubt it.
  it("rejects the whole page when a single row is wrong", async () => {
    respondWith({ data: [ROW, { ...ROW, id: null }], meta: META });

    await expect(list()).rejects.toBeInstanceOf(ApiError);
  });

  it("says the format was unexpected rather than failing anonymously", async () => {
    respondWith({ data: [{ ...ROW, itPriority: 3 }], meta: META });

    await expect(list()).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
    });
  });
});
