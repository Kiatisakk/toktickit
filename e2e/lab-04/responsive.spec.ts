/* oxlint-disable no-await-in-loop -- browser steps are ordered by definition: each waits on the screen the one before it produced. */
import type { Page } from "@playwright/test";

import {
  computed,
  expectNoHorizontalScroll,
  expectNothingClipped,
  ZEN_GREEN,
} from "../lab-02/support";
import { expectTouchTargetsMeetMinimum } from "../lab-03/support";
import {
  emptyTheTestDatabase,
  expect,
  expectInsideViewport,
  expectNoOverlap,
  openAs,
  perRow,
  seedTheDashboardFixture,
  tabTo,
  test,
  ticketIdByNumber,
} from "./support";

/**
 * What jsdom cannot check, for Lab 4's new screens (RESP-01 to RESP-05; ui-spec
 * §9 and §12). The same checks `e2e/lab-03/visual.spec.ts` makes for Lab 3's
 * screens, applied to the two dashboards, the Actions Taken area and the
 * resolve dialog, at the viewport of whichever project is running.
 *
 * Ticket TKT-DEMO-L4-05 (three Actions: Done, Planned, Cancelled; In Progress;
 * owned by Michael) is the ticket the Actions checks use.
 */

const DEMO_TICKET = "TKT-DEMO-L4-05";

/** ui-spec.md §9: tablet starts at 768 px, desktop at 992 px. */
const TABLET_FROM = 768;
const DESKTOP_FROM = 992;

const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;

