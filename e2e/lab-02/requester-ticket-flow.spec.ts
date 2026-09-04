import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalScroll,
  firstTicketLink,
  shoot,
  signInAs,
} from "./support";

/**
 * The whole Requester journey, in a real browser (§14 Part 6, 7 and 8).
 *
 * One test rather than eight, because the journey *is* the assertion: a Ticket
 * created in step three has to be the one found in step five and opened in step
 * six. Split into independent cases, each would need its own fixture and the
 * thing being proved — that the parts join up — would be the thing not tested.
 *
 * It also produces most of the Part 6–8 evidence on the way through, which is
 * why the screenshots are taken inline rather than in a separate pass: a
 * screenshot taken by a second run is a picture of a different ticket.
 */

const REQUESTER_A = "Jennifer Anderson";
const REQUESTER_B = "Somchai Wattana";

/** Unique per run, so the same journey can be re-run without colliding. */
const summaryFor = () => `E2E journey ${Date.now()}`;

test.describe("the complete Requester journey", () => {
  test("create, find, open, attach, download, remove", async ({
    page,
  }, info) => {
    const summary = summaryFor();

    // --- select a Requester -------------------------------------------------
    await signInAs(page, REQUESTER_A);
    await expect(page.getByText(REQUESTER_A)).toBeVisible();

    // --- create a Ticket ----------------------------------------------------
    await page.goto("/tickets/new");
    await shoot(page, "create-ticket", `${info.project.name}-initial`);

    // Submitting empty first: §14 Part 6 asks for the validation-failure state,
    // and it is only honest to capture it from a real failed submit.
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await expect(page.getByText(/must be|required/iu).first()).toBeVisible();
    await shoot(
      page,
      "create-ticket",
      `${info.project.name}-validation-failure`
    );

    // Issue #40 / D-17: an oversized file is rejected client-side, on the
    // row, before anything is sent — the state `ui-spec.md` §10 commits to a
    // screenshot for and that nothing on the screen could produce until this
    // picker existed.
    await page.getByLabel(/Add Attachment/u).setInputFiles({
      name: "too-big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(page.getByText(/larger than 5 MB/u)).toBeVisible();
    await shoot(
      page,
      "create-ticket",
      `${info.project.name}-invalid-attachment`
    );
    await page.getByRole("button", { name: "Dismiss" }).click();

    // Reference data comes from the database, not from a constant.
    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByLabel("Related System").selectOption({ index: 1 });
    await page.getByLabel(/Requested Priority/u).selectOption("HIGH");
    await page.getByLabel(/^Summary/u).fill(summary);
    await page
      .getByLabel(/^Description/u)
      .fill("Raised by the end-to-end suite to prove the journey joins up.");

    await page.getByRole("button", { name: "Create Ticket" }).click();

    // --- the backend-generated Ticket Number --------------------------------
    const number = page.getByText(/TKT-\d{4}-\d{6}/u).first();

    await expect(number).toBeVisible();
    await shoot(page, "create-ticket", `${info.project.name}-success`);

    const rendered = await number.textContent();
    const ticketNumber = rendered?.trim() ?? "";

    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/u);

    // --- find it in My Tickets ----------------------------------------------
    await page.goto("/my-tickets");
    await page.getByLabel("Search").fill(ticketNumber);

    // The table's cell and the card's paragraph both carry the summary, and
    // below 768px the table is hidden rather than unmounted — so the
    // assertion is on whichever presentation is actually showing.
    await expect(
      page.getByText(summary).locator("visible=true").first()
    ).toBeVisible();
    await shoot(page, "my-tickets", `${info.project.name}-search`);

    // --- open its detail ----------------------------------------------------
    await page.getByRole("link", { name: ticketNumber }).first().click();
    await expect(page.getByLabel("Ticket No.")).toHaveValue(ticketNumber);
    await shoot(page, "ticket-detail", `${info.project.name}-initial`);

    const detailUrl = page.url();

    // --- add an attachment --------------------------------------------------
    await page.getByLabel(/Add Attachment/u).setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nend-to-end evidence\n%%EOF\n"),
    });

    // Scoped to the list. `getByText("evidence.pdf")` alone also matches the
    // filename inside the removal dialog below, and an ambiguous locator fails
    // as a strict-mode violation at whichever moment both happen to exist.
    const attachmentRow = page.locator(".tkt-attachment").first();

    await expect(attachmentRow.getByText("evidence.pdf")).toBeVisible();
    await shoot(page, "ticket-detail", `${info.project.name}-with-attachment`);

    // --- download it --------------------------------------------------------
    const download = page.waitForEvent("download");

    await page.getByRole("button", { name: "Download" }).click();

    const file = await download;

    expect(file.suggestedFilename()).toBe("evidence.pdf");

    // --- remove it, with a reason -------------------------------------------
    await page.getByRole("button", { name: "Remove" }).click();
    await page
      .getByLabel(/Reason for removing/u)
      .fill("Attached the wrong file during the end-to-end run.");
    await page.getByRole("button", { name: "Remove Attachment" }).click();

    // Wait for the dialog to go before reading the row, so the assertion is
    // about the settled state rather than about a moment during the transition.
    await expect(
      page.getByRole("group", { name: "Confirm removal" })
    ).toHaveCount(0);

    // BR-26: the metadata survives, the Download does not.
    await expect(attachmentRow.getByText("evidence.pdf")).toBeVisible();
    await expect(
      attachmentRow.getByText(
        /Attached the wrong file during the end-to-end run\./u
      )
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0);
    await shoot(
      page,
      "ticket-detail",
      `${info.project.name}-removed-attachment`
    );

    // --- and the file is really gone, not merely hidden ---------------------
    // BR-28. Hiding the button proves nothing; the URL has to refuse.
    const attachmentId = await page.evaluate(async () => {
      const id = Number(globalThis.location.pathname.split("/").pop());
      const response = await fetch(
        `http://localhost:3000/api/tickets/${id}/attachments`,
        { headers: { "X-Development-Requester-Id": "1" } }
      );
      const body = (await response.json()) as { data: { id: number }[] };

      return body.data[0]?.id ?? 0;
    });

    const direct = await page.request.get(
      `http://localhost:3000/api/attachments/${attachmentId}/download`,
      { headers: { "X-Development-Requester-Id": "1" } }
    );

    expect(direct.status()).toBe(404);

    // Keep the URL for the ownership case below.
    expect(detailUrl).toContain("/tickets/");
  });
});

