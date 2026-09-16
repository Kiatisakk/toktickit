import { expect, test as setup } from "@playwright/test";

import { SIGNED_IN, storageStateOf } from "./sessions";

/**
 * Signs in once per account and saves the session for every spec to reuse
 * (D-15, tests.md §1).
 *
 * Through the real sign-in screen, not a request that sets a cookie by hand: a
 * setup that manufactured its own session would prove the cookie works and not
 * the screen. It runs once per `playwright test`, ahead of every viewport, so a
 * full run pays for three sign-ins rather than for one per test.
 *
 * Specs must never click Logout with one of these sessions. Signing out deletes
 * the session row, and every later test reusing the saved state would find
 * itself signed out.
 */

for (const [who, account] of Object.entries(SIGNED_IN)) {
  setup(`sign in as ${account.name}`, async ({ page }) => {
    await page.goto("/login");

    // By role and accessible name, not by label text: each label also carries
    // the required marker ("Password*"), which an exact label match misses.
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(account.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(account.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/my-tickets$/u);
    await expect(page.getByText(account.name)).toBeVisible();

    await page
      .context()
      .storageState({ path: storageStateOf(who as keyof typeof SIGNED_IN) });
  });
}
