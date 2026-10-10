/* oxlint-disable no-await-in-loop -- browser steps are ordered by definition: each waits on the screen the one before it produced. */
import { execFileSync } from "node:child_process";
import path from "node:path";

import type {
  APIRequestContext,
  Browser,
  Locator,
  Page,
  TestInfo,
} from "@playwright/test";
import { expect, test as base } from "@playwright/test";

import { pageAs } from "../lab-03/sessions";
import type { SignedInAs } from "../lab-03/sessions";

/**
 * Shared helpers for the Lab 4 end-to-end suite.
 *
 * Lab 2 and Lab 3 already answer "how do I read a colour back out of a browser",
 * "is the page scrolling sideways", "is anything clipped", "which signed-in
 * session do I borrow" and "how do I make a ticket". Those are imported by the
 * specs from `e2e/lab-02/support.ts`, `e2e/lab-03/support.ts` and
 * `e2e/lab-03/sessions.ts`, not copied. What lives here is only what Lab 4
 * adds: its own screenshot folders, the console-error guard AC-47 asks for,
 * fixtures for the dashboards, and a few layout checks the new screens need.
 */

/** ui-spec.md section 11 fixes this path and these three folder names. */
export const SHOTS = path.resolve(
  process.cwd(),
  "artifacts/lab-04/screenshots"
);

export type ScreenshotFolder =
  | "staff-dashboard"
  | "requester-dashboard"
  | "actions-taken";

/**
 * Writes `<folder>/<viewport>-<state>.png`, the shape Lab 3's `shoot` uses.
 *
 * `animations: "disabled"` freezes spinners and transitions at their end state,
 * so a rerun differs only where the data differs (Lab 3 found this by diffing
 * two runs).
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

/* ---------------------------------------------------------- console guard -- */

/**
 * Everything the browser tells us went wrong, kept raw so the verdict can be
 * reached at the end, when every declared expectation is known and the console
 * message and the network event of one request can be matched to each other
 * whichever arrived first.
 */
interface SeenResponse {
  method: string;
  url: string;
  status: number;
}

interface SeenFailure {
  url: string;
  reason: string;
}

interface SeenConsoleError {
  text: string;
  url: string;
}

interface Expectation {
  kind: "refusal" | "abort";
  method: string;
  url: RegExp;
  status: number;
  seen: number;
  /** A standing allowance, not a declaration: never seen is not a problem. */
  optional?: boolean;
}

/** Chromium narrates a 4xx/5xx answer to a fetch like this. */
const STATUS_LINE =
  /^Failed to load resource: the server responded with a status of (?<status>\d+)/u;

/** ... and a request that was cut off, such as one a spec aborts, like this. */
const FAILED_LINE = /^Failed to load resource: net::ERR_FAILED/u;

const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_FLOOR = 500;

/**
 * A pattern for a request URL that ends in `suffix`. The paths used are literal
 * (`/api/tickets/12/actions`): slashes, letters and digits, nothing to escape.
 */
export const urlEnding = (suffix: string): RegExp =>
  new RegExp(`${suffix}$`, "u");

export interface ConsoleGuard {
  /** Start watching a page; every page a test opens must be attached. */
  attach: (page: Page) => void;
  /**
   * Declares that this test provokes `status` from `method` `url` on purpose (a
   * designed refusal, or a route stub answering with one). Only a response
   * that matches is tolerated, together with the browser's own console line
   * about it. A declaration that is never observed is itself a problem.
   */
  expectRefusal: (method: string, url: RegExp, status: number) => void;
  /** Declares a request this test aborts on purpose (`route.abort`). */
  expectAbort: (url: RegExp) => void;
  /** What went wrong so far, one line each. */
  problems: () => string[];
}

