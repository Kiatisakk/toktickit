import type { Locator, Page } from "@playwright/test";

import { createTicketFor, referenceIds } from "../lab-03/support";
import {
  API,
  expect,
  lab4Summary,
  openAs,
  pause,
  shoot,
  test,
} from "./support";

/**
 * Actions Taken on Ticket Detail, in a real browser (Lab 4 §14 — E2E-01 to
 * E2E-04 and E2E-14, and the `actions-taken/` screenshots of ui-spec.md §11).
 *
 * One long journey rather than many short ones, for the reason Lab 2 and Lab 3
 * give: the journey is the assertion. An Action one staff member records has to
 * be the one another edits and completes, and the follow-up it opens has to be
 * closed by a later Action; each step needs the one before.
 *
 * `page` (the viewport project's default fixture) is Requester A. Michael Brown
 * and Sarah Johnson are IT Staff in their own browser contexts (a context is a
 * cookie jar, so they are two people on two machines). Nobody clicks Logout, so
 * no saved session is disturbed for the specs that run after this one.
 */

const COMPLETED_TWICE = "This action can no longer be changed.";
const NOT_ACTIONABLE =
  "Actions can't be added to a resolved, closed or cancelled ticket.";
const INELIGIBLE =
  "Only active IT Staff and Administrators can perform an action.";
const STALE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

const area = (page: Page) =>
  page.getByRole("region", { name: "Actions Taken" });

const rowOf = (page: Page, text: string): Locator =>
  area(page).locator("tr", { hasText: text });

/** The id the list prints beside an Action's date, as a number. */
const idOf = async (row: Locator): Promise<number> =>
  Number(
    ((await row.locator(".tkt-actions-table__id").textContent()) ?? "").replace(
      "#",
      ""
    )
  );

const formOf = (page: Page, name: RegExp | string): Locator =>
  area(page).getByRole("form", { name });

const field = (form: Locator, label: RegExp | string): Locator =>
  form.getByRole("textbox", { name: label });

/** Opens the Add action form and records one Action, leaving the list showing it. */
const addAction = async (
  page: Page,
  fields: {
    description: string;
    performer?: string;
    followUpNote?: string;
    followsUp?: string;
  }
): Promise<Locator> => {
  await area(page).getByRole("button", { name: "Add action" }).click();

  const form = formOf(page, "Add action");

  await field(form, /^Description/u).fill(fields.description);

  if (fields.performer) {
    await form
      .getByLabel(/^Performed by/u)
      .selectOption({ label: fields.performer });
  }

  if (fields.followUpNote) {
    await form.getByLabel("Follow-up required").check();
    await field(form, /^Follow-up note/u).fill(fields.followUpNote);
  }

  if (fields.followsUp) {
    await form
      .getByLabel(/^Follows up/u)
      .selectOption({ label: fields.followsUp });
  }

  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toHaveCount(0);

  return rowOf(page, fields.description);
};

const completeAction = async (
  page: Page,
  row: Locator,
  result: string
): Promise<void> => {
  await row.getByRole("button", { name: /^Complete action/u }).click();

  const form = formOf(page, /^Complete action/u);

  await field(form, /^Result/u).fill(result);
  await form.getByRole("button", { name: "Confirm" }).click();
  await expect(form).toHaveCount(0);
};

