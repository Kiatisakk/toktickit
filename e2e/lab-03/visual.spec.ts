import { expect, test } from "@playwright/test";

import { MUST_CHANGE_REQUESTER } from "../../server/prisma/accounts";
import {
  computed,
  expectNoHorizontalScroll,
  expectNothingClipped,
  ZEN_GREEN,
} from "../lab-02/support";
import { pageAs } from "./sessions";
import {
  createTicketFor,
  expectTouchTargetsMeetMinimum,
  freshPage,
  lab3Summary,
  referenceIds,
} from "./support";

/** Mirrors `authentication.spec.ts`'s own reset — see its comment. */
const RESET_STARTING_PASSWORD = "ResetForE2E-1!";

/**
 * The checks jsdom cannot make, for Lab 3's new screens (RESP-01 to RESP-06).
 *
 * `e2e/lab-02/visual.spec.ts` already makes these checks for My Tickets,
 * Create Ticket and Ticket Detail as a Requester sees it; this file is the
 * same checks applied to the screens Lab 3 adds — the Ticket Queue, the
 * staff view of Ticket Detail, User Management, Login and Change Password —
 * plus RESP-03, which is new: the queue has to become cards below 768px
 * *and* stay a table at and above it, asserted from both sides so an empty
 * list cannot pass vacuously (the same reasoning `e2e/lab-02/visual.spec.ts`
 * gives for its own "table above it, cards below it" test).
 */

const API = "http://localhost:3000";

test.describe("Zen Green tokens on Lab 3's new screens (RESP-05)", () => {
  test("the header, primary buttons and active navigation", async ({
    browser,
  }, info) => {
    const staff = await pageAs(browser, info, "michael");

    await staff.goto("/staff/tickets");

    const header = staff.locator(".tkt-header");

    await expect(header).toBeVisible();
    expect(await computed(header, "background-color")).toBe(ZEN_GREEN.primary);

    // Scoped to the navigation and counted exactly: the breadcrumb carries
    // aria-current too, and `.first()` would let a missing or a doubled active
    // link pass. Review of PR #66. The underline is asserted, not assumed —
    // ui-spec.md §10 says the active state is marked by more than colour.
    const active = staff.locator('.tkt-nav [aria-current="page"]');

    await expect(active).toHaveCount(1);
    await expect(active).toHaveText(/Ticket Queue/u);
    expect(await computed(active, "border-bottom-color")).toBe(
      ZEN_GREEN.accent
    );

    const admin = await pageAs(browser, info, "wanida");

    await admin.goto("/admin/users");

    const createButton = admin.getByRole("button", { name: "Create User" });

    await expect(createButton).toBeVisible();
    expect(await computed(createButton, "background-color")).toBe(
      ZEN_GREEN.primary
    );

    await staff.context().close();
    await admin.context().close();
  });
});

