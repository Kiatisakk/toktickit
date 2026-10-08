import type { Page } from "@playwright/test";

import { createTicketFor, referenceIds } from "../lab-03/support";
import {
  API,
  completeActionFor,
  createActionFor,
  expect,
  lab4Summary,
  openAs,
  setStatusFor,
  shoot,
  staffIdByName,
  test,
} from "./support";

/**
 * Resolving a Ticket through the gate, in a real browser (Lab 4 §14 — E2E-05,
 * E2E-06, E2E-07, and the resolve-dialog screenshots of ui-spec.md §11).
 *
 * Setup that is not the thing being proved (moving a ticket to In Progress,
 * recording and completing Actions) goes through the API as the staff member,
 * so each journey spends its time on the screen it is about. The Actions form
 * itself is the subject of `actions-taken-flow.spec.ts`.
 */

const STALE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

const gate = (page: Page) =>
  page.getByRole("list", { name: "Conditions for resolving" });

const dialog = (page: Page) => page.getByRole("dialog");

const openResolveDialog = async (page: Page): Promise<void> => {
  // A person choosing from the select has it focused; `selectOption` alone
  // does not focus it, and the focus-return check below needs a real opener.
  await page.getByLabel("Current Status").focus();
  await page.getByLabel("Current Status").selectOption("RESOLVED");
  await expect(dialog(page)).toBeVisible();
  // The checklist has been computed from the loaded Actions, not left at
  // "Checking…".
  await expect(page.getByText("Checking the ticket's actions…")).toHaveCount(0);
};

test.describe("the resolution gate (E2E-05)", () => {
  test("refused with each unmet condition shown, then resolved once the work is in", async ({
    browser,
    guard,
    page,
  }, info) => {
    test.setTimeout(120_000);

    const refs = await referenceIds(page.request, API);
    const { id: ticketId, ticketNumber } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Resolution Gate", info)
    );
    const michael = await openAs(guard, browser, info, "michael");

    await setStatusFor(michael.request, ticketId, "OPEN");
    await setStatusFor(michael.request, ticketId, "IN_PROGRESS");
    const michaelId = await staffIdByName(michael.request, "Michael Brown");

    await michael.goto(`/tickets/${ticketId}`);

    // --- 1. no Actions at all: the server refuses, beside the condition -----
    await openResolveDialog(michael);
    await expect(
      dialog(michael).getByRole("heading", {
        name: `Resolve ticket ${ticketNumber}`,
      })
    ).toBeVisible();
    // Confirm waits for a summary (the fourth condition is the user's own).
    await expect(
      dialog(michael).getByRole("button", { name: "Confirm resolution" })
    ).toBeDisabled();
    await dialog(michael)
      .getByLabel(/^Resolution Summary/u)
      .fill("Replaced the access point and verified coverage.");
    await expect(
      dialog(michael).getByRole("button", { name: "Confirm resolution" })
    ).toBeEnabled();
    await expect(
      gate(michael)
        .getByRole("listitem")
        .filter({ hasText: "completed action" })
    ).toContainText("not met");

    await dialog(michael)
      .getByRole("button", { name: "Confirm resolution" })
      .click();
    // The server is the authority: its refusal is shown, the dialog stays and
    // nothing was changed (BR-16, AC-41).
    await expect(dialog(michael).getByRole("alert")).toBeVisible();
    await expect(dialog(michael)).toBeVisible();
    await expect(michael.getByText("Now In Progress.")).toBeVisible();

    // Cancel closes it with nothing half-applied, and focus goes back to the
    // control that opened it (ui-spec.md section 7).
    await dialog(michael).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(michael)).toHaveCount(0);
    await expect(michael.getByLabel("Current Status")).toBeFocused();
    await expect(michael.getByText("Now In Progress.")).toBeVisible();

    // --- 2. an open follow-up and a planned Action ------------------------
    const first = await createActionFor(michael.request, ticketId, {
      description: "Raised the idle timeout on the VPN gateway.",
      performedById: michaelId,
      followUpNote: "Check the gateway logs again on Friday.",
    });

    await completeActionFor(michael.request, first, "Fewer dropped sessions.");
    await createActionFor(michael.request, ticketId, {
      description: "Re-survey coverage after hours.",
      performedById: michaelId,
    });

    await michael.reload();
    await openResolveDialog(michael);
    await dialog(michael)
      .getByLabel(/^Resolution Summary/u)
      .fill("Replaced the access point and verified coverage.");

    const items = gate(michael).getByRole("listitem");

    await expect(items.filter({ hasText: "completed action" })).toContainText(
      "met"
    );
    await expect(
      items.filter({ hasText: "completed action" })
    ).not.toContainText("not met");
    await expect(items.filter({ hasText: "open follow-ups" })).toContainText(
      "1 open"
    );
    await expect(items.filter({ hasText: "planned actions" })).toContainText(
      "1 planned"
    );
    // Each unmet one links to the first of them (ui-spec.md section 7).
    await expect(
      items.filter({ hasText: "open follow-ups" }).getByRole("link")
    ).toHaveAttribute("href", /^#action-\d+$/u);
    await shoot(michael, info, "actions-taken", "resolve-dialog-unmet");

    // Escape closes it, as a modal's does.
    await michael.keyboard.press("Escape");
    await expect(dialog(michael)).toHaveCount(0);

    // The "View the first" link closes the dialog and lands on the row.
    await openResolveDialog(michael);
    await items
      .filter({ hasText: "planned actions" })
      .getByRole("link")
      .click();
    await expect(dialog(michael)).toHaveCount(0);

    // --- 3. the work is done: complete the planned one, follow up the open ---
    const list = await michael.request.get(
      `${API}/api/tickets/${ticketId}/actions`
    );
    const rows = (
      (await list.json()) as {
        data: { id: number; version: number; state: string }[];
      }
    ).data;
    const planned = rows.find((row) => row.state === "PLANNED");
    const opener = rows.find((row) => row.state === "DONE");

    expect(planned).toBeDefined();
    expect(opener).toBeDefined();

    if (planned && opener) {
      await completeActionFor(michael.request, planned, "Coverage confirmed.");

      const closer = await createActionFor(michael.request, ticketId, {
        description: "Checked the gateway logs on Friday; no drops.",
        performedById: michaelId,
        followsUpId: opener.id,
      });

      await completeActionFor(michael.request, closer, "Logs are clean.");
    }

    await michael.reload();
    await openResolveDialog(michael);
    await dialog(michael)
      .getByLabel(/^Resolution Summary/u)
      .fill("Replaced the access point and verified coverage.");
    // The dialog read the Actions afresh on opening (AC-49): all four met.
    await expect(items.filter({ hasText: "not met" })).toHaveCount(0);
    await expect(items.filter({ hasText: "— met" })).toHaveCount(4);
    await shoot(michael, info, "actions-taken", "resolve-dialog-met");

    await dialog(michael)
      .getByRole("button", { name: "Confirm resolution" })
      .click();
    await expect(dialog(michael)).toHaveCount(0);

    // The ticket summary refreshes from the response: status and summary.
    await expect(michael.getByText("Now Resolved.")).toBeVisible();
    await expect(michael.locator("#tkt-detail-resolution")).toHaveText(
      "Replaced the access point and verified coverage."
    );
    // And Actions can no longer be added to it (BR-13).
    await expect(
      michael.getByRole("button", { name: "Add action" })
    ).toHaveCount(0);
    await shoot(michael, info, "actions-taken", "resolved");

    await michael.context().close();
  });
});