test.describe("Actions Taken", () => {
  test("record, edit, complete, follow up and cancel (E2E-01, E2E-02, E2E-03, E2E-04)", async ({
    browser,
    guard,
    page,
  }, info) => {
    // Two staff members, an inactive performer, six writes and a Requester's
    // view in one test.
    test.setTimeout(180_000);

    const refs = await referenceIds(page.request, API);
    const { id: ticketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Actions Journey", info),
      "HIGH"
    );

    const michael = await openAs(guard, browser, info, "michael");
    const sarah = await openAs(guard, browser, info, "sarah");
    const admin = await openAs(guard, browser, info, "wanida");

    // An inactive staff member, offered to the form by a stale owners list
    // (ui-spec.md section 6: "if a stale list lets an ineligible person
    // through, the server's ACTION_ASSIGNEE_INELIGIBLE is shown beside that
    // field"). The real list never offers him; the route adds him so the
    // refusal can be reached from the screen.
    const lookup = await admin.request.get(
      `${API}/api/admin/users?search=arthit`
    );
    const [arthit] = (await lookup.json()) as { id: number; name: string }[];

    expect(arthit?.name).toBe("Arthit Sae-Lim");
    await michael.route("**/api/staff/owners", async (route) => {
      const response = await route.fetch();
      const owners = (await response.json()) as { id: number; name: string }[];

      await route.fulfill({
        response,
        json: [...owners, { id: arthit?.id ?? 0, name: "Arthit Sae-Lim" }],
      });
    });

    // --- empty -----------------------------------------------------------
    await michael.goto(`/tickets/${ticketId}`);
    await expect(
      area(michael).getByText("No actions have been recorded for this ticket.")
    ).toBeVisible();
    await shoot(michael, info, "actions-taken", "empty");

    // --- the form, and its validation beneath the field -------------------
    await area(michael).getByRole("button", { name: "Add action" }).click();

    const createForm = formOf(michael, "Add action");

    await expect(createForm).toBeVisible();
    await expect(field(createForm, /^Description/u)).toBeEmpty();
    await shoot(michael, info, "actions-taken", "create-form");

    await createForm.getByRole("button", { name: "Save" }).click();
    await expect(createForm.getByText("Enter a description.")).toBeVisible();
    // The field is focused and the message is bound to it (ui-spec.md §6, §10).
    await expect(field(createForm, /^Description/u)).toBeFocused();
    await expect(
      field(createForm, /^Description/u)
    ).toHaveAccessibleDescription("Enter a description.");
    await shoot(michael, info, "actions-taken", "create-validation");

    // --- an inactive performer is refused, beside the field (E2E-02) ------
    await field(createForm, /^Description/u).fill(
      "Replaced the faulty access point in the reading room."
    );
    await createForm
      .getByLabel(/^Performed by/u)
      .selectOption({ label: "Arthit Sae-Lim" });
    await createForm.getByRole("button", { name: "Save" }).click();
    await expect(
      createForm.getByLabel(/^Performed by/u)
    ).toHaveAccessibleDescription(INELIGIBLE);
    await expect(createForm.getByLabel(/^Performed by/u)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    // What was typed survives the refusal (FR-25).
    await expect(field(createForm, /^Description/u)).toHaveValue(
      "Replaced the faulty access point in the reading room."
    );
    await shoot(michael, info, "actions-taken", "inactive-performer-refused");
    await michael.unroute("**/api/staff/owners");

    // --- record it, performed by a colleague (E2E-01) ---------------------
    await createForm
      .getByLabel(/^Performed by/u)
      .selectOption({ label: "Sarah Johnson" });
    await createForm.getByRole("button", { name: "Save" }).click();
    await expect(createForm).toHaveCount(0);

    const first = rowOf(
      michael,
      "Replaced the faulty access point in the reading room."
    );

    await expect(first.getByText("Planned", { exact: true })).toBeVisible();
    await expect(first.getByText("Sarah Johnson")).toBeVisible();
    const firstId = await idOf(first);

    // A second, with a follow-up it will need.
    const second = await addAction(michael, {
      description: "Raised the idle timeout on the VPN gateway.",
      performer: "Michael Brown",
      followUpNote: "Check the gateway logs again on Friday.",
    });

    await expect(second.getByText("Not required")).toHaveCount(0);
    const secondId = await idOf(second);

    // --- another staff member edits it, then completes it (E2E-01) --------
    await sarah.goto(`/tickets/${ticketId}`);

    const sarahsRow = rowOf(
      sarah,
      "Replaced the faulty access point in the reading room."
    );

    await sarahsRow.getByRole("button", { name: /^Edit action/u }).click();

    const editForm = formOf(sarah, `Edit action #${firstId}`);

    // The link to an earlier Action is fixed at creation, so it is a value, not
    // a select (BR-10, ui-spec.md section 6).
    await expect(
      editForm.getByText("Not linked to another action")
    ).toBeVisible();
    await expect(editForm.getByLabel(/^Follows up/u)).toHaveCount(0);
    await shoot(sarah, info, "actions-taken", "edit");
    await field(editForm, /^Description/u).fill(
      "Replaced the faulty access point in the reading room and re-tested."
    );
    await editForm.getByRole("button", { name: "Save" }).click();
    await expect(editForm).toHaveCount(0);

    const edited = rowOf(sarah, "and re-tested.");

    await edited.getByRole("button", { name: /^Complete action/u }).click();

    const completeForm = formOf(sarah, `Complete action #${firstId}`);

    await expect(completeForm.getByLabel(/^Result/u)).toBeVisible();
    await shoot(sarah, info, "actions-taken", "complete");

    // A Result is required to complete (BR-06).
    await completeForm.getByRole("button", { name: "Confirm" }).click();
    await expect(
      completeForm.getByText("Enter the result before completing.")
    ).toBeVisible();
    await field(completeForm, /^Result/u).fill(
      "Signal stable on the second floor."
    );
    await completeForm.getByRole("button", { name: "Confirm" }).click();
    await expect(completeForm).toHaveCount(0);
    await expect(edited.getByText("Done", { exact: true })).toBeVisible();
    await expect(
      edited.getByText("Signal stable on the second floor.")
    ).toBeVisible();

    // Done is final: only View is left on its row (BR-04).
    await expect(
      edited.getByRole("button", { name: /^(?:Edit|Complete|Cancel) action/u })
    ).toHaveCount(0);
    await expect(
      edited.getByRole("button", { name: /^View action/u })
    ).toBeVisible();

    // --- follow-up opened (E2E-03) ----------------------------------------
    await michael.reload();

    const secondRow = rowOf(michael, "Raised the idle timeout");

    await completeAction(
      michael,
      secondRow,
      "Dropped connections fell, but one user still reports it."
    );
    await expect(secondRow.getByText("Done", { exact: true })).toBeVisible();
    // The badge carries text, not only colour (ui-spec.md section 1).
    await expect(secondRow.getByText("Open", { exact: true })).toBeVisible();
    await shoot(michael, info, "actions-taken", "follow-up-open");

    // --- ...and closed by a Done Action that follows it up (E2E-03) -------
    const third = await addAction(michael, {
      description: "Checked the gateway logs on Friday; no drops since.",
      performer: "Michael Brown",
      followsUp: `#${secondId}: Raised the idle timeout on the VPN gateway.`,
    });

    await expect(third.getByText(`Follows up #${secondId}`)).toBeVisible();
    await completeAction(michael, third, "Logs are clean for five days.");
    await expect(
      rowOf(michael, "Raised the idle timeout").getByText("Closed", {
        exact: true,
      })
    ).toBeVisible();
    await shoot(michael, info, "actions-taken", "follow-up-linked");

    // --- cancelling needs a reason (E2E-02) -------------------------------
    const fourth = await addAction(michael, {
      description: "Swap the switch in the comms cupboard.",
      performer: "Michael Brown",
    });

    await fourth.getByRole("button", { name: /^Cancel action/u }).click();

    const cancelForm = formOf(michael, /^Cancel action/u);

    await cancelForm.getByRole("button", { name: "Confirm" }).click();
    await expect(
      cancelForm.getByText("Enter a reason for cancelling.")
    ).toBeVisible();
    await shoot(michael, info, "actions-taken", "cancel-reason");
    await field(cancelForm, /^Reason/u).fill(
      "The fault was the access point, not the switch."
    );
    await cancelForm.getByRole("button", { name: "Confirm" }).click();
    await expect(cancelForm).toHaveCount(0);
    await expect(fourth.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(
      fourth.getByRole("button", { name: /^(?:Edit|Complete|Cancel) action/u })
    ).toHaveCount(0);

    // --- a Planned one left standing, so the list shows every state --------
    const fifth = await addAction(michael, {
      description: "Re-survey coverage on the first floor after hours.",
      performer: "Michael Brown",
    });

    await expect(fifth.getByText("Planned", { exact: true })).toBeVisible();
    const fifthId = await idOf(fifth);

    await expect(area(michael).locator("tbody tr")).toHaveCount(5);
    await shoot(michael, info, "actions-taken", "list-several");

    // --- View: a Planned Action's fields, then a Done one's ----------------
    await fifth.getByRole("button", { name: /^View action/u }).click();
    await expect(
      area(michael).getByRole("region", { name: `Action #${fifthId}` })
    ).toBeVisible();
    await expect(area(michael).getByText(COMPLETED_TWICE)).toHaveCount(0);
    await shoot(michael, info, "actions-taken", "view");

    await area(michael).getByRole("button", { name: "Close" }).click();
    await rowOf(michael, "and re-tested.")
      .getByRole("button", { name: /^View action/u })
      .click();
    await expect(area(michael).getByText(COMPLETED_TWICE)).toBeVisible();
    await expect(area(michael).getByText("Recorded by")).toBeVisible();
    await shoot(michael, info, "actions-taken", "done-readonly");
    await area(michael).getByRole("button", { name: "Close" }).click();

    // --- a stale edit: someone else changed it first (AC-42) ---------------
    await michael.reload();
    await rowOf(michael, "Re-survey coverage")
      .getByRole("button", { name: /^Edit action/u })
      .click();

    const staleForm = formOf(michael, `Edit action #${fifthId}`);
    const typed = "Re-survey coverage on the first floor, after hours, twice.";

    await field(staleForm, /^Description/u).fill(typed);

    // Sarah saves the same Action while Michael's form is open.
    await sarah.reload();
    await rowOf(sarah, "Re-survey coverage")
      .getByRole("button", { name: /^Edit action/u })
      .click();

    const sarahsEdit = formOf(sarah, `Edit action #${fifthId}`);

    await field(sarahsEdit, /^Result/u).fill("Survey booked for Tuesday.");
    await sarahsEdit.getByRole("button", { name: "Save" }).click();
    await expect(sarahsEdit).toHaveCount(0);

    await staleForm.getByRole("button", { name: "Save" }).click();
    await expect(staleForm.getByText(STALE)).toBeVisible();
    // His text stays in the form, and what she saved is now on the list.
    await expect(field(staleForm, /^Description/u)).toHaveValue(typed);
    await expect(
      area(michael).getByText("Survey booked for Tuesday.")
    ).toBeVisible();
    await shoot(michael, info, "actions-taken", "stale-update");

    // Retrying after the reload succeeds.
    await staleForm.getByRole("button", { name: "Save" }).click();
    await expect(staleForm).toHaveCount(0);
    await expect(rowOf(michael, typed)).toBeVisible();

    // --- the Requester's read-only view (E2E-04, AC-07) --------------------
    await page.goto(`/tickets/${ticketId}`);
    await expect(
      area(page).getByText("Work IT has recorded on your ticket.")
    ).toBeVisible();
    await expect(area(page).locator("tbody tr")).toHaveCount(5);
    // Absent, not disabled.
    await expect(
      area(page).getByRole("button", { name: "Add action" })
    ).toHaveCount(0);
    await expect(
      area(page).getByRole("button", {
        name: /^(?:Edit|Complete|Cancel) action/u,
      })
    ).toHaveCount(0);
    // Every field of every Action is visible to them.
    await rowOf(page, "and re-tested.")
      .getByRole("button", { name: /^View action/u })
      .click();
    await expect(area(page).getByText("Recorded by")).toBeVisible();
    await expect(area(page).getByText("Sarah Johnson").first()).toBeVisible();
    await shoot(page, info, "actions-taken", "requester-readonly");

    // Another Requester's ticket is not found, not forbidden (BR-17).
    const stranger = await openAs(guard, browser, info, "somchai");

    await stranger.goto(`/tickets/${ticketId}`);
    await expect(stranger.getByText("Ticket not found")).toBeVisible();
    await expect(stranger.getByText("Actions Taken")).toHaveCount(0);

    await stranger.context().close();
    await admin.context().close();
    await sarah.context().close();
    await michael.context().close();
  });

  test("an Action cannot be added once the ticket no longer takes Actions (not-actionable)", async ({
    browser,
    guard,
    page,
  }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id: ticketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Not Actionable", info)
    );

    const michael = await openAs(guard, browser, info, "michael");

    await michael.goto(`/tickets/${ticketId}`);
    await area(michael).getByRole("button", { name: "Add action" }).click();

    const form = formOf(michael, "Add action");

    await field(form, /^Description/u).fill(
      "Looked at the printer after the ticket was withdrawn."
    );

    // The ticket is cancelled by someone else while the form is open.
    const current = await michael.request.get(`${API}/api/tickets/${ticketId}`);
    const { version } = (await current.json()) as { version: number };
    const cancelled = await michael.request.patch(
      `${API}/api/staff/tickets/${ticketId}/status`,
      { data: { status: "CANCELLED", version } }
    );

    expect(cancelled.ok()).toBe(true);

    await form.getByRole("button", { name: "Save" }).click();
    await expect(area(michael).getByText(NOT_ACTIONABLE)).toBeVisible();
    // The form that could only fail is gone, and so is the control to open it.
    await expect(form).toHaveCount(0);
    await expect(
      area(michael).getByRole("button", { name: "Add action" })
    ).toHaveCount(0);
    await expect(
      michael.getByText("Cancelled", { exact: true }).first()
    ).toBeVisible();
    await shoot(michael, info, "actions-taken", "not-actionable");

    await michael.context().close();
  });

  test("double-clicking Save creates exactly one Action (E2E-14, AC-46)", async ({
    browser,
    guard,
    page,
  }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id: ticketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Double Click", info)
    );

    const michael = await openAs(guard, browser, info, "michael");
    const description = "Double-clicked once, recorded once.";
    let posts = 0;

    // The server's answer is held back, so the second click lands while the
    // first request is still in flight: the case the contract is about.
    await michael.route("**/api/tickets/*/actions", async (route) => {
      if (route.request().method() === "POST") {
        posts += 1;
        await pause(800);
      }

      await route.continue();
    });

    await michael.goto(`/tickets/${ticketId}`);
    await area(michael).getByRole("button", { name: "Add action" }).click();

    const form = formOf(michael, "Add action");

    await field(form, /^Description/u).fill(description);
    await form.getByRole("button", { name: "Save" }).dblclick();
    await expect(form).toHaveCount(0);
    await expect(rowOf(michael, description)).toHaveCount(1);

    expect(posts, "POST requests sent").toBe(1);

    const stored = await michael.request.get(
      `${API}/api/tickets/${ticketId}/actions`
    );
    const body = (await stored.json()) as { data: unknown[] };

    expect(body.data).toHaveLength(1);

    await michael.context().close();
  });
});
