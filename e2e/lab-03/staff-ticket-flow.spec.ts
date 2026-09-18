import { expect, test } from "@playwright/test";

import { pageAs } from "./sessions";
import {
  createTicketFor,
  lab3Summary,
  referenceIds,
  resetE2eData,
  shoot,
} from "./support";

/**
 * The staff journey and the Requester/staff conversation it produces, in a
 * real browser (Lab 3 §14 — E2E-05, E2E-08, E2E-10).
 *
 * One long test rather than several short ones, for the same reason
 * `e2e/lab-02/requester-ticket-flow.spec.ts` gives: the journey *is* the
 * assertion. A ticket Requester A raises has to be the one Staff find in the
 * queue, claim, triage and answer, and the Requester's own later view has to
 * show what Staff wrote — splitting that into independent tests would need
 * each to rebuild the very hand-off that is the thing being proved.
 *
 * `page` (the viewport project's default fixture) is Requester A throughout;
 * `pageAs(browser, info, "michael")` opens a second, independent browser
 * context as IT Staff. Neither ever calls Logout, so neither saved session is
 * disturbed for the specs that run after this one.
 */

const API = "http://localhost:3000";

test.describe("the Ticket Queue's empty state (ui-spec.md §5)", () => {
  test.beforeAll(() => {
    // Lab 2's specs run first in file order and always leave a ticket behind
    // by the time this file starts; nothing before this project's run of this
    // file has ever produced a queue with zero tickets in it. See
    // `server/prisma/reset-tickets-e2e.ts`.
    resetE2eData("e2e:reset-tickets");
  });

  test("nobody has raised a ticket yet", async ({ browser }, info) => {
    const staff = await pageAs(browser, info, "michael");

    await staff.goto("/staff/tickets");
    await expect(staff.getByText("No tickets yet")).toBeVisible();
    await expect(
      staff.getByText(
        "Nobody has raised a ticket yet. New requests will appear here."
      )
    ).toBeVisible();
    await shoot(staff, info, "staff-queue", "empty");

    await staff.context().close();
  });
});

