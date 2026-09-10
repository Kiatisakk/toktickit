import { describe, expect, it } from "vitest";

import {
  firstUnsatisfiedRule,
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "../../src/auth/password.js";

/**
 * UNIT-03 (AC-10, BR-07) and UNIT-04 (BR-06).
 *
 * The expected values here are literals, not expressions recomputed the way the
 * implementation computes them: a test asserting `password.length >= MIN` would
 * pass against any bound at all.
 */

/** Satisfies every rule, and is used as the baseline the failures deviate from. */
const VALID = "Correct1!";

describe("UNIT-03 password rules", () => {
  it("accepts a password satisfying every rule", () => {
    expect(firstUnsatisfiedRule(VALID)).toBeNull();
  });

  it("accepts both boundary lengths", () => {
    // Seven characters plus one padding character, and the same padded out to
    // the maximum. Both keep one of each required class.
    const shortest = "Aa1!aaaa";
    const longest = `Aa1!${"a".repeat(PASSWORD_MAX_LENGTH - 4)}`;

    expect(shortest).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(longest).toHaveLength(PASSWORD_MAX_LENGTH);
    expect(firstUnsatisfiedRule(shortest)).toBeNull();
    expect(firstUnsatisfiedRule(longest)).toBeNull();
  });

  it("refuses a password one character below the minimum", () => {
    expect(firstUnsatisfiedRule("Aa1!aaa")).toMatchObject({ id: "length" });
  });

  it("refuses a password one character above the maximum", () => {
    // BR-07's upper bound is a denial-of-service guard: scrypt on unbounded
    // input is work an unauthenticated caller can ask for.
    const tooLong = `Aa1!${"a".repeat(PASSWORD_MAX_LENGTH - 3)}`;

    expect(tooLong).toHaveLength(PASSWORD_MAX_LENGTH + 1);
    expect(firstUnsatisfiedRule(tooLong)).toMatchObject({ id: "length" });
  });

  it.each([
    { id: "uppercase", password: "correct1!" },
    { id: "lowercase", password: "CORRECT1!" },
    { id: "digit", password: "Correctt!" },
    { id: "special", password: "Correct11" },
  ])("names the $id rule when only that class is missing", ({
    id,
    password,
  }) => {
    const failure = firstUnsatisfiedRule(password);

    expect(failure?.id).toBe(id);
    expect(failure?.message).not.toContain(password);
  });

  it("names a rule rather than echoing the password", () => {
    const secret = "hunter2hunter2";
    const failure = firstUnsatisfiedRule(secret);

    expect(failure).not.toBeNull();
    expect(failure?.message).not.toContain(secret);
  });
});

describe("UNIT-04 hash and verify", () => {
  it("verifies a password against its own hash", async () => {
    const stored = await hashPassword(VALID);

    await expect(verifyPassword(VALID, stored)).resolves.toBe(true);
  });

  it("refuses a different password against that hash", async () => {
    const stored = await hashPassword(VALID);

    await expect(verifyPassword("Correct2!", stored)).resolves.toBe(false);
  });

  it("stores neither the password nor anything containing it", async () => {
    const stored = await hashPassword(VALID);

    expect(stored).not.toContain(VALID);
    expect(stored.startsWith("scrypt$")).toBe(true);
  });

  it("produces a different hash each time, so equal passwords are not equal rows", async () => {
    // A per-password salt. Without it, two accounts sharing a password would be
    // visibly identical in the table.
    const [first, second] = await Promise.all([
      hashPassword(VALID),
      hashPassword(VALID),
    ]);

    expect(first).not.toBe(second);
    await expect(verifyPassword(VALID, second)).resolves.toBe(true);
  });

  it.each([
    { what: "an empty string", stored: "" },
    { what: "a plaintext password", stored: VALID },
    { what: "a hash with a field missing", stored: "scrypt$16384$8$1$c2FsdA" },
    { what: "an unknown encoding", stored: "bcrypt$16384$8$1$c2FsdA$aGFzaA" },
  ])("refuses rather than throwing for $what", async ({ stored }) => {
    // A malformed row is a corrupt record. The only correct answer at the
    // sign-in path is to refuse, and throwing would answer 500 instead of 401.
    await expect(verifyPassword(VALID, stored)).resolves.toBe(false);
  });
});
