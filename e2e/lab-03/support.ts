import { execFileSync } from "node:child_process";
import path from "node:path";

import type {
  APIRequestContext,
  Browser,
  Page,
  TestInfo,
} from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared helpers for the Lab 3 end-to-end suite.
 *
 * Lab 2's `e2e/lab-02/support.ts` already answers "where do screenshots go"
 * and "how do you read a real colour back out of the browser" for its own
 * screens, and `expectNoHorizontalScroll` / `expectNothingClipped` /
 * `computed` / `ZEN_GREEN` are reused directly from there (imported by the
 * files that need them) rather than copied — the checks are about the shell
 * and the palette, neither of which Lab 3 replaces. What lives here is what
 * Lab 3 adds: its own screenshot folder, ticket data that identifies itself as
 * this suite's, and a fresh, cookie-less browser context for the
 * authentication journey, which must never carry a saved session into a
 * screen that is supposed to be testing signing in.
 */

/** ui-spec.md §11 fixes this path and these five folder names. */
export const SHOTS = path.resolve(
  process.cwd(),
  "artifacts/lab-03/screenshots"
);

export type ScreenshotFolder =
  | "authentication"
  | "staff-queue"
  | "staff-ticket-detail"
  | "requester-ticket-detail"
  | "user-management";

/**
 * Writes a screenshot under a stable name: `<folder>/<viewport>-<state>.png`,
 * the same shape `e2e/lab-02/support.ts`'s `shoot` uses. A rerun overwrites
 * rather than accumulates, so the committed directory is always the latest
 * passing run (ui-spec.md §11).
 *
 * `animations: "disabled"` freezes every CSS animation and transition at its
 * end state before the pixels are captured. Without it, the busy button's
 * spinner (`tkt-spin`, components.css) is mid-rotation at whatever angle the
 * real clock happens to be at the moment the screenshot fires, which is a
 * different angle, and therefore different bytes, on every run — found by
 * running this suite twice and diffing the two sets of files, exactly as this
 * Issue asks.
 */
export const shoot = async (
  page: Page,
  info: TestInfo,
  folder: ScreenshotFolder,
  state: string
): Promise<void> => {
  await page.screenshot({
    animations: "disabled",
    path: path.join(SHOTS, folder, `${info.project.name}-${state}.png`),
    fullPage: true,
  });
};

/**
 * A brand-new browser context with no storage state at all — not signed in as
 * anyone, and not the viewport project's saved Requester A session either.
 *
 * The authentication journey has to prove what happens *before* a session
 * exists, and a journey that signs out has to do it on a session nobody else
 * is reusing (D-15, playwright.config.ts). Reusing the shared `page` fixture
 * for either would either start the login screen with a live cookie already
 * sitting in the browser, or — worse — delete the session row every other
 * spec's saved state depends on.
 */
export const freshPage = async (
  browser: Browser,
  info: TestInfo
): Promise<Page> => {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport ?? null,
  });

  return await context.newPage();
};

/**
 * The one instance of `text`, whichever of the table row or the card actually
 * renders on screen.
 *
 * The Users list and the Ticket list both render a table *and* a card list for
 * every row at once — one hidden with `display: none` per breakpoint rather
 * than unmounted (components.css) — so a name or an email that appears in
 * both exists twice in the DOM regardless of viewport. `getByText` matches raw
 * DOM nodes, hidden ones included, so asserting on it directly is a strict-mode
 * violation waiting to happen the moment the text is a list value rather than
 * a heading. `firstTicketLink` in `e2e/lab-02/support.ts` takes the same
 * `visible=true` route for the same reason.
 */
export const visibleText = (page: Page, text: string) =>
  page.getByText(text).locator("visible=true").first();

/**
 * Runs one of `server/prisma`'s reset-before-you-write scripts and waits for
 * it to finish, so the test that follows starts from the state the script
 * guarantees rather than from whatever an earlier project's run — or an
 * earlier invocation entirely — left behind.
 *
 * A child process, not a Prisma client imported into this file directly:
 * Playwright's own process never loads `server/.env.test`, and the script
 * already knows how to (`dotenv -e .env.test`, the same way `db:test:setup`
 * runs it). `shell: true` is what lets Windows resolve `npm` to `npm.cmd`.
 */
