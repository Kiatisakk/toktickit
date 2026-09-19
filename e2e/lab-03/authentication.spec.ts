import { expect, test } from "@playwright/test";

import {
  accountByEmail,
  ACTIVE_REQUESTER,
  INACTIVE_REQUESTER,
  MUST_CHANGE_REQUESTER,
} from "../../server/prisma/accounts";
import { pageAs } from "./sessions";
import {
  createTicketFor,
  freshPage,
  lab3Summary,
  referenceIds,
  shoot,
} from "./support";

const API = "http://localhost:3000";

/**
 * Never given a ticket anywhere in this suite (`e2e/lab-02/support.ts`'s own
 * comment on her says so). The busy and signed-in-shell states land on
 * My Tickets once the sign-in succeeds, and My Tickets shows real ticket
 * rows — real ticket numbers and real created/updated timestamps — for
 * anyone who has one. Signing in as her instead of Requester A is what makes
 * those two screenshots reproduce byte-for-byte on a rerun.
 */
const EMPTY_REQUESTER = accountByEmail("pimchanok.srisai@example.ac.th");

/**
 * The authentication journey, in a real browser (Lab 3 §14 — the six states
 * signing in must show, the mandatory password change, sign-out blocking
 * direct access, and the cross-requester refusal already proven in the
 * browser by `e2e/lab-02/requester-ticket-flow.spec.ts`, restated here because
 * §14 asks for it under this journey's name).
 *
 * Every test opens its own cookie-less context (`freshPage`) rather than the
 * viewport project's shared, already-signed-in `page` fixture: this journey is
 * about what happens before a session exists and, in one case, about deleting
 * one — neither is safe to do with the session every other spec in this
 * project reuses.
 */

/** Worded exactly as ui-spec.md §3 and the server give it. */
const REFUSED_CREDENTIALS = "Invalid email or password. Please try again.";
const REFUSED_INACTIVE =
  "This account has been deactivated. Contact an administrator.";

test.describe("signing in (E2E-01, E2E-04)", () => {
  test("every state the sign-in screen shows", async ({ browser }, info) => {
    // Six sub-journeys, each its own context: comfortably over the default
    // 30s budget on a headed Edge.
    test.setTimeout(60_000);

    const page = await freshPage(browser, info);

    // --- initial ------------------------------------------------------------
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to TokTickIT" })
    ).toBeVisible();
    await shoot(page, info, "authentication", "initial");

    // --- validation-failure ---------------------------------------------------
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await shoot(page, info, "authentication", "validation-failure");

    // --- invalid-credentials --------------------------------------------------
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ACTIVE_REQUESTER.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("wrong-password-entirely");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(REFUSED_CREDENTIALS)).toBeVisible();
    // BR-08: what was typed survives the refusal, the password included.
    await expect(
      page.getByRole("textbox", { name: "Email", exact: true })
    ).toHaveValue(ACTIVE_REQUESTER.email);
    await shoot(page, info, "authentication", "invalid-credentials");

    // --- busy, and (once it succeeds) signed-in-shell -------------------------
    // Requester A's email is filled in from the invalid-credentials case
    // above; swapped here for an account whose My Tickets is always empty,
    // so the screen this leads to shows no ticket rows to vary between runs.
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(EMPTY_REQUESTER.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(EMPTY_REQUESTER.password);

    await page.route("**/api/auth/login", async (route) => {
      const response = await route.fetch();

      await expect(
        page.getByRole("button", { name: "Signing in…" })
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true })
      ).toHaveAttribute("readonly", "");
      await shoot(page, info, "authentication", "busy");

      await route.fulfill({ response });
    });

    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/my-tickets$/u);

    // --- inactive-account -----------------------------------------------------
    // A fresh context: the one above is now signed in as Requester A, and
    // asking it to sign in again would not exercise a clean sign-in screen.
    const inactivePage = await freshPage(browser, info);

    await inactivePage.goto("/login");
    await inactivePage
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(INACTIVE_REQUESTER.email);
    await inactivePage
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(INACTIVE_REQUESTER.password);
    await inactivePage.getByRole("button", { name: "Sign In" }).click();
    await expect(inactivePage.getByText(REFUSED_INACTIVE)).toBeVisible();
    await shoot(inactivePage, info, "authentication", "inactive-account");
    await inactivePage.context().close();

    // --- api-failure --------------------------------------------------------
    const failurePage = await freshPage(browser, info);

    await failurePage.goto("/login");
    await failurePage
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ACTIVE_REQUESTER.email);
    await failurePage
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(ACTIVE_REQUESTER.password);

    await failurePage.route("**/api/auth/login", async (route) => {
      await route.abort("failed");
    });

    await failurePage.getByRole("button", { name: "Sign In" }).click();
    await expect(failurePage.getByText("Cannot reach TokTickIT")).toBeVisible();
    // What was typed is preserved through a failure to reach the API (§8.3).
    await expect(
      failurePage.getByRole("textbox", { name: "Email", exact: true })
    ).toHaveValue(ACTIVE_REQUESTER.email);
    await shoot(failurePage, info, "authentication", "api-failure");
    await failurePage.context().close();

    // --- signed-in-shell ------------------------------------------------------
    // Back on the page that actually completed a sign-in above.
    await expect(page.getByText(EMPTY_REQUESTER.name)).toBeVisible();
    await expect(page.getByText("No tickets yet")).toBeVisible();
    await shoot(page, info, "authentication", "signed-in-shell");

    // --- after-logout, and E2E-03: sign-out blocks direct access -------------
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/u);
    await shoot(page, info, "authentication", "after-logout");

    // A protected URL, typed in directly, after the session that would have
    // admitted it no longer exists.
    await page.goto("/my-tickets");
    await expect(page).toHaveURL(/\/login$/u);

    await page.context().close();
  });
});

