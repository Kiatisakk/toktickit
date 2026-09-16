import { describe, expect, it } from "vitest";

import { MESSAGE_LIMIT, validateMessageBody } from "../../src/tickets/messages.js";

/**
 * UNIT-06 — the body of a Public Comment or an Internal Note (BR-30, AC-26).
 *
 * One rule for both, so that a note cannot be held to a looser standard than
 * the comment beside it.
 */
describe("UNIT-06 message body validation", () => {
  it("refuses a body that is missing, not text, empty or only whitespace", () => {
    for (const raw of [undefined, null, 42, {}, "", "   ", "\n\t "]) {
      const result = validateMessageBody({ body: raw });

      expect(result.ok, JSON.stringify(raw)).toBe(false);
      expect(result.ok ? null : result.details).toEqual({
        body: "Write something before posting.",
      });
    }
  });

  it("refuses a request that is not an object at all", () => {
    expect(validateMessageBody(null).ok).toBe(false);
    expect(validateMessageBody("hello").ok).toBe(false);
  });

  it("accepts one character and exactly 5000, trimmed", () => {
    expect(validateMessageBody({ body: "  x  " })).toEqual({
      ok: true,
      body: "x",
    });

    const longest = "a".repeat(MESSAGE_LIMIT);

    expect(validateMessageBody({ body: ` ${longest}\n` })).toEqual({
      ok: true,
      body: longest,
    });
  });

  it("refuses 5001 characters after trimming", () => {
    const result = validateMessageBody({ body: "a".repeat(MESSAGE_LIMIT + 1) });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.details).toEqual({
      body: "Keep it to 5000 characters or fewer.",
    });
  });

  it("keeps markup as the characters it is", () => {
    // BR-31 is honoured by rendering, not by rewriting what was written.
    expect(validateMessageBody({ body: "<b>still down</b>" })).toEqual({
      ok: true,
      body: "<b>still down</b>",
    });
  });

  it("reads nothing but the body", () => {
    expect(
      validateMessageBody({ body: "hi", authorId: 1, createdAt: "2001-01-01" })
    ).toEqual({ ok: true, body: "hi" });
  });

  it("uses 5000 as the limit", () => {
    expect(MESSAGE_LIMIT).toBe(5000);
  });
});