test.describe("Lab 4 layout and tokens", () => {
  test.beforeAll(() => {
    seedTheDashboardFixture();
  });

  test.afterAll(() => {
    emptyTheTestDatabase();
  });

  test("the staff dashboard at each viewport (RESP-01)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/dashboard");
    await expect(staff.locator(".tkt-metric").first()).toBeVisible();
    await expect(staff.locator(".tkt-recent__row")).toHaveCount(5);

    await expectNoHorizontalScroll(staff, "Staff dashboard");
    await expectNothingClipped(staff);
    await expectNoOverlap(staff, ".tkt-metric", "metric cards");
    await expectNoOverlap(staff, ".tkt-quick__tile", "quick actions");

    // ui-spec.md §3, "Arrangement": cards per row by band.
    const width = widthOf(staff);
    const rows = await perRow(staff, ".tkt-metric");

    if (width >= DESKTOP_FROM) {
      expect(rows, "desktop: four per row").toEqual([4, 4]);
    } else if (width >= TABLET_FROM) {
      expect(rows, "tablet: three per row").toEqual([3, 3, 2]);
    } else {
      expect(rows, "mobile: one per row").toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    }

    // Recent Tickets beside Quick Actions on desktop, above it otherwise.
    const recent = await staff.locator(".tkt-recent").boundingBox();
    const quick = await staff.locator(".tkt-quick").boundingBox();

    expect(recent).not.toBeNull();
    expect(quick).not.toBeNull();

    if (recent && quick) {
      if (width >= DESKTOP_FROM) {
        expect(quick.x).toBeGreaterThan(recent.x + recent.width - 1);
        expect(Math.abs(quick.y - recent.y)).toBeLessThan(2);
      } else {
        expect(quick.y).toBeGreaterThan(recent.y + recent.height - 1);
      }
    }

    if (width < TABLET_FROM) {
      await expectTouchTargetsMeetMinimum(staff);
    }

    await staff.context().close();
  });

  test("the Requester dashboard at each viewport (RESP-02)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator(".tkt-metric").first()).toBeVisible();

    await expectNoHorizontalScroll(page, "Requester dashboard");
    await expectNothingClipped(page);
    await expectNoOverlap(page, ".tkt-metric", "metric cards");
    await expectNoOverlap(page, ".tkt-quick__tile", "quick actions");

    const width = widthOf(page);
    const rows = await perRow(page, ".tkt-metric");

    if (width >= DESKTOP_FROM) {
      expect(rows, "desktop: four per row").toEqual([4]);
    } else if (width >= TABLET_FROM) {
      expect(rows, "tablet: two per row").toEqual([2, 2]);
    } else {
      expect(rows, "mobile: one per row").toEqual([1, 1, 1, 1]);
    }

    if (width < TABLET_FROM) {
      await expectTouchTargetsMeetMinimum(page);
    }
  });

  test("Actions Taken is a table from 768 px and cards below it, losing no column (RESP-03)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");
    const ticketId = await ticketIdByNumber(staff.request, DEMO_TICKET);

    await staff.goto(`/tickets/${ticketId}`);

    const rows = staff.locator(".tkt-actions-table tbody tr");

    await expect(rows).toHaveCount(3);
    await expectNoHorizontalScroll(staff, "Ticket Detail with Actions");
    await expectNothingClipped(staff);

    const width = widthOf(staff);
    const header = staff.locator(".tkt-actions-table thead");

    if (width >= TABLET_FROM) {
      await expect(header).toBeVisible();
      expect(await computed(rows.first(), "display")).toBe("table-row");

      // Wider than its container, it scrolls inside it, never the page.
      const overflow = await computed(
        staff.locator(".tkt-actions-scroll"),
        "overflow-x"
      );

      expect(["auto", "scroll"]).toContain(overflow);
    } else {
      // Hidden from sight but kept for assistive technology: one pixel wide.
      const box = await header.boundingBox();

      expect(box?.width ?? 0).toBeLessThanOrEqual(1);
      expect(await computed(rows.first(), "display")).not.toBe("table-row");

      // Every labelled column is restated on every card, with its value.
      for (const label of [
        "Date/time",
        "Description",
        "Performed by",
        "State",
        "Follow-up",
      ]) {
        const cells = staff.locator(
          `.tkt-actions-table tbody td[data-label="${label}"]`
        );

        await expect(cells).toHaveCount(3);

        for (const cell of await cells.all()) {
          await expect(cell).toBeVisible();
          const text = (await cell.textContent()) ?? "";

          expect(
            text.trim().length,
            `${label} has a value on every card`
          ).toBeGreaterThan(0);

          const shown = await cell.evaluate(
            (node) => globalThis.getComputedStyle(node, "::before").content
          );

          expect(shown, `${label} label is drawn`).toContain(label);
        }
      }
    }

    // The row controls neither overlap nor hide (ui-spec.md §12).
    await expectNoOverlap(
      staff,
      ".tkt-actions-table__row-actions button",
      "row action buttons"
    );
    await staff.context().close();
  });

  test("the resolve dialog and the Action form fit the viewport (RESP-04)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");
    const ticketId = await ticketIdByNumber(staff.request, DEMO_TICKET);

    await staff.goto(`/tickets/${ticketId}`);

    // --- the Add action form -----------------------------------------------
    await staff.getByRole("button", { name: "Add action" }).click();

    const form = staff.getByRole("form", { name: "Add action" });

    await expect(form).toBeVisible();
    await expectNoHorizontalScroll(staff, "the Add action form");
    await expectNothingClipped(staff);
    await expectNoOverlap(
      staff,
      ".tkt-action-form input, .tkt-action-form select, .tkt-action-form textarea, .tkt-action-form button",
      "form controls"
    );
    await form.getByRole("button", { name: "Cancel" }).click();

    // --- the resolve dialog --------------------------------------------------
    await staff.getByLabel("Current Status").focus();
    await staff.getByLabel("Current Status").selectOption("RESOLVED");

    const modal = staff.getByRole("dialog");

    await expect(modal).toBeVisible();
    await expect(staff.getByText("Checking the ticket's actions…")).toHaveCount(
      0
    );
    await expectInsideViewport(staff, modal, "the resolve dialog");
    await expectNoHorizontalScroll(staff, "the resolve dialog");
    await expectNoOverlap(
      staff,
      ".tkt-modal .tkt-gate-item, .tkt-modal button, .tkt-modal textarea",
      "dialog items"
    );

    // It scrolls inside itself if it is taller than the screen, and is never
    // taller than the viewport (ui-spec.md §9).
    expect(await computed(modal, "overflow-y")).toBe("auto");

    // Every condition is drawn with an icon and text, so none is colour alone.
    const items = modal.getByRole("listitem");

    await expect(items).toHaveCount(4);

    for (const item of await items.all()) {
      await expect(item.locator("i.tkt-icon").first()).toBeVisible();
    }

    await modal.getByLabel(/^Resolution Summary/u).fill("x");
    await expectNoHorizontalScroll(staff, "the resolve dialog with a summary");
    await staff.context().close();
  });

  test("Zen Green tokens, surfaces and visible focus (RESP-05, AC-39)", async ({
    browser,
    guard,
  }, info) => {
    const staff = await openAs(guard, browser, info, "michael");

    await staff.goto("/dashboard");
    await expect(staff.locator(".tkt-metric").first()).toBeVisible();

    // The header and the active navigation item.
    expect(
      await computed(staff.locator(".tkt-header"), "background-color")
    ).toBe(ZEN_GREEN.primary);

    const active = staff.locator('.tkt-nav [aria-current="page"]');

    await expect(active).toHaveCount(1);
    await expect(active).toHaveText(/Dashboard/u);
    expect(await computed(active, "border-bottom-color")).toBe(
      ZEN_GREEN.accent
    );

    // Cards are surfaces on the page background (ui-spec.md §12).
    expect(await computed(staff.locator("body"), "background-color")).toBe(
      ZEN_GREEN.page
    );
    expect(
      await computed(staff.locator(".tkt-metric").first(), "background-color")
    ).toBe(ZEN_GREEN.surface);
    expect(
      await computed(staff.locator(".tkt-recent"), "background-color")
    ).toBe(ZEN_GREEN.surface);

    // The metric figure is the dominant element and the primary green.
    expect(
      await computed(staff.locator(".tkt-metric__value").first(), "color")
    ).toBe(ZEN_GREEN.primary);

    // --- Actions Taken: primary button, table surface, row focus ------------
    const ticketId = await ticketIdByNumber(staff.request, DEMO_TICKET);

    await staff.goto(`/tickets/${ticketId}`);
    await expect(staff.locator(".tkt-actions-table")).toBeVisible();
    expect(
      await computed(
        staff.getByRole("button", { name: "Add action" }),
        "background-color"
      )
    ).toBe(ZEN_GREEN.primary);
    expect(
      await computed(
        staff
          .locator("section", { has: staff.locator(".tkt-actions-table") })
          .first(),
        "background-color"
      )
    ).toBe(ZEN_GREEN.surface);

    await tabTo(staff, ".tkt-actions-table button");

    const rowControl = staff.locator(".tkt-actions-table button:focus");

    await expect(rowControl).toHaveCount(1);
    expect(await computed(rowControl, "outline-style")).toBe("solid");
    expect(await computed(rowControl, "outline-width")).toBe("2px");
    expect(await computed(rowControl, "outline-color")).toBe(ZEN_GREEN.accent);

    // --- the dialog's own controls take a visible ring ----------------------
    await staff.getByLabel("Current Status").focus();
    await staff.getByLabel("Current Status").selectOption("RESOLVED");

    const modal = staff.getByRole("dialog");

    await expect(modal).toBeVisible();
    await expect(staff.getByText("Checking the ticket's actions…")).toHaveCount(
      0
    );
    await modal.getByLabel(/^Resolution Summary/u).fill("Focus check.");
    await staff.keyboard.press("Tab");

    const inside = staff.locator(".tkt-modal :focus");

    await expect(inside).toHaveCount(1);
    expect(await computed(inside, "outline-style")).toBe("solid");
    expect(await computed(inside, "outline-width")).toBe("2px");

    // Focus is trapped: Tab never leaves the dialog.
    for (let press = 0; press < 12; press += 1) {
      await staff.keyboard.press("Tab");
      await expect(staff.locator(".tkt-modal :focus")).toHaveCount(1);
    }

    await staff.context().close();
  });
});
