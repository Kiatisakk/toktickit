import path from "node:path";

import type { Browser, Page, TestInfo } from "@playwright/test";

import {
  ACTIVE_REQUESTER,
  accountByEmail,
  SECOND_REQUESTER,
} from "../../server/prisma/accounts";

/**
 * The accounts the browser suites act as, and where each one's saved session
 * lives.
 *
 * The credentials are imported from the seed rather than written out again, so
 * the seed and the browser suites cannot drift apart silently — the same reason
 * the server suites import them.
 */
export const SIGNED_IN = {
  /** Requester A. Most of the journey is hers. */
  jennifer: ACTIVE_REQUESTER,
  /** Requester B, for Part 7's switch and Part 8's refused URL. */
  somchai: SECOND_REQUESTER,
  /** Seeded with no tickets, so the empty state is reachable. */
  pimchanok: accountByEmail("pimchanok.srisai@example.ac.th"),
} as const;

export type SignedInAs = keyof typeof SIGNED_IN;

/** Git-ignored: a saved session is a live credential for the test database. */
export const storageStateOf = (who: SignedInAs): string =>
  path.resolve(process.cwd(), ".playwright/auth", `${who}.json`);

/**
 * A second, independent browser session, signed in as someone else.
 *
 * Switching user inside one page would mean clicking Logout, which deletes the
 * session every other test reuses. A separate context is a separate cookie
 * jar — which is also the honest model of two people on two machines.
 *
 * The project's viewport and base URL are carried over; a context made from
 * `browser` directly inherits neither.
 */
export const pageAs = async (
  browser: Browser,
  info: TestInfo,
  who: SignedInAs
): Promise<Page> => {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport ?? null,
    storageState: storageStateOf(who),
  });

  return await context.newPage();
};
