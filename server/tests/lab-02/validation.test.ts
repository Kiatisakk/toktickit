import { describe, expect, it } from "vitest";

import { LIMITS, validateTicketInput } from "../../src/tickets/validation.js";

/**
 * UNIT-03 — the trim-then-measure rule and the documented length limits.
 *
 * No HTTP and no database. These are the rules themselves; whether the endpoint
 * applies them is API-05's question, one layer up.
 */

const valid = {
  categoryId: 2,
  relatedSystemId: 7,
  summary: "Laptop battery drains quickly",
  description: "The battery drains much faster than usual even when idle.",
  requestedPriority: "MEDIUM",
};

const pad = (length: number) => "x".repeat(length);

const failureFor = (overrides: Record<string, unknown>) => {
  const result = validateTicketInput({ ...valid, ...overrides });

  if (result.ok) {
    throw new Error("expected validation to fail");
  }

  return result.details;
};

describe("a valid body", () => {
  it("passes", () => {
    expect(validateTicketInput(valid).ok).toBe(true);
  });

  it("returns the trimmed text rather than what was sent", () => {
    const result = validateTicketInput({
      ...valid,
      summary: "   Printer is offline   ",
    });

    if (!result.ok) {
      throw new Error("expected validation to pass");
    }

    expect(result.value.summary).toBe("Printer is offline");
  });
});

describe("required fields", () => {
  it.each(["summary", "description"])("rejects a missing %s", (field) => {
    expect(failureFor({ [field]: undefined })).toHaveProperty(field);
  });

  // BR-13 and BR-14 say trimmed. A summary of five spaces is not a
  // five-character summary, and without the trim it would pass the length rule.
  it.each(["summary", "description"])(
    "rejects a whitespace-only %s",
    (field) => {
      expect(failureFor({ [field]: "        " })).toHaveProperty(field);
    }
  );

  it.each(["categoryId", "relatedSystemId"])(
    "rejects a missing %s",
    (field) => {
      expect(failureFor({ [field]: undefined })).toHaveProperty(field);
    }
  );

  it("rejects a category id that is not a positive integer", () => {
    expect(failureFor({ categoryId: 0 })).toHaveProperty("categoryId");
    expect(failureFor({ categoryId: -1 })).toHaveProperty("categoryId");
    expect(failureFor({ categoryId: 1.5 })).toHaveProperty("categoryId");
    expect(failureFor({ categoryId: "2" })).toHaveProperty("categoryId");
  });
});

describe("length limits", () => {
  it("accepts a summary at both boundaries", () => {
    expect(
      validateTicketInput({ ...valid, summary: pad(LIMITS.summary.min) }).ok
    ).toBe(true);
    expect(
      validateTicketInput({ ...valid, summary: pad(LIMITS.summary.max) }).ok
    ).toBe(true);
  });

  it("rejects a summary one character outside either boundary", () => {
    expect(failureFor({ summary: pad(LIMITS.summary.min - 1) })).toHaveProperty(
      "summary"
    );
    expect(failureFor({ summary: pad(LIMITS.summary.max + 1) })).toHaveProperty(
      "summary"
    );
  });

  it("accepts a description at both boundaries", () => {
    expect(
      validateTicketInput({
        ...valid,
        description: pad(LIMITS.description.min),
      }).ok
    ).toBe(true);
    expect(
      validateTicketInput({
        ...valid,
        description: pad(LIMITS.description.max),
      }).ok
    ).toBe(true);
  });

  it("rejects a description one character outside either boundary", () => {
    expect(
      failureFor({ description: pad(LIMITS.description.min - 1) })
    ).toHaveProperty("description");
    expect(
      failureFor({ description: pad(LIMITS.description.max + 1) })
    ).toHaveProperty("description");
  });

  // The surrounding whitespace must not count toward the limit either way.
  it("measures the trimmed length, not the sent length", () => {
    const padded = `   ${pad(LIMITS.summary.max)}   `;

    expect(validateTicketInput({ ...valid, summary: padded }).ok).toBe(true);
  });
});

describe("requested priority", () => {
  it.each(["LOW", "MEDIUM", "HIGH"])("accepts %s", (priority) => {
    expect(
      validateTicketInput({ ...valid, requestedPriority: priority }).ok
    ).toBe(true);
  });

  it.each(["URGENT", "low", "", null, 2])("rejects %j", (priority) => {
    expect(failureFor({ requestedPriority: priority })).toHaveProperty(
      "requestedPriority"
    );
  });
});

describe("reporting", () => {
  it("names every offending field at once, so a form can mark them all", () => {
    const details = failureFor({ summary: "", description: "", categoryId: 0 });

    expect(Object.keys(details).toSorted()).toEqual([
      "categoryId",
      "description",
      "summary",
    ]);
  });

  it("gives one message per field, since a control can only show one", () => {
    const details = failureFor({ summary: "abc" });

    expect(typeof details["summary"]).toBe("string");
  });

  // BR-11. Ownership comes from the request context; this function never even
  // looks at what the body claims.
  it("ignores a requesterId in the body", () => {
    const result = validateTicketInput({ ...valid, requesterId: 999 });

    if (!result.ok) {
      throw new Error("expected validation to pass");
    }

    expect(result.value).not.toHaveProperty("requesterId");
  });
});

describe("a body that is not an object", () => {
  it.each([null, undefined, "text", 42, []])("rejects %j", (body) => {
    expect(validateTicketInput(body).ok).toBe(false);
  });
});