test.describe("two people, one ticket (E2E-06)", () => {
  test("the second change is refused as stale, its text is kept, and it succeeds after the reload", async ({
    browser,
    guard,
    page,
  }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id: ticketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Stale Update", info)
    );
    const michael = await openAs(guard, browser, info, "michael");
    const sarah = await openAs(guard, browser, info, "sarah");

    await michael.goto(`/tickets/${ticketId}`);
    await sarah.goto(`/tickets/${ticketId}`);
    await expect(michael.getByLabel("IT Priority")).toBeVisible();
    await expect(sarah.getByLabel("IT Priority")).toBeVisible();

    // Sarah changes the ticket first.
    await sarah.getByLabel("IT Priority").selectOption("LOW");
    await expect(sarah.getByLabel("IT Priority")).toHaveValue("LOW");

    // Michael acts on the version he loaded.
    await michael.getByLabel("Current Status").selectOption("OPEN");
    await expect(michael.getByText(STALE)).toBeVisible();
    // The latest version was loaded: Sarah's priority is now on his screen.
    await expect(michael.getByLabel("IT Priority")).toHaveValue("LOW");

    // The retry names the version now stored, and succeeds.
    await michael.getByLabel("Current Status").selectOption("OPEN");
    await expect(michael.getByText("Now Open.")).toBeVisible();
    await expect(michael.getByText(STALE)).toHaveCount(0);

    await sarah.context().close();
    await michael.context().close();
  });
});

test.describe("advice versus authority (E2E-07)", () => {
  test("the Requester says it looks resolved; only staff resolve it; staff reopen it", async ({
    browser,
    guard,
    page,
  }, info) => {
    test.setTimeout(120_000);

    const refs = await referenceIds(page.request, API);
    const { id: ticketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Advice And Authority", info)
    );
    const michael = await openAs(guard, browser, info, "michael");
    const michaelId = await staffIdByName(michael.request, "Michael Brown");

    await setStatusFor(michael.request, ticketId, "OPEN");
    const done = await createActionFor(michael.request, ticketId, {
      description: "Replaced the battery.",
      performedById: michaelId,
    });

    await completeActionFor(
      michael.request,
      done,
      "Full charge cycle verified."
    );

    // --- the Requester's advice changes nothing ---------------------------
    await page.goto(`/tickets/${ticketId}`);
    await page
      .getByRole("button", { name: "Problem appears resolved" })
      .click();
    await page.getByRole("button", { name: "Yes, tell IT" }).click();
    await expect(
      page.getByText(/You told IT the problem appears resolved on/u)
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Resolved", { exact: true })).toHaveCount(0);

    // --- staff decide ------------------------------------------------------
    await michael.goto(`/tickets/${ticketId}`);
    await expect(
      michael.getByText(
        /The requester told IT the problem appears resolved on/u
      )
    ).toBeVisible();
    await openResolveDialog(michael);
    await dialog(michael)
      .getByLabel(/^Resolution Summary/u)
      .fill("Battery replaced under warranty.");
    await dialog(michael)
      .getByRole("button", { name: "Confirm resolution" })
      .click();
    await expect(dialog(michael)).toHaveCount(0);

    // --- the Requester sees Resolved and the summary -----------------------
    await page.reload();
    await expect(
      page.getByText("Resolved", { exact: true }).first()
    ).toBeVisible();
    await expect(page.locator("#tkt-detail-resolution")).toHaveText(
      "Battery replaced under warranty."
    );

    // --- staff reopen -------------------------------------------------------
    await michael.getByLabel("Current Status").selectOption("REOPENED");
    await expect(michael.getByText("Now Reopened.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Reopened", { exact: true }).first()
    ).toBeVisible();

    await michael.context().close();
  });
});
