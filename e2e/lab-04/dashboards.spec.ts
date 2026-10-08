/* oxlint-disable no-await-in-loop -- browser steps are ordered by definition: each waits on the screen the one before it produced. */
import type { Locator, Page } from "@playwright/test";

import { ACTIVE_STAFF } from "../../server/prisma/accounts";
import { computed, ZEN_GREEN } from "../lab-02/support";
import { freshPage } from "../lab-03/support";
import {
  createGate,
  emptyTheTestDatabase,
  expect,
  openAs,
  seedTheDashboardFixture,
  shoot,
  tabTo,
  test,
} from "./support";

/**
 * The two dashboards, in a real browser (Lab 4 §14 — E2E-08 to E2E-11, and the
 * dashboard screenshots of ui-spec.md §11).
 *
 * The figures asserted are exact. They are a property of
 * `server/prisma/dashboardDemo.ts`, written into the test database by
 * `e2e:seed-dashboard` after every ticket has been removed, and worked out from
 * that file by hand — not read back from the API they are checking. The
 * arithmetic is in the comments beside each block.
 *
 * Michael Brown (IT Staff) owns tickets 03, 05, 06, 08 and 10 of the set;
 * Wanida Thongchai (Administrator) owns nothing. Jennifer Anderson raised 01,
 * 03, 05, 07, 10 and 12; Somchai Wattana raised 02, 04, 06, 08, 09 and 11;
 * Pimchanok Srisai raised none.
 *
 * Every test runs under the console guard in `support.ts` (AC-47).
 */

const TICKET_LINK = /^TKT-/u;
const UNCHANGED = "No change from yesterday";
const DELTA_LINE =
  /^(?:▲ \+\d+|▼ −\d+) from yesterday$|^No change from yesterday$/u;

const STAFF_CARD_KEYS = [
  "new",
  "open",
  "in-progress",
  "waiting",
  "reopened",
  "my-assigned",
  "unassigned",
  "my-follow-ups",
] as const;

/** The three cards of the eight that carry no delta (ui-spec.md §3). */
const NO_DELTA = new Set(["my-assigned", "unassigned", "my-follow-ups"]);

const card = (page: Page, key: string) => page.locator(`[data-card="${key}"]`);

const valueOf = async (page: Page, key: string): Promise<number> =>
  Number(await card(page, key).locator(".tkt-metric__value").textContent());

const ticketLinks = (scope: Locator | Page) =>
  scope.getByRole("link", { name: TICKET_LINK });

/** The two dashboard endpoints the failure and forbidden states stub. */
const STAFF_DASHBOARD_URL = /\/api\/dashboard\/staff$/u;
const REQUESTER_DASHBOARD_URL = /\/api\/dashboard\/requester$/u;

/** Forbidden, as the API words it (api-spec.md section 2). */
const FORBIDDEN_BODY = {
  error: {
    code: "FORBIDDEN",
    message: "You do not have access to this dashboard.",
  },
};

test.describe("zero states (E2E-11, BR-27)", () => {
  test("a user with nothing sees zeros, every card still a link", async ({
    browser,
    guard,
  }, info) => {
    emptyTheTestDatabase();

    // --- IT Staff with no Tickets in the system at all ---------------------
    const admin = await openAs(guard, browser, info, "wanida");

    await admin.goto("/dashboard");
    await expect(
      admin.getByRole("heading", { name: "Welcome back, Wanida Thongchai" })
    ).toBeVisible();

    for (const key of STAFF_CARD_KEYS) {
      await expect(card(admin, key)).toBeVisible();
      await expect(card(admin, key)).toHaveAttribute(
        "href",
        /^\/staff\/tickets/u
      );
      expect(await valueOf(admin, key)).toBe(0);
    }

    // "No change from yesterday" where the delta is zero; no line at all on
    // the three cards that have none (ui-spec.md §3).
    await expect(
      admin.locator(".tkt-metric__delta", { hasText: UNCHANGED })
    ).toHaveCount(5);
    await expect(
      admin.getByText("No tickets assigned to you yet.")
    ).toBeVisible();
    await expect(admin.getByText("Quick Actions")).toBeVisible();
    await shoot(admin, info, "staff-dashboard", "zero-metrics");
    await admin.context().close();

    // --- a Requester who has never raised a Ticket -------------------------
    const nobody = await openAs(guard, browser, info, "pimchanok");

    await nobody.goto("/dashboard");
    await expect(
      nobody.getByRole("heading", { name: "Welcome, Pimchanok Srisai" })
    ).toBeVisible();

    for (const key of ["open", "waiting-for-me", "resolved", "closed"]) {
      await expect(card(nobody, key)).toBeVisible();
      expect(await valueOf(nobody, key)).toBe(0);
    }

    await expect(
      nobody.getByText("You haven't raised any tickets yet.")
    ).toBeVisible();
    await expect(
      nobody.locator(".tkt-recent__empty").getByRole("link", {
        name: "Create Ticket",
      })
    ).toBeVisible();
    await shoot(nobody, info, "requester-dashboard", "zero-metrics");
    await nobody.context().close();
  });
});

