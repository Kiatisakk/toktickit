import { expect, test } from "@playwright/test";

import {
  computed,
  expectNoHorizontalScroll,
  expectNothingClipped,
  firstTicketLink,
  shoot,
  signInAs,
  ZEN_GREEN,
} from "./support";

/**
 * The checks jsdom cannot make (§8.8).
 *
 * Every other test in this repository loads a module into jsdom, which resolves
 * no stylesheet and has no layout engine. So the entire unit suite can prove a
 * class name is present and nothing at all about whether the class does
 * anything, whether something later in the cascade overrides it, or whether the
 * result fits on the screen.
 *
 * That gap is not theoretical. Issue #18 shipped a table with no background,
 * invisible against the page; Issue #19 shipped three fields with no box, two
 * cards touching, and icons at the wrong size. Six hundred passing tests saw
 * none of it, because none of them could. This file is the answer.
 */

const REQUESTER = "Jennifer Anderson";

test.describe("Zen Green tokens, as the browser computes them", () => {
  test("the header is the primary green on every screen", async ({ page }) => {
    await signInAs(page, REQUESTER);

    const header = page.locator(".tkt-header");

    await expect(header).toBeVisible();
    expect(await computed(header, "background-color")).toBe(ZEN_GREEN.primary);
  });

  test("the page sits on the page background, not on white", async ({
    page,
  }) => {
    await signInAs(page, REQUESTER);

    const body = page.locator("body");

    expect(await computed(body, "background-color")).toBe(ZEN_GREEN.page);
  });

  test("the primary button is the primary green", async ({ page }) => {
    await signInAs(page, REQUESTER);

    const primary = page.getByRole("button", { name: "Create Ticket" }).first();

    await expect(primary).toBeVisible();
    expect(await computed(primary, "background-color")).toBe(ZEN_GREEN.primary);
  });

  /*
   * The regression that started this file.
   *
   * The ticket list shipped with no background at all, so it inherited the page
   * colour and read as loose text lying on the background. No test could see
   * it; a person opening the screen could see nothing else.
   */
  test("the ticket list is a surface, not bare text on the background", async ({
    page,
  }, info) => {
    await signInAs(page, REQUESTER);

    /*
     * Which element carries the surface changes at 768px, and deliberately so:
     * below it the cards each have their own, and `.tkt-list` gives up its own
     * rather than being a box drawn around boxes. Asserting `.tkt-list` at
     * every width would demand the nesting that decision exists to avoid.
     */
    const surface =
      info.project.name === "mobile"
        ? page.locator(".tkt-ticket-card").first()
        : page.locator(".tkt-list");

    await expect(surface).toBeVisible();
    expect(await computed(surface, "background-color")).toBe(ZEN_GREEN.surface);
  });

  test("the table header carries the pale green the illustration draws", async ({
    page,
  }, info) => {
    const onMobile = info.project.name === "mobile";

    await signInAs(page, REQUESTER);
    await expect(firstTicketLink(page)).toBeVisible();

    const heading = page.locator(".tkt-table thead th").first();

    // Below 768px the table is replaced by cards, so there is no header. That
    // used to be an `if`, which passes silently when the element is missing for
    // any other reason — including the table having been hidden everywhere by
    // mistake. Asserted per viewport instead, so its absence is checked too.
    await expect(heading).toBeVisible({ visible: !onMobile });

    if (onMobile) {
      return;
    }

    expect(await computed(heading, "background-color")).toBe(ZEN_GREEN.pale);
    expect(await computed(heading, "color")).toBe(ZEN_GREEN.primary);
  });

  test("the active navigation item is marked, and not only by colour", async ({
    page,
  }) => {
    await signInAs(page, REQUESTER);

    const active = page.locator(".tkt-nav-link--active");

    // The mobile navigation is collapsed behind a toggle.
    if (await active.isVisible()) {
      expect(await computed(active, "border-bottom-color")).not.toBe(
        "rgba(0, 0, 0, 0)"
      );
    }

    // Colour is the decoration; `aria-current` is the statement.
    await expect(page.locator('[aria-current="page"]').first()).toHaveCount(1);
  });
});

