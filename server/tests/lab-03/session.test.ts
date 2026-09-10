import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  hashSessionToken,
  newSessionToken,
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
} from "../../src/auth/session.js";

/**
 * UNIT-05 (BR-10). Token generation and hashing only — the table behaviour is
 * exercised through the real endpoints in auth.api.test.ts (D-15).
 */

describe("UNIT-05 session tokens", () => {
  it("draws a distinct token every time", () => {
    const DRAWS = 1000;
    const tokens = new Set(
      Array.from({ length: DRAWS }, () => newSessionToken())
    );

    expect(tokens.size).toBe(DRAWS);
  });

  it("draws tokens that are URL-safe and long enough to be unguessable", () => {
    const token = newSessionToken();

    // 32 random bytes in base64url. Anything shorter would be a guessable
    // credential; anything needing escaping would not survive a cookie value.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it("stores a hash, not the token", () => {
    const token = newSessionToken();
    const stored = hashSessionToken(token);

    expect(stored).not.toBe(token);
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("hashes with SHA-256, verified against an independent computation", () => {
    // The expected value comes from node:crypto directly rather than from the
    // module under test, so the assertion can disagree with the implementation.
    const token = newSessionToken();

    expect(hashSessionToken(token)).toBe(
      createHash("sha256").update(token).digest("hex")
    );
  });

  it("maps a token to the same hash every time, so lookup is possible", () => {
    const token = newSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("fixes the session lifetime at eight hours", () => {
    // A-02 records this as a decision rather than an edit, so it is asserted
    // rather than left to whatever the constant happens to say.
    expect(SESSION_LIFETIME_MS).toBe(28_800_000);
  });

  it("names the cookie the API specification names", () => {
    expect(SESSION_COOKIE).toBe("toktickit.session");
  });
});