test.describe("the dashboards over the demonstration data", () => {
  test.beforeAll(() => {
    seedTheDashboardFixture();
  });

  test.afterAll(() => {
    // The demonstration set belongs to Jennifer and Somchai; the server suite
    // reads every ticket its requesters own, so it must not outlive this file.
    emptyTheTestDatabase();
  });

  test("the staff dashboard shows the seeded figures (E2E-08)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/dashboard");
    await expect(
      staff.getByRole("heading", {
        name: `Welcome back, ${ACTIVE_STAFF.name}`,
      })
    ).toBeVisible();

    // dashboardDemo.ts, counted by hand:
    //   NEW 01 02 → 2 · OPEN 03 04 → 2 · IN_PROGRESS 05 06 07 → 3
    //   WAITING 08 → 1 · REOPENED 09 → 1
    //   My Assigned = Michael's open-group tickets 03 05 06 08 → 4
    //   Unassigned  = open-group tickets with no owner 01 02 → 2
    //   My open follow-ups = tickets where Michael performed an open one → 06
    const expected = {
      new: 2,
      open: 2,
      "in-progress": 3,
      waiting: 1,
      reopened: 1,
      "my-assigned": 4,
      unassigned: 2,
      "my-follow-ups": 1,
    };

    for (const key of STAFF_CARD_KEYS) {
      expect(await valueOf(staff, key), `${key} card`).toBe(expected[key]);

      const deltaText = await card(staff, key)
        .locator(".tkt-metric__delta")
        .textContent();
      const delta = (deltaText ?? "").trim();

      if (NO_DELTA.has(key)) {
        expect(delta, `${key} has no delta line`).toBe("");
      } else {
        expect(delta, `${key} delta line`).toMatch(DELTA_LINE);
      }
    }

    // The accessible name states label, value and delta in words (ui-spec §3).
    await expect(card(staff, "new")).toHaveAccessibleName(
      /^New, 2 tickets, (?:up \d+|down \d+) from yesterday$|^New, 2 tickets, no change from yesterday$/u
    );
    await expect(card(staff, "my-assigned")).toHaveAccessibleName(
      "My Assigned, 4 tickets"
    );

    // Cards keep their height whether or not they have a delta, so a row of
    // cards stays aligned (ui-spec.md §3).
    const heights = await staff
      .locator(".tkt-metric")
      .evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().height))
      );

    expect(new Set(heights).size, `card heights ${heights.join(", ")}`).toBe(1);

    // My Recent Tickets: Michael's five, most recently touched first (BR-26).
    await expect(ticketLinks(staff.locator(".tkt-recent"))).toHaveCount(5);
    await expect(staff.locator(".tkt-recent__row").first()).toBeVisible();
    await expect(
      staff.locator(".tkt-recent").getByRole("link", { name: "View all" })
    ).toHaveAttribute("href", /\/staff\/tickets\?ownerId=\d+$/u);
    await expect(staff.locator(".tkt-quick__tile")).toHaveCount(3);

    await shoot(staff, info, "staff-dashboard", "loaded");
    await staff.context().close();
  });

  test("every staff card opens the queue with a total equal to the card (E2E-08, AC-30)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/dashboard");

    for (const key of STAFF_CARD_KEYS) {
      await expect(card(staff, key)).toBeVisible();

      const count = await valueOf(staff, key);

      await card(staff, key).click();
      await expect(staff).toHaveURL(/\/staff\/tickets\?/u);
      await expect(staff.getByRole("heading", { level: 1 })).toHaveText(
        "Ticket Queue"
      );

      await (count === 0
        ? expect(
            staff.getByText("No tickets match these filters")
          ).toBeVisible()
        : expect(ticketLinks(staff.locator("main"))).toHaveCount(count));

      if (key === "new") {
        // The filter control shows the active filter (ui-spec.md §5).
        await expect(staff.getByLabel("Current Status")).toHaveValue("NEW");
        await shoot(staff, info, "staff-dashboard", "drill-down-new");
      }

      if (key === "my-follow-ups") {
        // `followUp` has no control, so it appears as a removable chip.
        await expect(staff).toHaveURL(/followUp=mine/u);
        await expect(staff.locator(".tkt-chip")).toContainText(
          "My open follow-ups"
        );
        await shoot(staff, info, "staff-dashboard", "drill-down-my-follow-ups");
      }

      // The Back button returns to the dashboard (ui-spec.md §5).
      await staff.goBack();
      await expect(staff).toHaveURL(/\/dashboard$/u);
    }

    // Removing the chip widens the list: the chip is why it was short.
    await staff.goto("/staff/tickets?followUp=mine");
    await expect(ticketLinks(staff.locator("main"))).toHaveCount(1);
    await staff
      .getByRole("button", { name: "Remove the My open follow-ups filter" })
      .click();
    await expect(staff).not.toHaveURL(/followUp/u);
    await expect(ticketLinks(staff.locator("main"))).toHaveCount(10);

    await staff.context().close();
  });

  test("an Administrator with no tickets has an empty Recent list (empty-recent)", async ({
    browser,
    guard,
  }, info) => {
    const admin = await openAs(guard, browser, info, "wanida");

    await admin.goto("/dashboard");
    await expect(
      admin.getByText("No tickets assigned to you yet.")
    ).toBeVisible();
    // The cards are the whole queue's, so they are not zero for her.
    expect(await valueOf(admin, "new")).toBe(2);
    expect(await valueOf(admin, "my-assigned")).toBe(0);
    await shoot(admin, info, "staff-dashboard", "empty-recent");

    await admin.context().close();
  });

  test("loading, failure, forbidden and refreshing, staff (E2E-11, AC-39)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    // --- loading: hold the request so the placeholders can be seen ----------
    const loading = createGate();

    await staff.route("**/api/dashboard/staff", async (route) => {
      await loading.wait;
      await route.continue();
    });
    await staff.goto("/dashboard");
    await expect(staff.locator(".tkt-metric--placeholder")).toHaveCount(8);
    await expect(staff.getByText("Loading dashboard")).toBeAttached();
    await expect(staff.getByRole("status")).toBeAttached();
    await expect(staff.getByRole("button", { name: "Refresh" })).toBeDisabled();

    const placeholderBox = await staff.locator(".tkt-dash-cards").boundingBox();

    await shoot(staff, info, "staff-dashboard", "loading");
    loading.release();
    await expect(card(staff, "new")).toBeVisible();
    await staff.unroute("**/api/dashboard/staff");

    // No layout jump when the data arrives (ui-spec.md §3).
    const loadedBox = await staff.locator(".tkt-dash-cards").boundingBox();

    expect(
      Math.abs((loadedBox?.height ?? 0) - (placeholderBox?.height ?? 0))
    ).toBeLessThanOrEqual(4);

    // --- refreshing: the figures stay until the new ones arrive -------------
    const refreshing = createGate();

    await staff.route("**/api/dashboard/staff", async (route) => {
      await refreshing.wait;
      await route.continue();
    });
    await staff.getByRole("button", { name: "Refresh" }).click();
    await expect(
      staff.getByRole("button", { name: "Refreshing…" })
    ).toBeDisabled();
    expect(await valueOf(staff, "new")).toBe(2);
    refreshing.release();
    await expect(staff.getByRole("button", { name: "Refresh" })).toBeEnabled();
    await staff.unroute("**/api/dashboard/staff");

    // --- failure: safe message, Try again, Refresh remains ------------------
    guard.expectAbort(STAFF_DASHBOARD_URL);
    await staff.route("**/api/dashboard/staff", async (route) => {
      await route.abort("failed");
    });
    await staff.reload();
    await expect(
      staff.getByText("The dashboard could not be loaded. Try again.")
    ).toBeVisible();
    await expect(
      staff.getByRole("button", { name: "Try again" })
    ).toBeVisible();
    await expect(staff.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(card(staff, "new")).toHaveCount(0);
    await shoot(staff, info, "staff-dashboard", "failure");

    // Try again recovers once the API does.
    await staff.unroute("**/api/dashboard/staff");
    await staff.getByRole("button", { name: "Try again" }).click();
    await expect(card(staff, "new")).toBeVisible();

    // --- forbidden: no numbers, a link to the user's own dashboard ----------
    guard.expectRefusal("GET", STAFF_DASHBOARD_URL, 403);
    await staff.route("**/api/dashboard/staff", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify(FORBIDDEN_BODY),
      });
    });
    await staff.reload();
    await expect(
      staff.getByText("You do not have access to this dashboard.")
    ).toBeVisible();
    await expect(
      staff.getByRole("link", { name: "Go to your dashboard" })
    ).toHaveAttribute("href", "/dashboard");
    await expect(staff.locator(".tkt-metric__value")).toHaveCount(0);
    await shoot(staff, info, "staff-dashboard", "forbidden");
    await staff.unroute("**/api/dashboard/staff");

    await staff.context().close();
  });

  test("cards take keyboard focus with a visible ring (cards-focused, AC-39)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/dashboard");
    await expect(card(staff, "new")).toBeVisible();
    await tabTo(staff, ".tkt-metric");

    const focused = staff.locator(".tkt-metric:focus");

    await expect(focused).toHaveCount(1);
    expect(await computed(focused, "outline-style")).toBe("solid");
    expect(await computed(focused, "outline-width")).toBe("2px");
    expect(await computed(focused, "outline-color")).toBe(ZEN_GREEN.accent);
    await shoot(staff, info, "staff-dashboard", "cards-focused");

    await staff.context().close();
  });

  test("the Requester dashboard counts only that Requester's tickets (E2E-09, AC-02)", async ({
    browser,
    guard,
    page,
  }, info) => {
    // Jennifer (the project's default session): 01 NEW, 03 OPEN, 05 and 07
    // IN_PROGRESS → Open 4; 10 RESOLVED → Resolved 1; Waiting 0; Closed 0.
    // 12 is CANCELLED and counts in none of the four.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Welcome, Jennifer Anderson" })
    ).toBeVisible();
    expect(await valueOf(page, "open")).toBe(4);
    expect(await valueOf(page, "waiting-for-me")).toBe(0);
    expect(await valueOf(page, "resolved")).toBe(1);
    expect(await valueOf(page, "closed")).toBe(0);
    await expect(
      page.locator(".tkt-metric__delta", { hasText: /\S/u })
    ).toHaveCount(0);
    await expect(card(page, "open")).toContainText("View all");
    await expect(card(page, "open")).toHaveAccessibleName(
      "Open, 4 tickets, view all"
    );
    await expect(ticketLinks(page.locator(".tkt-recent"))).toHaveCount(5);
    await expect(page.locator(".tkt-quick__tile")).toHaveCount(2);
    await shoot(page, info, "requester-dashboard", "loaded");

    // Somchai: 02 NEW, 04 OPEN, 06 IN_PROGRESS, 08 WAITING, 09 REOPENED → Open
    // 5 (Waiting counts as open); Waiting 1; Resolved 0; 11 CLOSED → Closed 1.
    const somchai = await openAs(guard, browser, info, "somchai");

    await somchai.goto("/dashboard");
    expect(await valueOf(somchai, "open")).toBe(5);
    expect(await valueOf(somchai, "waiting-for-me")).toBe(1);
    expect(await valueOf(somchai, "resolved")).toBe(0);
    expect(await valueOf(somchai, "closed")).toBe(1);
    await shoot(somchai, info, "requester-dashboard", "waiting-for-me");

    // Waiting for me → My Tickets filtered to that one status.
    await card(somchai, "waiting-for-me").click();
    await expect(somchai).toHaveURL(
      /\/my-tickets\?status=WAITING_FOR_REQUESTER$/u
    );
    await expect(somchai.getByLabel("Current Status")).toHaveValue(
      "WAITING_FOR_REQUESTER"
    );
    await expect(ticketLinks(somchai.locator("main"))).toHaveCount(1);
    await somchai.goBack();

    // Open → the open group, with the chip that explains the short list.
    await card(somchai, "open").click();
    await expect(somchai).toHaveURL(/\/my-tickets\?statusGroup=open$/u);
    await expect(somchai.locator(".tkt-chip")).toContainText("Open tickets");
    await expect(ticketLinks(somchai.locator("main"))).toHaveCount(5);
    await shoot(somchai, info, "requester-dashboard", "drill-down-open");

    // Nothing of Jennifer's is in Somchai's list.
    await expect(
      somchai.getByText("Demo: cannot sign in to the LEB2 app")
    ).toHaveCount(0);

    await somchai.context().close();
  });

  test("loading, failure and forbidden, Requester (E2E-11, AC-39)", async ({
    page,
    guard,
    browser,
  }, info) => {
    const loading = createGate();

    await page.route("**/api/dashboard/requester", async (route) => {
      await loading.wait;
      await route.continue();
    });
    await page.goto("/dashboard");
    await expect(page.locator(".tkt-metric--placeholder")).toHaveCount(4);
    await expect(page.getByText("Loading dashboard")).toBeAttached();
    await shoot(page, info, "requester-dashboard", "loading");
    loading.release();
    await expect(card(page, "open")).toBeVisible();
    await page.unroute("**/api/dashboard/requester");

    guard.expectAbort(REQUESTER_DASHBOARD_URL);
    await page.route("**/api/dashboard/requester", async (route) => {
      await route.abort("failed");
    });
    await page.reload();
    await expect(
      page.getByText("The dashboard could not be loaded. Try again.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await shoot(page, info, "requester-dashboard", "failure");
    await page.unroute("**/api/dashboard/requester");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(card(page, "open")).toBeVisible();

    // A staff user is never shown this screen (ui-spec.md §4), so the
    // forbidden state is forced: the Requester's own dashboard answering 403.
    // The staff-side half of this rule is the API refusing staff 403, which
    // the server suite proves (SEC-*); here the screen's wording is shown.
    guard.expectRefusal("GET", REQUESTER_DASHBOARD_URL, 403);
    await page.route("**/api/dashboard/requester", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify(FORBIDDEN_BODY),
      });
    });
    await page.reload();
    await expect(
      page.getByText("You do not have access to this dashboard.")
    ).toBeVisible();
    await expect(page.locator(".tkt-metric__value")).toHaveCount(0);
    await shoot(page, info, "requester-dashboard", "forbidden-for-staff");
    await page.unroute("**/api/dashboard/requester");

    // The real refusal, from the server: IT Staff asking for the Requester
    // dashboard is answered 403 (api-spec.md section 8).
    const staff = await openAs(guard, browser, info, "michael");
    const refused = await staff.request.get(
      "http://localhost:3000/api/dashboard/requester"
    );

    expect(refused.status()).toBe(403);
    await staff.context().close();
  });
});