test.describe("nothing clipped, nothing overflowing", () => {
  const screens = [
    ["my-tickets", "/my-tickets"],
    ["create-ticket", "/tickets/new"],
  ] as const;

  for (const [name, url] of screens) {
    test(`${name} fits its viewport`, async ({ page }) => {
      await signInAs(page, REQUESTER);
      await page.goto(url);

      await expectNoHorizontalScroll(page, name);
      await expectNothingClipped(page);
    });
  }

  test("ticket detail fits its viewport, attachment names included", async ({
    page,
  }) => {
    await signInAs(page, REQUESTER);

    const link = firstTicketLink(page);

    await expect(link).toBeVisible();
    await link.click();

    await expectNoHorizontalScroll(page, "Ticket Detail");
    await expectNothingClipped(page);
  });

  /*
   * §8.7 forbids the *page* scrolling sideways, not a table. Nine columns of
   * real data are wider than a tablet, so the table scrolls inside its own box
   * — and that box has to be reachable from the keyboard, or the far columns
   * are visible to a mouse and to nobody else.
   */
  test("the table scrolls inside its own container, reachable by keyboard", async ({
    page,
  }, info) => {
    const onMobile = info.project.name === "mobile";

    await signInAs(page, REQUESTER);
    await expect(firstTicketLink(page)).toBeVisible();

    const scroller = page.locator(".tkt-table-scroll");

    // Same reasoning as the header above: presence is asserted per viewport
    // rather than assumed, so a container that vanished would fail here.
    await expect(scroller).toBeVisible({ visible: !onMobile });

    if (!onMobile) {
      expect(await computed(scroller, "overflow-x")).toBe("auto");
      await expect(scroller).toHaveAttribute("tabindex", "0");

      // `overflow-x: auto` is only half the guarantee. It clips descendants
      // whose containing block sits inside this box, and an absolutely
      // positioned element's containing block is its nearest *positioned*
      // ancestor — so while this box was `static`, the `.tkt-visually-hidden`
      // spans in the last columns escaped it and widened the page instead.
      // Asserted rather than left to `expectNoHorizontalScroll`, which caught
      // it only when the data happened to push those cells past the edge.
      expect(await computed(scroller, "position")).not.toBe("static");
    }
  });
});

test.describe("the three screens at this viewport", () => {
  test("are captured for the report", async ({ page }, info) => {
    const viewport = info.project.name;

    await signInAs(page, REQUESTER);
    await shoot(page, "my-tickets", viewport);

    await page.goto("/tickets/new");
    await shoot(page, "create-ticket", viewport);

    await page.goto("/my-tickets");

    const link = firstTicketLink(page);

    await expect(link).toBeVisible();
    await link.click();
    await shoot(page, "ticket-detail", viewport);
  });
});

test.describe("the list changes presentation at 768px", () => {
  test("table above it, cards below it, never both and never neither", async ({
    page,
  }, info) => {
    const onMobile = info.project.name === "mobile";

    await signInAs(page, REQUESTER);

    // A list with no rows renders the empty state, and then neither the table
    // nor the cards exist — which would pass both assertions below without
    // testing anything. Proven by running it that way once: 24 green against a
    // database of zero tickets. So the row is a precondition, not decoration.
    await expect(firstTicketLink(page)).toBeVisible();

    // Both halves of the rule, at every viewport. This test used to skip itself
    // outside mobile and assert only that the table was hidden — so nothing in
    // the suite ever checked that the table is *shown* at 768px and above, and
    // a media query that hid it everywhere would have failed no test at all.
    // The two other tests that touch the table guard themselves with
    // `if (await …isVisible())`, which passes silently when the element is
    // missing, so they would not have caught it either.
    await expect(page.locator(".tkt-table")).toBeVisible({
      visible: !onMobile,
    });
    await expect(page.locator(".tkt-cards")).toBeVisible({ visible: onMobile });

    if (!onMobile) {
      return;
    }

    const card = page.locator(".tkt-ticket-card").first();

    await expect(card).toBeVisible();

    // §8.7 lets the two presentations differ; it does not let the small one say
    // less, because there is no wider view to switch to on a phone.
    //
    // Asserted together rather than in sequence: they are independent facts
    // about one already-rendered card, so waiting for each in turn only makes
    // the failure slower to arrive.
    await Promise.all(
      [
        "Category",
        "Related System",
        "Requested Priority",
        "IT Priority",
        "Created",
        "Last Updated",
      ].map(async (label) => {
        await expect(card.getByText(label, { exact: true })).toBeVisible();
      })
    );
  });
});
