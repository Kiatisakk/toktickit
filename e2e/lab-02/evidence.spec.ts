import { expect, test } from "@playwright/test";

import { shoot, signInAs } from "./support";

/**
 * The screenshots §14 asks for that the journey does not pass through.
 *
 * `requester-ticket-flow.spec.ts` photographs whatever its own path happens to
 * cross, which covers most of what Part 6 and Part 7 name and misses the rest:
 * the selection screen has no place in a journey that starts by getting past
 * it, and pagination cannot appear on a list of three tickets.
 *
 * So these states are set up deliberately. Nothing here changes the
 * application to make a picture possible — the failure states are produced by
 * failing the real request at the browser, and the paginated list is built by
 * creating tickets through the API the screen itself reads from.
 */

const REQUESTER = "Jennifer Anderson";

test.describe("the Development Requester Selection screen — §14 Part 6", () => {
  test("its four states", async ({ page }, info) => {
    const viewport = info.project.name;

    // Loading. The response is held rather than raced, the same way the
    // submitting state is captured on Create Ticket.
    await page.route("**/api/requesters", async (route) => {
      const response = await route.fetch();

      await expect(page.getByText("Loading requesters…")).toBeVisible();
      await shoot(page, "requester-selection", `${viewport}-loading`);

      await route.fulfill({ response });
    });

    await page.goto("/select-requester");
    await expect(page.getByLabel("Development Requester")).toBeVisible();

    // Initial: the dropdown of active requesters, before one is chosen.
    await shoot(page, "requester-selection", `${viewport}-initial`);

    await page.unroute("**/api/requesters");

    // Failure. §8.1 requires the safe error state and a way out of it.
    await page.route("**/api/requesters", (route) => route.abort("failed"));
    await page.goto("/select-requester");
    await expect(
      page.getByText("Could not load Development Requesters")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await shoot(page, "requester-selection", `${viewport}-failure`);
    await page.unroute("**/api/requesters");

    // Selected: who is chosen is shown in the shell, with Change Requester
    // beside it — the two things Part 6 names after the dropdown itself.
    await signInAs(page, REQUESTER);
    await expect(page.getByText(REQUESTER).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change Requester" })
    ).toBeVisible();
    await shoot(page, "requester-selection", `${viewport}-selected`);
  });
});

test.describe("My Tickets controls doing something — §14 Part 7", () => {
  test("filters, sorting and pagination", async ({ page, request }, info) => {
    const viewport = info.project.name;

    await signInAs(page, REQUESTER);

    // Part 7 asks for pagination evidence, and a page control only exists once
    // there is a second page. The rows are created through the same API the
    // screen reads, rather than by seeding: the demonstration seed belongs to
    // the development database, and putting it in the test database broke four
    // server assertions when it was tried (D-11).
    //
    // The Playwright `request` fixture inherits the config's baseURL, which is
    // the Vite dev server (5173) — and Vite has no /api proxy, so a relative
    // "/api/…" returns index.html instead of JSON. The API lives on :3000, so
    // these calls use an absolute URL. Categories and related-systems answer
    // with a plain array (api-spec.md §3), not a { data } envelope.
    const API = "http://localhost:3000";
    const asRequester = { "X-Development-Requester-Id": "1" };
    const categoryResponse = await request.get(`${API}/api/categories`, {
      headers: asRequester,
    });
    const categories = (await categoryResponse.json()) as { id: number }[];
    const systemResponse = await request.get(`${API}/api/related-systems`, {
      headers: asRequester,
    });
    const systems = (await systemResponse.json()) as { id: number }[];

    const priorities = ["LOW", "MEDIUM", "HIGH"];

    await Promise.all(
      Array.from({ length: 12 }, (_unused, n) =>
        request.post(`${API}/api/tickets`, {
          headers: asRequester,
          data: {
            summary: `Evidence row ${String(n + 1).padStart(2, "0")} for the report`,
            description:
              "Created by the evidence suite so the page controls have a second page to point at.",
            categoryId: categories[n % categories.length]?.id,
            relatedSystemId: systems[n % systems.length]?.id,
            requestedPriority: priorities[n % priorities.length],
          },
        })
      )
    );

    await page.reload();

    // Pagination: more than one page, with the controls on screen.
    // The page buttons carry aria-labels ("Page 2"), so the accessible name
    // is that, not the visible number alone.
    await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();
    await shoot(page, "my-tickets", `${viewport}-pagination`);

    // Sorting: the list reordered by a column the user chose.
    const sortByPriority = page.getByRole("button", {
      name: /Requested Priority/u,
    });

    // Below 768px the table is cards and the sort control is a select instead.
    await ((await sortByPriority.isVisible())
      ? sortByPriority.click()
      : page.getByLabel(/Sort by/u).selectOption("requestedPriority"));

    await expect(
      page.getByRole("link", { name: /^TKT-/u }).first()
    ).toBeVisible();
    await shoot(page, "my-tickets", `${viewport}-sorting`);

    // Filters: a narrowed list, which is the thing a screenshot of a filter bar
    // does not by itself show.
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    await expect(
      page.getByRole("link", { name: /^TKT-/u }).first()
    ).toBeVisible();
    await shoot(page, "my-tickets", `${viewport}-filters`);
  });
});