test.describe("no horizontal scroll, nothing clipped (RESP-01, RESP-02)", () => {
  test("Login", async ({ browser }, info) => {
    const page = await freshPage(browser, info);

    await page.goto("/login");
    await expectNoHorizontalScroll(page, "Login");
    await expectNothingClipped(page);

    await page.context().close();
  });

  test("Change Password", async ({ browser }, info) => {
    // Reached only while the mandatory-change flag is set (ui-spec.md §4), so
    // an Administrator arms it first — the same technique
    // `authentication.spec.ts` uses, and idempotent for the same reason: it
    // does not matter whether the flag was already set from the seed or from
    // an earlier viewport project's run of this same test.
    const admin = await pageAs(browser, info, "wanida");

    await admin.goto("/admin/users");
    await admin.getByLabel("Search").fill(MUST_CHANGE_REQUESTER.email);
    await admin
      .getByRole("button", { name: `Edit ${MUST_CHANGE_REQUESTER.name}` })
      .click();
    await admin
      .getByRole("button", { name: "Set a New Initial Password" })
      .click();
    await admin
      .getByRole("textbox", { name: "New initial password", exact: true })
      .fill(RESET_STARTING_PASSWORD);
    await admin.getByRole("button", { name: "Set Password" }).click();
    await expect(
      admin.getByText("A new starting password was set.")
    ).toBeVisible();
    await admin.context().close();

    const page = await freshPage(browser, info);

    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(MUST_CHANGE_REQUESTER.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(RESET_STARTING_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/change-password$/u);
    await expectNoHorizontalScroll(page, "Change Password");
    await expectNothingClipped(page);

    await page.context().close();
  });

  test("the Ticket Queue", async ({ browser }, info) => {
    const staff = await pageAs(browser, info, "michael");

    await staff.goto("/staff/tickets");
    await expectNoHorizontalScroll(staff, "Ticket Queue");
    await expectNothingClipped(staff);

    await staff.context().close();
  });

  test("the staff Ticket Detail", async ({ browser, page }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id } = await createTicketFor(
      page.request,
      API,
      refs,
      lab3Summary("Visual Staff Detail", info)
    );

    const staff = await pageAs(browser, info, "michael");

    await staff.goto(`/tickets/${id}`);
    await expect(staff.getByLabel("IT Priority")).toBeVisible();
    await expectNoHorizontalScroll(staff, "Staff Ticket Detail");
    await expectNothingClipped(staff);

    await staff.context().close();
  });

  test("the Requester Ticket Detail, with its new sections", async ({
    page,
  }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id } = await createTicketFor(
      page.request,
      API,
      refs,
      lab3Summary("Visual Requester Detail", info)
    );

    await page.goto(`/tickets/${id}`);
    await expect(
      page.getByRole("button", { name: "Problem appears resolved" })
    ).toBeVisible();
    await expectNoHorizontalScroll(page, "Requester Ticket Detail");
    await expectNothingClipped(page);
  });

  test("User Management, including an open form", async ({ browser }, info) => {
    const admin = await pageAs(browser, info, "wanida");

    await admin.goto("/admin/users");
    await expectNoHorizontalScroll(admin, "User Management");
    await expectNothingClipped(admin);

    await admin.getByRole("button", { name: "Create User" }).click();
    await expect(
      admin.getByRole("heading", { name: "Create User" })
    ).toBeVisible();
    await expectNoHorizontalScroll(admin, "User Management (create form open)");
    await expectNothingClipped(admin);

    await admin.context().close();
  });
});

test.describe("the queue's presentation changes at 768px (RESP-03, RESP-04)", () => {
  test("table above it, cards below it, never both and never neither", async ({
    browser,
  }, info) => {
    const onMobile = info.project.name === "mobile";
    const staff = await pageAs(browser, info, "michael");

    await staff.goto("/staff/tickets");

    // A queue with no rows renders the empty state, and then neither the
    // table nor the cards exist — which would pass both assertions below
    // without testing anything (the same trap
    // `e2e/lab-02/visual.spec.ts` names for My Tickets). A row is a
    // precondition here too, made true by creating one rather than assumed.
    const refs = await referenceIds(staff.request, API);

    await createTicketFor(
      staff.request,
      API,
      refs,
      lab3Summary("Queue Presentation", info)
    );
    await staff.reload();

    await expect(
      staff.getByRole("link", { name: /^TKT-\d{4}-\d{6}$/u }).first()
    ).toBeVisible();

    await expect(staff.locator(".tkt-table")).toBeVisible({
      visible: !onMobile,
    });
    await expect(staff.locator(".tkt-cards")).toBeVisible({
      visible: onMobile,
    });

    // RESP-04: the sort control is reachable however the table is presented.
    await (onMobile
      ? expect(staff.getByLabel(/Sort by/u)).toBeVisible()
      : expect(
          staff.getByRole("button", { name: /Ticket No\./u })
        ).toBeVisible());

    await staff.context().close();
  });
});

test.describe("touch targets in the mobile band (RESP-06)", () => {
  test("every interactive control on the new screens is at least 44px tall", async ({
    browser,
  }, info) => {
    test.skip(
      info.project.name !== "mobile",
      "RESP-06 only applies to the mobile band (ui-spec.md §10)."
    );

    const staff = await pageAs(browser, info, "michael");

    await staff.goto("/staff/tickets");
    await expectTouchTargetsMeetMinimum(staff);

    // The navigation is collapsed behind Menu in this band, so its links are
    // not on screen to measure until it is opened.
    await staff.getByRole("button", { name: /menu/iu }).click();
    await expect(staff.locator(".tkt-nav--open")).toBeVisible();
    await expectTouchTargetsMeetMinimum(staff);

    const admin = await pageAs(browser, info, "wanida");

    await admin.goto("/admin/users");
    await expectTouchTargetsMeetMinimum(admin);

    await staff.context().close();
    await admin.context().close();
  });
});
