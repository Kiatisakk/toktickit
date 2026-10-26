import { accountByEmail, ADMINISTRATOR } from "../../server/prisma/accounts";
import { pageAs } from "../lab-03/sessions";
import {
  createTicketFor,
  freshPage,
  referenceIds,
  resetE2eData,
  visibleText,
} from "../lab-03/support";
import { API, expect, lab4Summary, openAs, test, urlEnding } from "./support";

/**
 * The Labs 1 to 3 journeys, once more, on the Lab 4 build (E2E-12, AC-45).
 *
 * Each earlier lab has its own browser suite that already runs in the same
 * invocation; this one is the sprint's own statement that the earlier product
 * still works as a whole: sign-in and the forced first password change,
 * creating a Ticket with attachments and comments, Internal Notes, the staff
 * queue and ownership, and Administrator user management. It runs under the
 * same console guard as every Lab 4 spec, so a regression that only shows as a
 * console error or an unexpected 4xx fails here too.
 *
 * No screenshots: the Lab 2 and Lab 3 screenshots are submitted evidence and
 * their own specs own them.
 */

const NEW_HIRE_PASSWORD = "RegressionHire1!";
const NEW_HIRE_CHOSEN = "ChosenByRegression1!";
const EDITABLE_STAFF = accountByEmail("david.lee@example.ac.th");
const EMPTY_REQUESTER = accountByEmail("pimchanok.srisai@example.ac.th");
const WRONG_PASSWORD = "wrong-password-entirely";

const newHireEmail = (viewport: string) =>
  `e2e.newhire.regression-${viewport}@example.ac.th`;