test.describe("the staff journey and the conversation it produces", () => {
  test("find, claim, triage, converse, and the Requester sees it all", async ({
    browser,
    page,
  }, info) => {
    // The whole staff journey plus both halves of the conversation and the
    // resolved indication, in one test: comfortably over the default 30s
    // budget on a headed Edge.
    test.setTimeout(90_000);

    const refs = await referenceIds(page.request, API);

    // --- Requester A raises the ticket Staff will work ------------------------
    const summary = lab3Summary("Staff Journey", info);
    const { id: ticketId, ticketNumber } = await createTicketFor(
      page.request,
      API,
      refs,
      summary,
      "HIGH"
    );

    // Requester A attaches a file to it, so Staff's read-only view of the same
    // section has something in it to show (AttachmentSection.tsx: `canModify`
    // is the Requester only, so Staff never gets the add/remove controls here —
    // only the list).
    await page.goto(`/tickets/${ticketId}`);
    await page.getByLabel(/Add Attachment/u).setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nLab 3 staff journey evidence\n%%EOF\n"),
    });
    await expect(
      page.locator(".tkt-attachment").first().getByText("evidence.pdf")
    ).toBeVisible();

    // Enough further tickets that the queue has a second page to point at
    // (server/src/tickets/ticketQuery.ts's default page size is 10).
    await Promise.all(
      Array.from({ length: 11 }, (_unused, n) =>
        createTicketFor(
          page.request,
          API,
          refs,
          lab3Summary(`Queue Filler ${n}`, info)
        )
      )
    );

    // A second ticket, used only to demonstrate the terminal status state —
    // kept apart from the main one so cancelling it never disturbs the
    // journey the rest of this test follows.
    const { id: deadTicketId } = await createTicketFor(
      page.request,
      API,
      refs,
      lab3Summary("Terminal", info)
    );

    const staff = await pageAs(browser, info, "michael");

    // --- the queue: find it -----------------------------------------------
    await staff.goto("/staff/tickets");
    await expect(staff.getByRole("button", { name: "Page 2" })).toBeVisible();
    await shoot(staff, info, "staff-queue", "initial");

    await staff.getByLabel("Search").fill(ticketNumber);
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();
    await shoot(staff, info, "staff-queue", "search");

    // The search stays narrowed to this one ticket through filters, sorting
    // and the Owner filter below: with thirteen unassigned tickets in the
    // queue (this one, its eleven filler siblings and the cancelled one),
    // an unfiltered "Unassigned" list has two pages, and nothing in this
    // section is asking to prove pagination — that is the next state, and it
    // gets the whole unfiltered list on purpose.
    await staff.getByLabel("Requested Priority").selectOption("HIGH");
    await expect(
      staff.getByRole("link", { name: ticketNumber }).first()
    ).toBeVisible();
    await shoot(staff, info, "staff-queue", "filters");
    await staff.getByLabel("Requested Priority").selectOption("");

    // Clearing the filter re-fetches, and the list skeleton that shows while
    // it does presents neither a table header nor the mobile sort control —
    // so the branch below has to be decided only once the reload has
    // actually settled, not the instant the filter changes.
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();

    // Sorting: a header button above 768px, the mobile sort-and-direction
    // pair below it (TicketTable.tsx) — the same branch
    // `e2e/lab-02/evidence.spec.ts` takes for the same reason.
    const sortByTicketNo = staff.getByRole("button", { name: /Ticket No\./u });

    await ((await sortByTicketNo.isVisible())
      ? sortByTicketNo.click()
      : staff.getByLabel(/Sort by/u).selectOption("ticketNumber"));
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();
    await shoot(staff, info, "staff-queue", "sorting");

    await staff.getByLabel("Owner").selectOption("unassigned");
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();
    await shoot(staff, info, "staff-queue", "unassigned-filter");

    await staff.getByLabel("Owner").selectOption("");
    await staff.getByLabel("Search").fill("");
    await staff.getByRole("button", { name: "Page 2" }).click();
    await expect(staff.getByRole("button", { name: "Page 2" })).toBeVisible();
    await shoot(staff, info, "staff-queue", "pagination");

    await staff.getByLabel("Search").fill("nothing will match this string");
    await expect(
      staff.getByText("No tickets match these filters")
    ).toBeVisible();
    await shoot(staff, info, "staff-queue", "no-results");
    await staff.getByLabel("Search").fill("");

    await staff.route("**/api/staff/tickets**", async (route) => {
      await route.abort("failed");
    });
    await staff.reload();
    await expect(
      staff.getByText("Could not load the ticket queue")
    ).toBeVisible();
    await shoot(staff, info, "staff-queue", "failure");
    await staff.unroute("**/api/staff/tickets**");

    // --- open it ------------------------------------------------------------
    await staff.goto("/staff/tickets");
    await staff.getByLabel("Search").fill(ticketNumber);
    await staff.getByRole("link", { name: ticketNumber }).click();
    await expect(staff.getByLabel("Ticket No.")).toHaveValue(ticketNumber);
    await shoot(staff, info, "staff-ticket-detail", "initial");

    // --- claim, racing the request so the busy label is what is captured ----
    await staff.route("**/api/staff/tickets/*/owner", async (route) => {
      const response = await route.fetch();

      await expect(
        staff.getByRole("button", { name: "Claiming…" })
      ).toBeVisible();
      await shoot(staff, info, "staff-ticket-detail", "claim");

      await route.fulfill({ response });
    });
    await staff.getByRole("button", { name: "Claim" }).click();
    await expect(staff.getByRole("button", { name: "Release" })).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "assigned");
    await staff.unroute("**/api/staff/tickets/*/owner");

    // Release, and see it take (AC-18): the owner clears to Unassigned and
    // Claim comes back. Then claim again, because the rest of the journey is
    // work an owner does. Review of PR #66: only asserting Release was visible
    // would let owner-clearing regress unnoticed.
    await staff.getByRole("button", { name: "Release" }).click();
    await expect(staff.getByText("Unassigned")).toBeVisible();
    await staff.getByRole("button", { name: "Claim" }).click();
    await expect(staff.getByRole("button", { name: "Release" })).toBeVisible();

    // --- attachments: read-only from here (canModify is the Requester only) ---
    await expect(
      staff.locator(".tkt-attachment").first().getByText("evidence.pdf")
    ).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "attachments");

    // --- IT Priority ----------------------------------------------------------
    // The ticket was raised HIGH and IT Priority starts as a copy (BR-23), so
    // choosing HIGH here would change nothing. LOW is a real change, and the
    // point of AC-19 is that the Requester's HIGH survives it. Review of PR #66.
    await expect(staff.getByLabel("IT Priority")).toHaveValue("HIGH");
    await staff.getByLabel("IT Priority").selectOption("LOW");
    await expect(staff.getByLabel("IT Priority")).toHaveValue("LOW");
    await staff.reload();
    await expect(staff.getByLabel("IT Priority")).toHaveValue("LOW");
    await expect(
      staff
        .getByText("Requested Priority", { exact: true })
        .locator("xpath=ancestor::*[contains(@class,'tkt-field-group')][1]")
        .getByText("High", { exact: true })
    ).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "it-priority");

    // --- advance status (AC-20) -----------------------------------------------
    await staff.getByLabel("Current Status").selectOption("OPEN");
    await expect(staff.getByText("Now Open.")).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "status-change");

    // --- a terminal status, on the ticket kept apart for it --------------------
    await staff.goto(`/tickets/${deadTicketId}`);
    await staff.getByLabel("Current Status").selectOption("CANCELLED");
    await expect(
      staff.getByText(
        "A cancelled ticket is closed for good and cannot be moved again."
      )
    ).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "invalid-transition");

    // --- back to the main ticket: converse -------------------------------------
    await staff.goto("/staff/tickets");
    await staff.getByLabel("Search").fill(ticketNumber);
    await staff.getByRole("link", { name: ticketNumber }).click();

    const staffComment =
      "Looking into this now — checked the logs, will update shortly.";

    await staff.getByLabel("Add a comment").fill(staffComment);
    await staff.getByRole("button", { name: "Post Comment" }).click();
    await expect(staff.getByText(staffComment)).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "public-comment");

    const staffNote = "Suspect a driver issue on the requester's machine.";

    await staff.getByLabel("Add a note").fill(staffNote);
    await staff.getByRole("button", { name: "Post Note" }).click();
    await expect(staff.getByText(staffNote)).toBeVisible();
    await shoot(staff, info, "staff-ticket-detail", "internal-note");

    // --- Requester A: the other half of the conversation (E2E-08) --------------
    await page.goto(`/tickets/${ticketId}`);

    // The staff Public Comment appears on the Requester's own view.
    await expect(page.getByText(staffComment)).toBeVisible();
    // Internal Notes never render for a Requester at all (AC-25).
    await expect(page.getByText("Internal Notes")).toHaveCount(0);
    await shoot(page, info, "requester-ticket-detail", "no-notes-section");

    // An empty Public Comment is refused before any request is sent.
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(
      page.getByText("Write something before posting.")
    ).toBeVisible();
    await shoot(
      page,
      info,
      "requester-ticket-detail",
      "comment-composer-invalid"
    );

    const requesterComment = "Thanks — let me know if you need anything else.";

    await page.getByLabel("Add a comment").fill(requesterComment);
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(page.getByText(requesterComment)).toBeVisible();
    await shoot(page, info, "requester-ticket-detail", "comments");

    // --- the resolved indication, both sides (E2E-10) --------------------------
    await expect(
      page.getByRole("button", { name: "Problem appears resolved" })
    ).toBeVisible();
    await shoot(
      page,
      info,
      "requester-ticket-detail",
      "resolved-indication-available"
    );

    await page
      .getByRole("button", { name: "Problem appears resolved" })
      .click();
    await page.getByRole("button", { name: "Yes, tell IT" }).click();
    await expect(
      page.getByText(/You told IT the problem appears resolved on/u)
    ).toBeVisible();
    await shoot(
      page,
      info,
      "requester-ticket-detail",
      "resolved-indication-recorded"
    );

    // Staff's own view of the same fact.
    await staff.reload();
    await expect(
      staff.getByText(/The requester told IT the problem appears resolved on/u)
    ).toBeVisible();
    await shoot(
      staff,
      info,
      "staff-ticket-detail",
      "requester-resolved-indication"
    );

    await staff.context().close();
  });
});
