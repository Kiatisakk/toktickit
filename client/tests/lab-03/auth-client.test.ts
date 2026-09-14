import { afterEach, describe, expect, it, vi } from "vitest";

import { changePassword, logout } from "../../src/lib/auth";

/**
 * The authentication calls against real `Response` objects.
 *
 * Every other client suite stubs `fetch` with a hand-built object whose
 * `json()` returns a value whatever the status. That stub is why a real defect
 * shipped: both endpoints here answer 204 with no body, `response.json()` on an
 * empty body throws, and sign-out and password change reported failure after
 * the server had succeeded. These tests use the platform `Response`, which
 * behaves the way the browser's does.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const noContent = () =>
  vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

describe("204 responses", () => {
  it("sign-out resolves when the server answers 204 with no body", async () => {
    vi.stubGlobal("fetch", noContent());

    await expect(logout()).resolves.toBeUndefined();
  });

  it("password change resolves when the server answers 204 with no body", async () => {
    vi.stubGlobal("fetch", noContent());

    await expect(
      changePassword("Starting1!", "Replaced1!")
    ).resolves.toBeUndefined();
  });

  it("sends the session cookie with both calls", async () => {
    const fetchMock = noContent();

    vi.stubGlobal("fetch", fetchMock);

    await logout();
    await changePassword("Starting1!", "Replaced1!");

    // Without credentials the browser drops the cookie across origins, and the
    // server would answer as though nobody were signed in (api-spec.md §1).
    for (const call of fetchMock.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(call[1].credentials).toBe("include");
    }
  });
});