test.describe("sign-in and the first password change (E2E-12)", () => {
  test.beforeAll(() => {
    // The account this spec creates is removed with the Lab 3 one, by the same
    // script (it matches on `e2e.newhire.`).
    resetE2eData("e2e:reset-users");
  });

  test("a wrong password is refused, the right one lands on the dashboard, and a new account must change its password first", async ({
    browser,
    guard,
  }, info) => {
    test.setTimeout(90_000);

    // --- sign-in -------------------------------------------------------------
    const visitor = await freshPage(browser, info);

    guard.attach(visitor);
    guard.expectRefusal("POST", urlEnding("/api/auth/login"), 401);
    guard.expectRefusal("GET", urlEnding("/api/auth/me"), 401, true);

    await visitor.goto("/login");
    await visitor
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(EMPTY_REQUESTER.email);
    await visitor
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(WRONG_PASSWORD);
    await visitor.getByRole("button", { name: "Sign In" }).click();
    await expect(
      visitor.getByText("Invalid email or password. Please try again.")
    ).toBeVisible();

    await visitor
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(EMPTY_REQUESTER.password);
    await visitor.getByRole("button", { name: "Sign In" }).click();
    await expect(visitor).toHaveURL(/\/dashboard$/u);
    await expect(
      visitor.getByText(EMPTY_REQUESTER.name, { exact: true })
    ).toBeVisible();

    // A protected URL still works for a signed-in person, and the signed-out
    // one is turned away (the second half is checked after the logout below).
    await visitor.goto("/my-tickets");
    await expect(visitor).toHaveURL(/\/my-tickets$/u);

    // Pimchanok's own session, created here, not the one other specs reuse.
    await visitor.getByRole("button", { name: "Logout" }).click();
    await expect(visitor).toHaveURL(/\/login$/u);
    await visitor.goto("/my-tickets");
    await expect(visitor).toHaveURL(/\/login$/u);
    await visitor.context().close();

    // --- a new account, created by the Administrator -------------------------
    const email = newHireEmail(info.project.name);
    const admin = await openAs(guard, browser, info, "wanida");
    const panel = admin.locator(".tkt-user-panel");

    await admin.goto("/admin/users");
    await admin.getByRole("button", { name: "Create User" }).click();
    await panel
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Regression Hire");
    await panel
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(email);
    await panel
      .getByRole("textbox", { name: "Initial password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await panel.getByRole("button", { name: "Create User" }).click();
    await expect(
      admin.getByRole("heading", { name: "Create User" })
    ).toHaveCount(0);
    await expect(visibleText(admin, email)).toBeVisible();
    await admin.context().close();

    // --- the forced change ---------------------------------------------------
    const hire = await freshPage(browser, info);

    guard.attach(hire);
    guard.expectRefusal("GET", urlEnding("/api/auth/me"), 401, true);

    await hire.goto("/login");
    await hire.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await hire
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await hire.getByRole("button", { name: "Sign In" }).click();
    await expect(hire).toHaveURL(/\/change-password$/u);

    // Nothing else opens while the change is outstanding.
    await hire.goto("/my-tickets");
    await expect(hire).toHaveURL(/\/change-password$/u);

    await hire
      .getByRole("textbox", { name: "Current password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await hire
      .getByRole("textbox", { name: "New password", exact: true })
      .fill(NEW_HIRE_CHOSEN);
    await hire
      .getByRole("textbox", { name: "Confirm new password", exact: true })
      .fill(NEW_HIRE_CHOSEN);
    await hire.getByRole("button", { name: "Continue" }).click();
    await expect(hire).toHaveURL(/\/dashboard$/u);
    await expect(
      hire.getByText("Regression Hire", { exact: true })
    ).toBeVisible();
    await hire.context().close();
  });
});

test.describe("a Requester's Ticket from creation to conversation (E2E-12)", () => {
  test("create a Ticket, attach and remove a file, find it, and exchange comments with staff, who also keep an Internal Note the Requester never sees", async ({
    browser,
    guard,
    page,
  }, info) => {
    test.setTimeout(120_000);

    const summary = lab4Summary("Regression Ticket", info);

    // --- Create Ticket, through the screen ------------------------------------
    await page.goto("/tickets/new");
    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByLabel("Related System").selectOption({ index: 1 });
    await page.getByLabel(/Requested Priority/u).selectOption("HIGH");
    await page.getByLabel(/^Summary/u).fill(summary);
    await page
      .getByLabel(/^Description/u)
      .fill("Raised by the Lab 4 regression journey.");
    await page.getByRole("button", { name: "Create Ticket" }).click();

    const number = page.getByText(/TKT-\d{4}-\d{6}/u).first();

    await expect(number).toBeVisible();

    const ticketNumber = ((await number.textContent()) ?? "").trim();

    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/u);

    // --- My Tickets, search, detail -------------------------------------------
    await page.goto("/my-tickets");
    await page.getByLabel("Search").fill(ticketNumber);
    await expect(
      page.getByText(summary).locator("visible=true").first()
    ).toBeVisible();
    await page.getByRole("link", { name: ticketNumber }).first().click();
    await expect(page.getByLabel("Ticket No.")).toHaveValue(ticketNumber);

    const detailUrl = page.url();
    const ticketId = Number(detailUrl.split("/").pop());

    // --- attachments: add, download, remove with a reason ----------------------
    await page.getByLabel(/Add Attachment/u).setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nLab 4 regression evidence\n%%EOF\n"),
    });

    const attachmentRow = page.locator(".tkt-attachment").first();

    await expect(attachmentRow.getByText("evidence.pdf")).toBeVisible();

    const download = page.waitForEvent("download");

    await page.getByRole("button", { name: "Download" }).click();

    const file = await download;

    expect(file.suggestedFilename()).toBe("evidence.pdf");

    await page.getByRole("button", { name: "Remove" }).click();
    await page
      .getByLabel(/Reason for removing/u)
      .fill("Removed by the regression journey.");
    await page.getByRole("button", { name: "Remove Attachment" }).click();
    await expect(
      page.getByRole("group", { name: "Confirm removal" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0);

    // --- staff: find it, claim it, work it, comment and note --------------------
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/staff/tickets");
    await staff.getByLabel("Search").fill(ticketNumber);
    await staff.getByRole("link", { name: ticketNumber }).click();
    await expect(staff.getByLabel("Ticket No.")).toHaveValue(ticketNumber);

    await staff.getByRole("button", { name: "Claim" }).click();
    await expect(staff.getByRole("button", { name: "Release" })).toBeVisible();
    await staff.getByLabel("IT Priority").selectOption("LOW");
    await expect(staff.getByLabel("IT Priority")).toHaveValue("LOW");
    await staff.getByLabel("Current Status").selectOption("OPEN");
    await expect(staff.getByText("Now Open.")).toBeVisible();

    const staffComment = "Looking into this now.";
    const staffNote = "Suspect a driver issue on the requester's machine.";

    await staff.getByLabel("Add a comment").fill(staffComment);
    await staff.getByRole("button", { name: "Post Comment" }).click();
    await expect(staff.getByText(staffComment)).toBeVisible();
    await staff.getByLabel("Add a note").fill(staffNote);
    await staff.getByRole("button", { name: "Post Note" }).click();
    await expect(staff.getByText(staffNote)).toBeVisible();

    // --- the Requester sees the comment, never the note ------------------------
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByText(staffComment)).toBeVisible();
    await expect(page.getByText(staffNote)).toHaveCount(0);
    await expect(page.getByText("Internal Notes")).toHaveCount(0);

    const reply = "Thanks, let me know what you find.";

    await page.getByLabel("Add a comment").fill(reply);
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(page.getByText(reply)).toBeVisible();

    await staff.context().close();
  });

  test("another Requester cannot open the Ticket by its address", async ({
    browser,
    guard,
    page,
  }, info) => {
    const refs = await referenceIds(page.request, API);
    const { id } = await createTicketFor(
      page.request,
      API,
      refs,
      lab4Summary("Regression Isolation", info)
    );

    const other = await openAs(guard, browser, info, "somchai");

    guard.expectRefusal("GET", urlEnding(`/api/tickets/${id}`), 404);

    await other.goto(`/tickets/${id}`);
    await expect(other.getByText("Ticket not found")).toBeVisible();
    await other.context().close();
  });
});

test.describe("staff queue and ownership (E2E-12)", () => {
  test("the queue lists a new Ticket, can be filtered, and ownership can be claimed and released", async ({
    browser,
    guard,
    page,
  }, info) => {
    test.setTimeout(90_000);

    const refs = await referenceIds(page.request, API);
    const summary = lab4Summary("Regression Queue", info);
    const { ticketNumber } = await createTicketFor(
      page.request,
      API,
      refs,
      summary,
      "HIGH"
    );

    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/staff/tickets");
    await staff.getByLabel("Search").fill(ticketNumber);
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();

    await staff.getByLabel("Requested Priority").selectOption("HIGH");
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();
    await staff.getByLabel("Requested Priority").selectOption("LOW");
    await expect(
      staff.getByText("No tickets match these filters")
    ).toBeVisible();
    await staff.getByLabel("Requested Priority").selectOption("");

    await staff.getByLabel("Owner").selectOption("unassigned");
    await expect(staff.getByRole("link", { name: ticketNumber })).toBeVisible();
    await staff.getByLabel("Owner").selectOption("");

    await staff.getByRole("link", { name: ticketNumber }).click();
    await staff.getByRole("button", { name: "Claim" }).click();
    await expect(staff.getByRole("button", { name: "Release" })).toBeVisible();
    await staff.getByRole("button", { name: "Release" }).click();
    await expect(staff.getByRole("button", { name: "Claim" })).toBeVisible();
    await expect(staff.getByText("Unassigned")).toBeVisible();

    await staff.context().close();
  });
});

test.describe("Administrator user management (E2E-12)", () => {
  test("the list searches and filters, and the last Administrator cannot be deactivated or demoted", async ({
    browser,
    guard,
  }, info) => {
    test.setTimeout(60_000);

    const admin = await openAs(guard, browser, info, "wanida");
    const panel = admin.locator(".tkt-user-panel");

    await admin.goto("/admin/users");
    await expect(visibleText(admin, ADMINISTRATOR.email)).toBeVisible();

    await admin.getByLabel("Search").fill("jennifer");
    await expect(visibleText(admin, "Jennifer Anderson")).toBeVisible();
    await admin.getByLabel("Search").fill("");

    await admin.getByLabel("Role").selectOption("IT_STAFF");
    await expect(visibleText(admin, EDITABLE_STAFF.name)).toBeVisible();
    await expect(
      admin.locator(".tkt-list").getByText(ADMINISTRATOR.name)
    ).toHaveCount(0);
    await admin.getByLabel("Role").selectOption("");

    guard.expectRefusal("PATCH", /\/api\/admin\/users\/\d+$/u, 409);

    await admin
      .getByRole("button", { name: `Edit ${ADMINISTRATOR.name}` })
      .click();
    await panel.locator(".tkt-switch").uncheck();
    await panel.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      panel.getByText(
        "You cannot deactivate your own account. Another Administrator has to do it."
      )
    ).toBeVisible();
    await expect(panel.locator(".tkt-switch")).toBeChecked();
    await panel.getByRole("button", { name: "Cancel" }).click();

    // A Requester has neither the destination nor the route.
    const requester = await pageAs(browser, info, "pimchanok");

    guard.attach(requester);
    await expect(
      requester.getByRole("link", { name: "User Management" })
    ).toHaveCount(0);
    await requester.goto("/admin/users");
    await expect(requester).toHaveURL(/\/dashboard$/u);

    await requester.context().close();
    await admin.context().close();
  });
});
