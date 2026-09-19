import { expect, test } from "@playwright/test";

import { accountByEmail, ADMINISTRATOR } from "../../server/prisma/accounts";
import { pageAs } from "./sessions";
import { freshPage, resetE2eData, shoot, visibleText } from "./support";

/**
 * The administration journey, in a real browser (Lab 3 §14 — E2E-06, E2E-07).
 *
 * `pageAs(browser, info, "wanida")` is the seeded Administrator throughout.
 * The safety-rule refusals (E2E-07) are demonstrated on her own account rather
 * than on a second Administrator created for the purpose: api-spec.md §9 says
 * self-demotion is exactly what the last-Administrator check exists to catch,
 * and using her own account is both the more direct proof and the one that
 * never leaves the seed's only Administrator changed, because every refusal
 * is, by definition, a change that did not happen.
 *
 * The "edit" and "new starting password" screenshots are demonstrated on
 * David Lee (`EDITABLE_STAFF`) rather than on `ACTIVE_STAFF` (Michael Brown,
 * `server/prisma/accounts.ts`): Michael is `e2e/lab-03/sessions.ts`'s
 * "michael" session, and every other spec's saved storage state signs in as
 * him — resetting his password here once already broke `auth.setup.ts` for
 * the rest of the suite. David Lee is seeded IT Staff too, and nothing else
 * in this suite signs in as him.
 */
const EDITABLE_STAFF = accountByEmail("david.lee@example.ac.th");

const VIEWPORT_EMAIL = (viewport: string) =>
  `e2e.newhire.${viewport}@example.ac.th`;
const NEW_HIRE_PASSWORD = "NewHireForE2E1!";

test.describe("forbidden for a non-Administrator (part of E2E-07)", () => {
  test("the destination is absent, and the route redirects", async ({
    browser,
  }, info) => {
    // Pimchanok rather than Jennifer: the redirect lands on My Tickets, and
    // Jennifer's is never empty by this point in the run — real ticket
    // numbers and timestamps that would make this screenshot differ on
    // every rerun. Pimchanok is never given a ticket anywhere in this suite.
    const requester = await pageAs(browser, info, "pimchanok");

    await expect(
      requester.getByRole("link", { name: "User Management" })
    ).toHaveCount(0);

    await requester.goto("/admin/users");
    await expect(requester).toHaveURL(/\/my-tickets$/u);
    await expect(requester.getByText("No tickets yet")).toBeVisible();
    await shoot(requester, info, "user-management", "forbidden-for-non-admin");

    await requester.context().close();
  });
});

