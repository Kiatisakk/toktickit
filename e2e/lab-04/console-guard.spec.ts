import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createGuard } from "./support";

/**
 * The console guard is what proves AC-47 ("no console error on any Lab 4
 * journey"), so it is tested here against a page that does not need the
 * application: a stubbed origin whose script asks for URLs the spec answers
 * with a chosen status, or aborts.
 *
 * Review of PR #85 found the guard tolerated every 4xx and every
 * `net::ERR_FAILED`, so an unexpected 401, 422, 429 or a lost fetch passed.
 * These tests fail on that guard and pass on one that tolerates only what a
 * test declared.
 */

const ORIGIN = "http://guard.test";

const open = async (page: Page): Promise<void> => {
  await page.route(`${ORIGIN}/`, async (route) => {
    await route.fulfill({ contentType: "text/html", body: "<p>blank</p>" });
  });
  await page.goto(`${ORIGIN}/`);
};

const answer = async (
  page: Page,
  path: string,
  status: number
): Promise<void> => {
  await page.route(`${ORIGIN}${path}`, async (route) => {
    await route.fulfill({ status, json: { error: "stub" } });
  });
};

const ask = async (page: Page, path: string, method = "GET"): Promise<void> => {
  await page.evaluate(
    async ([target, verb]) => {
      try {
        await globalThis.fetch(target ?? "", { method: verb });
      } catch {
        // an aborted request rejects; the browser has already logged it
      }
    },
    [`${ORIGIN}${path}`, method]
  );
  // Let the console line and the network event of the request both land.
  await page.waitForTimeout(100);
};

test.describe("Console guard (AC-47)", () => {
  for (const status of [401, 403, 404, 409, 422, 429]) {
    test(`an undeclared ${status} is reported, with its console line`, async ({
      page,
    }) => {
      const guard = createGuard();

      guard.attach(page);
      await open(page);
      await answer(page, "/api/thing", status);
      await ask(page, "/api/thing");

      const found = guard.problems();

      expect(found.some((line) => line.includes(`HTTP ${status}`))).toBe(true);
      expect(
        found.some((line) => line.startsWith("console.error: Failed to load"))
      ).toBe(true);
    });
  }

  test("an undeclared aborted fetch is reported", async ({ page }) => {
    const guard = createGuard();

    guard.attach(page);
    await open(page);
    await page.route(`${ORIGIN}/api/lost`, async (route) => {
      await route.abort("failed");
    });
    await ask(page, "/api/lost");

    const found = guard.problems();

    expect(found.some((line) => line.startsWith("request failed:"))).toBe(true);
    expect(
      found.some((line) => line.startsWith("console.error: Failed to load"))
    ).toBe(true);
  });

  test("a declared refusal is tolerated, with the console line it causes", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    guard.expectRefusal("GET", /\/api\/thing$/u, 409);
    await open(page);
    await answer(page, "/api/thing", 409);
    await ask(page, "/api/thing");

    expect(guard.problems()).toEqual([]);
  });

  test("a declaration covers only its own method, url and status", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    guard.expectRefusal("GET", /\/api\/thing$/u, 409);
    await open(page);
    await answer(page, "/api/thing", 409);
    await answer(page, "/api/other", 409);
    await ask(page, "/api/thing");
    await ask(page, "/api/other");
    await ask(page, "/api/thing", "POST");

    const found = guard.problems();

    expect(found.filter((line) => line.startsWith("undeclared"))).toEqual([
      `undeclared HTTP 409 from GET ${ORIGIN}/api/other`,
      `undeclared HTTP 409 from POST ${ORIGIN}/api/thing`,
    ]);
  });

  test("a declared status does not excuse a different one from the same url", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    guard.expectRefusal("GET", /\/api\/thing$/u, 409);
    await open(page);
    await answer(page, "/api/thing", 422);
    await ask(page, "/api/thing");

    const found = guard.problems();

    expect(found.some((line) => line.includes("undeclared HTTP 422"))).toBe(
      true
    );
    expect(found.some((line) => line.includes("never happened"))).toBe(true);
  });

  test("a declared abort is tolerated, an undeclared one beside it is not", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    guard.expectAbort(/\/api\/lost$/u);
    await open(page);
    await page.route(`${ORIGIN}/api/lost`, async (route) => {
      await route.abort("failed");
    });
    await page.route(`${ORIGIN}/api/also-lost`, async (route) => {
      await route.abort("failed");
    });
    await ask(page, "/api/lost");

    expect(guard.problems()).toEqual([]);

    await ask(page, "/api/also-lost");

    expect(guard.problems()).toEqual(
      expect.arrayContaining([
        `request failed: ${ORIGIN}/api/also-lost (net::ERR_FAILED)`,
      ])
    );
  });

  test("a declaration that never happens is itself a problem", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    guard.expectRefusal("POST", /\/api\/gate$/u, 409);
    guard.expectAbort(/\/api\/lost$/u);
    await open(page);

    expect(guard.problems()).toEqual([
      `declared 409 from POST ${/\/api\/gate$/u} never happened`,
      `declared abort of ${/\/api\/lost$/u} never happened`,
    ]);
  });

  test("an application console.error and an uncaught exception are reported", async ({
    page,
  }) => {
    const guard = createGuard();

    guard.attach(page);
    await open(page);
    await page.evaluate(() => {
      globalThis.console.error("boom");
      globalThis.setTimeout(() => {
        throw new Error("late");
      }, 0);
    });
    await page.waitForTimeout(100);

    const found = guard.problems();

    expect(found.some((line) => line.startsWith("console.error: boom"))).toBe(
      true
    );
    expect(found).toContain("uncaught exception: late");
  });
});