test.describe("landing and navigation (E2E-10, AC-38)", () => {
  test("each role lands on the dashboard with Dashboard first", async ({
    browser,
    guard,
    page,
  }, info) => {
    // Requester: the saved session, then a role refusal.
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/u);
    expect(await page.locator(".tkt-nav a").allTextContents()).toEqual([
      "Dashboard",
      "My Tickets",
      "Create Ticket",
    ]);
    await expect(page.locator('.tkt-nav [aria-current="page"]')).toHaveText(
      "Dashboard"
    );

    await page.goto("/staff/tickets");
    await expect(page).toHaveURL(/\/dashboard$/u);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/dashboard$/u);

    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/");
    await expect(staff).toHaveURL(/\/dashboard$/u);
    expect(await staff.locator(".tkt-nav a").allTextContents()).toEqual([
      "Dashboard",
      "Ticket Queue",
      "My Tickets",
      "Create Ticket",
    ]);
    await staff.goto("/admin/users");
    await expect(staff).toHaveURL(/\/dashboard$/u);
    await staff.context().close();

    const admin = await openAs(guard, browser, info, "wanida");

    await admin.goto("/");
    await expect(admin).toHaveURL(/\/dashboard$/u);
    expect(await admin.locator(".tkt-nav a").allTextContents()).toEqual([
      "Dashboard",
      "Ticket Queue",
      "User Management",
      "My Tickets",
      "Create Ticket",
    ]);
    await admin.context().close();
  });

  test("signing in through the screen ends at the dashboard", async ({
    browser,
    guard,
  }, info) => {
    // A fresh context, not a saved session: the sign-in itself is the subject.
    const fresh = await freshPage(browser, info);

    guard.attach(fresh);

    await fresh.goto("/login");
    await fresh
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ACTIVE_STAFF.email);
    await fresh
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(ACTIVE_STAFF.password);
    await fresh.getByRole("button", { name: "Sign In" }).click();
    await expect(fresh).toHaveURL(/\/dashboard$/u);
    await expect(
      fresh.getByRole("heading", { name: `Welcome back, ${ACTIVE_STAFF.name}` })
    ).toBeVisible();

    await fresh.context().close();
  });
});
