import path from "node:path";

import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Shared helpers for the Lab 2 end-to-end suite.
 *
 * Two things live here because getting either wrong quietly ruins the evidence
 * rather than failing loudly: where screenshots are written, and how a colour is
 * read back out of a real browser.
 */

/** §12 fixes this path. The report cites it, so it is not ours to choose. */
export const SHOTS = path.resolve(
  process.cwd(),
  "artifacts/lab-02/screenshots"
);

/**
 * The §7 palette, as the browser reports it.
 *
 * `getComputedStyle` returns `rgb(0, 107, 60)`, never `#006B3C`, so the
 * comparison has to be made in the browser's own units rather than in the
 * labsheet's. Converting at the assertion instead would mean writing a hex
 * parser and trusting it.
 */
export const ZEN_GREEN = {
  primary: "rgb(0, 107, 60)",
  accent: "rgb(11, 122, 70)",
  pale: "rgb(234, 246, 239)",
  page: "rgb(245, 247, 246)",
  surface: "rgb(255, 255, 255)",
} as const;

/**
 * Writes a screenshot under a stable name.
 *
 * Stable is the requirement, not a nicety: an accumulating directory means the
 * report cites a file that a later run did not produce, and nobody notices
 * because the old one is still sitting there. Same name every run, so a rerun
 * overwrites and the directory listing is the current truth.
 */
export const shoot = async (
  page: Page,
  screen: "create-ticket" | "my-tickets" | "ticket-detail",
  name: string
): Promise<void> => {
  await page.screenshot({
    path: path.join(SHOTS, screen, `${name}.png`),
    fullPage: true,
  });
};

/**
 * Reads a computed colour back out of the live browser.
 *
 * This is the assertion jsdom cannot make. It loads no stylesheet, so every
 * "does this use the right green" test in the unit suite can only check that a
 * class name is present — not that the class does anything, nor that something
 * later in the cascade has overridden it.
 */
export const computed = async (
  locator: Locator,
  property: string
): Promise<string> =>
  await locator.evaluate(
    (node, prop) => globalThis.getComputedStyle(node).getPropertyValue(prop),
    property
  );

/**
 * Fails if the page can be scrolled sideways.
 *
 * §8.7 forbids horizontal page scrolling at every viewport. A one-pixel
 * tolerance because sub-pixel layout rounding produces a scrollWidth a fraction
 * over the client width on perfectly correct pages, and a test that fails on
 * that teaches people to ignore it.
 */
export const expectNoHorizontalScroll = async (
  page: Page,
  where = "the page"
): Promise<void> => {
  const { overflow, culprits } = await page.evaluate(() => {
    const { documentElement } = globalThis.document;
    const limit = documentElement.clientWidth;
    const found: string[] = [];

    // Naming the widest element that crosses the edge, because "the page
    // scrolls" is a symptom and the report needs the cause. Without this the
    // next person bisects the DOM by hand.
    for (const node of globalThis.document.querySelectorAll<HTMLElement>("*")) {
      const box = node.getBoundingClientRect();

      if (box.right > limit + 1 && box.width > 0) {
        found.push(
          `${node.tagName.toLowerCase()}.${node.className || "(no class)"} → ${Math.round(box.right - limit)}px past`
        );
      }
    }

    return {
      overflow: documentElement.scrollWidth - limit,
      // The deepest few are the ones actually too wide; their ancestors are
      // only reported because they contain them.
      culprits: found.slice(-4),
    };
  });

  expect(
    overflow,
    `${where} scrolls ${overflow}px sideways, which §8.7 forbids.\n${culprits.join("\n")}`
  ).toBeLessThanOrEqual(1);
};

/**
 * Fails if any visible text is cut off by its own container.
 *
 * §8.7: "No clipped labels, overlapping messages, hidden buttons, or unreadable
 * attachment names." Clipping is invisible in a screenshot review when the
 * clipped part is the end of a word, so it is asserted rather than looked at.
 */
export const expectNothingClipped = async (page: Page): Promise<void> => {
  const clipped = await page.evaluate(() => {
    const offenders: string[] = [];

    for (const node of globalThis.document.querySelectorAll<HTMLElement>(
      "label, button, a, p, td, th, h1, h2, .tkt-field-label, .tkt-attachment__name"
    )) {
      // Screen-reader-only text is clipped on purpose — that is the entire
      // technique. Counting it as a defect made this check fail on the one
      // thing in the page doing accessibility correctly.
      if (node.closest(".tkt-visually-hidden")) {
        continue;
      }

      const style = globalThis.getComputedStyle(node);
      const cut =
        node.scrollWidth > node.clientWidth + 1 && style.overflow !== "visible";

      if (cut && node.textContent?.trim()) {
        offenders.push(node.textContent.trim().slice(0, 60));
      }
    }

    return offenders;
  });

  expect(clipped, "text is cut off by its container").toEqual([]);
};

/**
 * The first ticket link, at whatever viewport.
 *
 * `.tkt-table tbody tr a` and `.tkt-ticket-card a` both exist in the DOM at
 * every size — below 768px the table is hidden with `display: none` rather than
 * unmounted — so a CSS locator with `.first()` picks the table's link and finds
 * it invisible. A role locator reads the accessibility tree instead, which
 * excludes hidden subtrees, so it resolves to whichever presentation is
 * actually on screen.
 */
export const firstTicketLink = (page: Page): Locator =>
  page.getByRole("link", { name: /^TKT-\d{4}-\d{6}$/u }).first();

/** Selects a Development Requester by name and lands on My Tickets. */
export const signInAs = async (page: Page, name: string): Promise<void> => {
  await page.goto("/select-requester");

  const select = page.getByLabel("Development Requester");

  await expect(select).toBeVisible();
  await select.selectOption({ label: name });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/my-tickets$/u);
};