test.describe("requester isolation", () => {
  /** §14 Part 7: switch from A to B and A's tickets are gone. */
  test("switching Requester empties the previous list", async ({
    page,
  }, info) => {
    await signInAs(page, REQUESTER_A);

    await expect(firstTicketLink(page)).toBeVisible();
    await shoot(page, "my-tickets", `${info.project.name}-requester-a`);

    const aNumbers = await page
      .getByRole("link", { name: /^TKT-\d{4}-\d{6}$/u })
      .allTextContents();

    expect(aNumbers.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Change Requester" }).click();
    await signInAs(page, REQUESTER_B);
    await shoot(page, "my-tickets", `${info.project.name}-requester-b`);

    const bNumbers = await page
      .getByRole("link", { name: /^TKT-\d{4}-\d{6}$/u })
      .allTextContents();

    // Not "the list changed" — no ticket number of A's may appear at all.
    for (const number of bNumbers) {
      expect(aNumbers).not.toContain(number);
    }
  });

  /**
   * §14 Part 8: a Ticket URL belonging to someone else, typed in directly.
   *
   * This is the case the whole ownership design exists for, and the only one
   * that cannot be demonstrated by clicking — every link on screen already
   * points somewhere allowed.
   */
  test("another Requester's ticket URL is refused", async ({ page }, info) => {
    await signInAs(page, REQUESTER_A);

    const link = firstTicketLink(page);

    await expect(link).toBeVisible();

    const href = await link.getAttribute("href");

    await page.getByRole("button", { name: "Change Requester" }).click();
    await signInAs(page, REQUESTER_B);

    await page.goto(href ?? "/my-tickets");

    await expect(page.getByText("Ticket not found")).toBeVisible();
    await expect(
      page.getByText(
        "This ticket does not exist, or it belongs to another requester."
      )
    ).toBeVisible();

    // Part 8 asks for evidence that direct access to another Requester's ticket
    // is refused, and an assertion in a test file is not something a reader of
    // the report can see. `ui-spec.md` §10 has named this file all along; it
    // had never been written, because nothing captured it.
    await shoot(page, "ticket-detail", `${info.project.name}-unauthorized`);
  });
});

test.describe("the states Part 6 and Part 7 ask for", () => {
  test("My Tickets has an empty state and a no-results state", async ({
    page,
  }, info) => {
    // Pimchanok is seeded with no tickets precisely so this state is reachable.
    await signInAs(page, "Pimchanok Srisai");

    await expect(page.getByText("No tickets yet")).toBeVisible();
    await shoot(page, "my-tickets", `${info.project.name}-empty`);

    // No-results is a different state, and telling them apart is BR-35.
    await page.getByRole("button", { name: "Change Requester" }).click();
    await signInAs(page, REQUESTER_A);
    await page.getByLabel("Search").fill("nothing will match this string");

    await expect(page.getByText("No tickets match your filters")).toBeVisible();
    await shoot(page, "my-tickets", `${info.project.name}-no-results`);
  });

  /**
   * §14 Part 6 item 5: the API fails and nothing typed is lost.
   *
   * The request is failed at the browser rather than by stopping the server, so
   * the case is reproducible without touching Docker mid-suite.
   */
  test("a failed submission keeps everything the person typed", async ({
    page,
  }, info) => {
    await signInAs(page, REQUESTER_A);
    await page.goto("/tickets/new");

    const summary = summaryFor();

    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByLabel("Related System").selectOption({ index: 1 });
    await page.getByLabel(/^Summary/u).fill(summary);
    await page
      .getByLabel(/^Description/u)
      .fill("This submission is about to fail, and this text must survive it.");

    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("failed");
        return;
      }

      await route.continue();
    });

    await page.getByRole("button", { name: "Create Ticket" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await shoot(page, "create-ticket", `${info.project.name}-api-failure`);

    // The point of the state: the form is still filled in.
    await expect(page.getByLabel(/^Summary/u)).toHaveValue(summary);
    await expect(page.getByLabel(/^Description/u)).toHaveValue(
      "This submission is about to fail, and this text must survive it."
    );
  });
});

test.describe("no horizontal scrolling at any viewport", () => {
  test("across all three screens", async ({ page }) => {
    await signInAs(page, REQUESTER_A);
    await expectNoHorizontalScroll(page, "My Tickets");

    await page.goto("/tickets/new");
    await expectNoHorizontalScroll(page, "Create Ticket");

    await page.goto("/my-tickets");

    const link = firstTicketLink(page);

    await expect(link).toBeVisible();
    await link.click();
    await expectNoHorizontalScroll(page, "Ticket Detail");
  });
});