test.describe("the Administrator screen", () => {
  test.beforeAll(() => {
    // Idempotent across both a rerun of this same project and a second whole
    // invocation of `npm run test:e2e` — see
    // `server/prisma/reset-e2e-users.ts`.
    resetE2eData("e2e:reset-users");
  });

  test("list, search, create, and the safety rules that refuse a change", async ({
    browser,
  }, info) => {
    test.setTimeout(60_000);

    const email = VIEWPORT_EMAIL(info.project.name);
    const admin = await pageAs(browser, info, "wanida");

    // --- list, search, role filter ---------------------------------------------
    await admin.goto("/admin/users");
    // The row, not the name: the signed-in Administrator's name is also in the
    // header, so a page-wide match could pass on an empty list. Review of
    // PR #66. A row is a table row on desktop and tablet, a card on mobile.
    const adminRow = admin
      .locator(".tkt-list")
      .locator("tr, .tkt-ticket-card")
      .filter({ hasText: ADMINISTRATOR.email })
      .locator("visible=true");

    await expect(adminRow).toHaveCount(1);
    await expect(adminRow).toContainText(ADMINISTRATOR.name);
    await shoot(admin, info, "user-management", "list");

    await admin.getByLabel("Search").fill("jennifer");
    await expect(visibleText(admin, "Jennifer Anderson")).toBeVisible();
    await shoot(admin, info, "user-management", "search");
    await admin.getByLabel("Search").fill("");

    await admin.getByLabel("Role").selectOption("IT_STAFF");
    await expect(visibleText(admin, EDITABLE_STAFF.name)).toBeVisible();
    // Scoped to the list, not the whole page: the signed-in Administrator's
    // own name is always in the header identity area regardless of what the
    // Role filter narrows the list to.
    await expect(
      admin.locator(".tkt-list").getByText(ADMINISTRATOR.name)
    ).toHaveCount(0);
    await shoot(admin, info, "user-management", "role-filter");
    await admin.getByLabel("Role").selectOption("");

    // The create/edit panel and the filter bar are both on screen at once
    // while a panel is open — the panel's own "Role" select and "Create User" /
    // "Cancel" buttons are scoped to it, `.tkt-user-panel`, so a locator by
    // accessible name alone is never ambiguous between the two.
    const panel = admin.locator(".tkt-user-panel");

    // --- create -----------------------------------------------------------------
    // By role rather than by label: `getByLabel` was observed to hang
    // indefinitely on this panel's fields immediately after it opens, for
    // reasons this suite could not pin down further in the time available —
    // see the PR description's "decisions the contract left open".
    await admin.getByRole("button", { name: "Create User" }).click();
    await panel
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("E2E New Hire");
    await panel
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(email);
    await panel
      .getByRole("textbox", { name: "Initial password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await shoot(admin, info, "user-management", "create");

    // --- duplicate-email, then correct it and actually create the account -----
    await panel
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ADMINISTRATOR.email);
    await panel.getByRole("button", { name: "Create User" }).click();
    await expect(
      admin.getByText("Another account already uses this email address.")
    ).toBeVisible();
    await shoot(admin, info, "user-management", "duplicate-email");

    await panel
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(email);
    await panel.getByRole("button", { name: "Create User" }).click();
    await expect(
      admin.getByRole("heading", { name: "Create User" })
    ).toHaveCount(0);
    await expect(visibleText(admin, email)).toBeVisible();

    // --- edit ---------------------------------------------------------------------
    await admin
      .getByRole("button", { name: `Edit ${EDITABLE_STAFF.name}` })
      .click();
    await expect(
      panel.getByRole("heading", { name: `Edit ${EDITABLE_STAFF.name}` })
    ).toBeVisible();
    await shoot(admin, info, "user-management", "edit");

    // --- a new starting password on an existing account (BR-37) ------------------
    await panel
      .getByRole("button", { name: "Set a New Initial Password" })
      .click();
    await panel
      .getByRole("textbox", { name: "New initial password", exact: true })
      .fill("ResetForE2E-2!");
    await shoot(admin, info, "user-management", "new-initial-password");
    await panel.getByRole("button", { name: "Set Password" }).click();
    await expect(
      panel.getByText("A new starting password was set.")
    ).toBeVisible();
    await panel.getByRole("button", { name: "Cancel" }).click();

    // --- the safety rules, on the Administrator's own account (E2E-07) -----------
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
    await shoot(admin, info, "user-management", "self-deactivation-refused");

    await panel
      .getByRole("combobox", { name: "Role", exact: true })
      .selectOption("IT_STAFF");
    await panel.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      panel.getByText(
        "This is the only active Administrator. Make someone else an active Administrator before changing this account's role or status."
      )
    ).toBeVisible();
    await expect(
      panel.getByRole("combobox", { name: "Role", exact: true })
    ).toHaveValue("ADMIN");
    await shoot(admin, info, "user-management", "last-admin-refused");

    // The seeded Administrator is exactly as it was: both refusals above are,
    // by definition, changes that never took effect.
    await panel.getByRole("button", { name: "Cancel" }).click();
    await admin.context().close();

    // --- the new hire signs in, and is forced to change the password (E2E-06) ---
    const hire = await freshPage(browser, info);

    await hire.goto("/login");
    await hire.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await hire
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await hire.getByRole("button", { name: "Sign In" }).click();

    await expect(hire).toHaveURL(/\/change-password$/u);

    await hire
      .getByRole("textbox", { name: "Current password", exact: true })
      .fill(NEW_HIRE_PASSWORD);
    await hire
      .getByRole("textbox", { name: "New password", exact: true })
      .fill("ChosenByNewHire1!");
    await hire
      .getByRole("textbox", { name: "Confirm new password", exact: true })
      .fill("ChosenByNewHire1!");
    await hire.getByRole("button", { name: "Continue" }).click();

    await expect(hire).toHaveURL(/\/my-tickets$/u);
    await expect(hire.getByText("E2E New Hire")).toBeVisible();

    await hire.context().close();
  });
});