export const createGuard = (): ConsoleGuard => {
  const responses: SeenResponse[] = [];
  const failures: SeenFailure[] = [];
  const consoleErrors: SeenConsoleError[] = [];
  const pageErrors: string[] = [];
  const expectations: Expectation[] = [
    // The browser itself, not the application, asks for /favicon.ico on every
    // page it opens, and the app ships no icon. It is the one refusal that
    // belongs to no test, so it is allowed everywhere and exactly as written.
    {
      kind: "refusal",
      method: "GET",
      url: /^http:\/\/localhost:\d+\/favicon\.ico$/u,
      status: 404,
      seen: 0,
      optional: true,
    },
  ];

  const attach = (page: Page): void => {
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push({
          text: message.text(),
          url: message.location().url,
        });
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(`uncaught exception: ${error.message}`);
    });

    page.on("response", (response) => {
      responses.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
      });
    });

    page.on("requestfailed", (request) => {
      failures.push({
        url: request.url(),
        reason: request.failure()?.errorText ?? "",
      });
    });
  };

  const refusalFor = (status: number, url: string, method?: string) =>
    expectations.find(
      (item) =>
        item.kind === "refusal" &&
        item.status === status &&
        item.url.test(url) &&
        (method === undefined || item.method === method)
    );

  const abortFor = (url: string) =>
    expectations.find((item) => item.kind === "abort" && item.url.test(url));

  const consoleProblem = ({ text, url }: SeenConsoleError): string | null => {
    const status = STATUS_LINE.exec(text)?.groups?.status;

    if (status !== undefined && refusalFor(Number(status), url)) {
      return null;
    }

    if (FAILED_LINE.test(text) && abortFor(url)) {
      return null;
    }

    return `console.error: ${text} (${url})`;
  };

  const problems = (): string[] => {
    const found: string[] = [...pageErrors];

    // Observation is counted first, so a declaration is "seen" whichever
    // order the events arrived in.
    for (const item of expectations) {
      item.seen = 0;
    }

    for (const { method, url, status } of responses) {
      if (status >= SERVER_ERROR_FLOOR) {
        found.push(`HTTP ${status} from ${url}`);
      } else if (status >= CLIENT_ERROR_FLOOR) {
        const declared = refusalFor(status, url, method);

        if (declared) {
          declared.seen += 1;
        } else {
          found.push(`undeclared HTTP ${status} from ${method} ${url}`);
        }
      }
    }

    for (const { url, reason } of failures) {
      // A navigation that cancels what the page had in flight ends this way;
      // it is the browser's doing, not a request that failed.
      if (reason.includes("ERR_ABORTED")) {
        continue;
      }

      const declared = reason.includes("ERR_FAILED") ? abortFor(url) : null;

      if (declared) {
        declared.seen += 1;
      } else {
        found.push(`request failed: ${url} (${reason})`);
      }
    }

    for (const entry of consoleErrors) {
      const problem = consoleProblem(entry);

      if (problem) {
        found.push(problem);
      }
    }

    for (const item of expectations) {
      if (item.seen === 0 && !item.optional) {
        found.push(
          item.kind === "abort"
            ? `declared abort of ${item.url} never happened`
            : `declared ${item.status} from ${item.method} ${item.url} never happened`
        );
      }
    }

    return found;
  };

  return {
    attach,
    expectRefusal: (method, url, status) => {
      expectations.push({
        kind: "refusal",
        method: method.toUpperCase(),
        url,
        status,
        seen: 0,
      });
    },
    expectAbort: (url) => {
      expectations.push({
        kind: "abort",
        method: "GET",
        url,
        status: 0,
        seen: 0,
      });
    },
    problems,
  };
};

/**
 * `test` with a console guard attached to the default page and checked after
 * every test (AC-47). A spec opens other people's pages through `openAs`, which
 * attaches the same guard.
 */