test.describe("the mandatory password change (E2E-02)", () => {
  /**
   * A fixed password rather than a per-run one: `toktickit_test` is fully
   * rebuilt by `db:test:setup` before every `npm run test:e2e`, so nothing
   * from a previous invocation survives to collide with it — and inside one
   * invocation, an Administrator resets it again at the top of this test on
   * every viewport project, which is what keeps three replays against one
   * un-reset-between-projects database from finding the flag already
   * consumed by an earlier project's run.
   */
  const RESET_STARTING_PASSWORD = "ResetForE2E-1!";
  const CHOSEN_PASSWORD = "ChosenForE2E-1!";

  test("a starting password forces a change before anything else opens", async ({
    browser,
  }, info) => {
    test.setTimeout(45_000);

    // --- set up: force the flag back on, as an Administrator would -----------
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
      admin.getByText(
        `A new starting password was set. ${MUST_CHANGE_REQUESTER.name} has been signed out`
      )
    ).toBeVisible();
    await admin.context().close();

    // --- sign in with it, through the real screen -----------------------------
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
    await shoot(page, info, "authentication", "change-password-initial");

    // Cannot navigate away by URL while the flag is set (ui-spec.md §4).
    await page.goto("/my-tickets");
    await expect(page).toHaveURL(/\/change-password$/u);

    // --- rules-unmet: partway through typing a new password -------------------
    // By role and exact accessible name, the same route Login's own fields
    // take (auth.setup.ts) — `getByLabel` on `PasswordInput` was observed to
    // hang indefinitely here rather than resolve or time out normally.
    await page
      .getByRole("textbox", { name: "Current password", exact: true })
      .fill(RESET_STARTING_PASSWORD);
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill("abc");
    await shoot(page, info, "authentication", "change-password-rules-unmet");

    // --- complete it ----------------------------------------------------------
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill(CHOSEN_PASSWORD);
    await page
      .getByRole("textbox", { name: "Confirm new password", exact: true })
      .fill(CHOSEN_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/my-tickets$/u);
    await expect(page.getByText(MUST_CHANGE_REQUESTER.name)).toBeVisible();
    await shoot(page, info, "authentication", "change-password-success");

    await page.context().close();
  });
});

test.describe("cross-requester refusal in the browser (E2E-09)", () => {
  test("Requester B cannot open Requester A's ticket by URL", async ({
    browser,
  }, info) => {
    // Requester A, freshly signed in — not the shared session, so this test
    // stands on its own regardless of what other specs have done with it.
    const asA = await pageAs(browser, info, "jennifer");

    // A ticket of Requester A's own, created here rather than assumed to
    // exist: this file can run on its own, ahead of every spec that would
    // otherwise have given her one first.
    const refs = await referenceIds(asA.request, API);

    await createTicketFor(
      asA.request,
      API,
      refs,
      lab3Summary("Cross-Requester Refusal", info)
    );

    await asA.goto("/my-tickets");
    await expect(asA).toHaveURL(/\/my-tickets$/u);

    const link = asA.getByRole("link", { name: /^TKT-\d{4}-\d{6}$/u }).first();

    await expect(link).toBeVisible();

    const href = await link.getAttribute("href");

    const asB = await pageAs(browser, info, "somchai");

    await asB.goto(href ?? "/my-tickets");
    await expect(asB.getByText("Ticket not found")).toBeVisible();
    await expect(
      asB.getByText(
        "This ticket does not exist, or it belongs to another requester."
      )
    ).toBeVisible();

    await asA.context().close();
    await asB.context().close();
  });
});