export const resetE2eData = (
  script: "e2e:reset-tickets" | "e2e:reset-users"
): void => {
  execFileSync("npm", ["run", script, "-w", "server"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
};

/** Every ticket this suite creates carries this prefix (`wipe-journey.ts`). */
const LAB3_PREFIX = "Lab3 E2E";

/**
 * A ticket summary unique to this suite, this run and this viewport project.
 *
 * The prefix is what `server/prisma/wipe-journey.ts` recognises and removes
 * before the next `npm run test:e2e`; the tag and the project name are what
 * keep three viewport projects, replaying the same spec against one
 * un-reset-between-projects database, from creating tickets that collide with
 * each other or with a previous project's leftovers.
 */
export const lab3Summary = (tag: string, info: TestInfo): string =>
  `${LAB3_PREFIX} ${tag} ${info.project.name} ${Date.now()}`;

export interface ReferenceIds {
  categoryId: number;
  relatedSystemId: number;
}

/**
 * The first Category and Related System id the API offers.
 *
 * Reference data, not a constant: Lab 1's seed order is stable but is not this
 * suite's to hard-code, the same reasoning `e2e/lab-02/evidence.spec.ts` gives
 * for reading these from the API rather than writing the ids out.
 */
export const referenceIds = async (
  request: APIRequestContext,
  api: string
): Promise<ReferenceIds> => {
  const categoryResponse = await request.get(`${api}/api/categories`);
  const categories = (await categoryResponse.json()) as { id: number }[];
  const systemResponse = await request.get(`${api}/api/related-systems`);
  const systems = (await systemResponse.json()) as { id: number }[];

  const categoryId = categories[0]?.id;
  const relatedSystemId = systems[0]?.id;

  if (categoryId === undefined || relatedSystemId === undefined) {
    throw new Error(
      "No Category or Related System reference data to build a ticket from."
    );
  }

  return { categoryId, relatedSystemId };
};

/**
 * Creates a ticket through the same endpoint the Create Ticket screen calls,
 * as whoever `request` is signed in as (BR-17 — the fixture is data, not a
 * shortcut past the API's own rules).
 */
export const createTicketFor = async (
  request: APIRequestContext,
  api: string,
  refs: ReferenceIds,
  summary: string,
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"
): Promise<{ id: number; ticketNumber: string }> => {
  const response = await request.post(`${api}/api/tickets`, {
    data: {
      summary,
      description:
        "Created by the Lab 3 end-to-end suite so a staff journey has a ticket to act on.",
      categoryId: refs.categoryId,
      relatedSystemId: refs.relatedSystemId,
      requestedPriority,
    },
  });

  expect(response.ok(), `POST /api/tickets failed: ${response.status()}`).toBe(
    true
  );

  const body = (await response.json()) as {
    id: number;
    ticketNumber: string;
  };

  return { id: body.id, ticketNumber: body.ticketNumber };
};

/**
 * Fails if any interactive control in the mobile band falls under the 44px
 * minimum ui-spec.md §10 sets for touch targets.
 *
 * Scoped to buttons and links inside `<main>`: the skip-link and other
 * screen-reader-only affordances are deliberately smaller than a touch target
 * because nothing ever touches them, and counting them here would fail the
 * one part of the page doing accessibility correctly (mirrors the reasoning
 * in `e2e/lab-02/support.ts`'s `expectNothingClipped`).
 */
export const expectTouchTargetsMeetMinimum = async (
  page: Page
): Promise<void> => {
  const MINIMUM = 44;

  const offenders = await page.evaluate((minimum) => {
    const found: string[] = [];

    for (const node of globalThis.document.querySelectorAll<HTMLElement>(
      "main button, main a, main input, main select"
    )) {
      if (node.closest(".tkt-visually-hidden")) {
        continue;
      }

      const style = globalThis.getComputedStyle(node);

      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }

      const box = node.getBoundingClientRect();

      if (box.width === 0 && box.height === 0) {
        continue;
      }

      if (box.height < minimum - 1) {
        found.push(
          `${node.tagName.toLowerCase()}.${node.className || "(no class)"} → ${Math.round(box.height)}px tall`
        );
      }
    }

    return found;
  }, MINIMUM);

  expect(
    offenders,
    `interactive targets under ${MINIMUM}px in the mobile band:\n${offenders.join("\n")}`
  ).toEqual([]);
};