export const test = base.extend<{ guard: ConsoleGuard }>({
  guard: [
    async ({ page }, use, info) => {
      const guard = createGuard();

      guard.attach(page);
      await use(guard);

      expect(
        guard.problems(),
        `${info.title}: the browser reported errors`
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

/** A second browser session for someone else, watched by the same guard. */
export const openAs = async (
  guard: ConsoleGuard,
  browser: Browser,
  info: TestInfo,
  who: SignedInAs
): Promise<Page> => {
  const page = await pageAs(browser, info, who);

  guard.attach(page);

  return page;
};

/* ------------------------------------------------------------- the data -- */

export const API = "http://localhost:3000";

/** Every ticket this suite creates carries this prefix (`wipe-journey.ts`). */
const LAB4_PREFIX = "Lab4 E2E";

export const lab4Summary = (tag: string, info: TestInfo): string =>
  `${LAB4_PREFIX} ${tag} ${info.project.name} ${Date.now()}`;

const runScript = (script: string): void => {
  execFileSync("npm", ["run", script, "-w", "server"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
};

/** Removes every ticket, so the dashboards can show their zero states. */
export const emptyTheTestDatabase = (): void => {
  runScript("e2e:reset-tickets");
};

/**
 * Removes every ticket, then writes the Lab 4 demonstration set into the TEST
 * database (`server/prisma/dashboardDemo.ts`), so the dashboard figures a spec
 * asserts are known exactly rather than read back from the thing under test.
 */
export const seedTheDashboardFixture = (): void => {
  runScript("e2e:reset-tickets");
  runScript("e2e:seed-dashboard");
};

export interface StaffMember {
  id: number;
  name: string;
}

/** The id of an active staff member, by name, from the owners list. */
export const staffIdByName = async (
  request: APIRequestContext,
  name: string
): Promise<number> => {
  const response = await request.get(`${API}/api/staff/owners`);
  const owners = (await response.json()) as StaffMember[];
  const found = owners.find((owner) => owner.name === name);

  if (!found) {
    throw new Error(`No active staff member called ${name}.`);
  }

  return found.id;
};

interface ActionFixture {
  description: string;
  performedById?: number;
  result?: string;
  followUpNote?: string;
  followsUpId?: number;
}

export interface StoredAction {
  id: number;
  version: number;
}

/**
 * Creates an Action through the same endpoint the form calls, as whoever
 * `request` is signed in as (BR-17: a fixture is data, not a shortcut past the
 * API's own rules).
 */
export const createActionFor = async (
  request: APIRequestContext,
  ticketId: number,
  fixture: ActionFixture
): Promise<StoredAction> => {
  const response = await request.post(
    `${API}/api/tickets/${ticketId}/actions`,
    {
      data: {
        requestId: crypto.randomUUID(),
        description: fixture.description,
        ...(fixture.performedById === undefined
          ? {}
          : { performedById: fixture.performedById }),
        ...(fixture.result === undefined ? {} : { result: fixture.result }),
        ...(fixture.followUpNote === undefined
          ? {}
          : { followUpRequired: true, followUpNote: fixture.followUpNote }),
        ...(fixture.followsUpId === undefined
          ? {}
          : { followsUpId: fixture.followsUpId }),
      },
    }
  );

  expect(
    response.ok(),
    `POST /api/tickets/${ticketId}/actions failed: ${response.status()}`
  ).toBe(true);

  return (await response.json()) as StoredAction;
};

export const completeActionFor = async (
  request: APIRequestContext,
  action: StoredAction,
  result: string
): Promise<void> => {
  const response = await request.post(
    `${API}/api/actions/${action.id}/complete`,
    { data: { version: action.version, result } }
  );

  expect(
    response.ok(),
    `POST /api/actions/${action.id}/complete failed: ${response.status()}`
  ).toBe(true);
};

/** A ticket's id from its number, for the demonstration set. */
export const ticketIdByNumber = async (
  request: APIRequestContext,
  ticketNumber: string
): Promise<number> => {
  const response = await request.get(
    `${API}/api/staff/tickets?search=${encodeURIComponent(ticketNumber)}`
  );
  const body = (await response.json()) as {
    data: { id: number; ticketNumber: string }[];
  };
  const found = body.data.find((row) => row.ticketNumber === ticketNumber);

  if (!found) {
    throw new Error(`No ticket ${ticketNumber} in the test database.`);
  }

  return found.id;
};

/* ------------------------------------------------------ layout assertions -- */

/**
 * Fails if any two of the matching elements overlap.
 *
 * ui-spec.md section 9: "do any controls overlap" is a layout question only a
 * browser can answer. One pixel of tolerance for sub-pixel rounding, the same
 * reason `expectNoHorizontalScroll` gives.
 */
export const expectNoOverlap = async (
  page: Page,
  selector: string,
  what: string
): Promise<void> => {
  const overlaps = await page.evaluate((query) => {
    const visible = [
      ...globalThis.document.querySelectorAll<HTMLElement>(query),
    ]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0);
    const found: string[] = [];

    for (const [index, first] of visible.entries()) {
      for (const second of visible.slice(index + 1)) {
        const across =
          Math.min(first.box.right, second.box.right) -
          Math.max(first.box.left, second.box.left);
        const down =
          Math.min(first.box.bottom, second.box.bottom) -
          Math.max(first.box.top, second.box.top);

        if (across > 1 && down > 1) {
          found.push(
            `"${first.node.textContent?.trim().slice(0, 30)}" overlaps "${second.node.textContent?.trim().slice(0, 30)}"`
          );
        }
      }
    }

    return found;
  }, selector);

  expect(overlaps, `${what} overlap`).toEqual([]);
};

/**
 * How many of the matching elements sit on each visual row, top to bottom.
 * ui-spec.md sections 3 and 4 state the grid per band as "N per row".
 */
export const perRow = async (page: Page, selector: string): Promise<number[]> =>
  await page.evaluate((query) => {
    const tops = [...globalThis.document.querySelectorAll<HTMLElement>(query)]
      .map((node) => Math.round(node.getBoundingClientRect().top))
      .filter((top) => top > 0);
    const rows = new Map<number, number>();

    for (const top of tops) {
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }

    return (
      [...rows.entries()]
        // oxlint-disable-next-line unicorn/no-array-sort -- runs in the browser; this project's lib is ES2022.
        .sort(([a], [b]) => a - b)
        .map(([, count]) => count)
    );
  }, selector);

/** Whether the element lies wholly inside the viewport. */
export const expectInsideViewport = async (
  page: Page,
  locator: Locator,
  what: string
): Promise<void> => {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, `${what} has no box`).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (box && viewport) {
    expect(box.x, `${what} starts left of the viewport`).toBeGreaterThanOrEqual(
      -1
    );
    expect(
      box.x + box.width,
      `${what} ends right of the viewport`
    ).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y, `${what} starts above the viewport`).toBeGreaterThanOrEqual(
      -1
    );
    expect(
      box.y + box.height,
      `${what} ends below the viewport`
    ).toBeLessThanOrEqual(viewport.height + 1);
  }
};

/**
 * Presses Tab until `selector` has focus, as a keyboard user would.
 * Bounded, so a card that cannot be reached fails instead of hanging.
 */
export const tabTo = async (
  page: Page,
  selector: string,
  limit = 40
): Promise<void> => {
  for (let press = 0; press < limit; press += 1) {
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(
      (query) => globalThis.document.activeElement?.matches(query) ?? false,
      selector
    );

    if (focused) {
      return;
    }
  }

  throw new Error(`Tab never reached ${selector} within ${limit} presses.`);
};

/** Moves a ticket to `status` through the staff endpoint, as a fixture step. */
export const setStatusFor = async (
  request: APIRequestContext,
  ticketId: number,
  status: string
): Promise<void> => {
  const current = await request.get(`${API}/api/tickets/${ticketId}`);
  const { version } = (await current.json()) as { version: number };
  const response = await request.patch(
    `${API}/api/staff/tickets/${ticketId}/status`,
    { data: { status, version } }
  );

  expect(
    response.ok(),
    `PATCH status ${status} failed: ${response.status()}`
  ).toBe(true);
};

/**
 * A request the spec can hold back and release, so a loading or busy state can
 * be photographed instead of raced. `wait` resolves once `release` is called.
 */
export interface Gate {
  wait: Promise<void>;
  release: () => void;
}

export const createGate = (): Gate => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping, no-empty-function -- replaced by the promise executor below before anyone can call it.
  let release: () => void = () => {};
  // oxlint-disable-next-line promise/avoid-new -- a gate has no promise-returning source to wrap.
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { wait, release };
};

/** Resolves after `ms`, so a response can be slowed enough to click twice. */
export const pause = async (ms: number): Promise<void> => {
  // oxlint-disable-next-line promise/avoid-new -- wraps a timer callback.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};
