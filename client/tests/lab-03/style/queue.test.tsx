import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { TicketRow } from "../../../src/components/TicketTable";
import { TicketTable } from "../../../src/components/TicketTable";

/**
 * STYLE-06 — the queue header carries `aria-sort` on every column the API can
 * sort by, `none` when inactive, and nothing on Category, which it cannot
 * (ui-spec.md §5, §10).
 */
describe("STYLE-06 queue header sorting", () => {
  const ROW: TicketRow = {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Laptop battery drains quickly",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    currentStatus: "NEW",
    createdAt: "2026-08-01T09:14:00.000Z",
    updatedAt: "2026-08-03T11:02:00.000Z",
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    ticketOwner: null,
  };

  const renderQueue = (sort: "ticketOwner" | "createdAt" = "createdAt") =>
    render(
      <MemoryRouter>
        <TicketTable
          onSort={vi.fn()}
          order="desc"
          sort={sort}
          tickets={[ROW]}
          variant="queue"
        />
      </MemoryRouter>
    );

  it("marks sortable columns none when inactive, and Category not at all", () => {
    renderQueue();

    expect(
      screen.getByRole("columnheader", { name: /ticket owner/iu })
    ).toHaveAttribute("aria-sort", "none");
    expect(
      screen.getByRole("columnheader", { name: /it priority/iu })
    ).toHaveAttribute("aria-sort", "none");
    expect(
      screen.getByRole("columnheader", { name: /current status/iu })
    ).toHaveAttribute("aria-sort", "none");

    // Category has no sort field, so the attribute must be absent rather
    // than "none": "none" would invite a click the API refuses (BR-34).
    expect(
      screen.getByRole("columnheader", { name: /^category$/iu })
    ).not.toHaveAttribute("aria-sort");
  });

  it("marks the active column ascending or descending", () => {
    const { rerender } = renderQueue("ticketOwner");

    expect(
      screen.getByRole("columnheader", { name: /ticket owner/iu })
    ).toHaveAttribute("aria-sort", "descending");

    rerender(
      <MemoryRouter>
        <TicketTable
          onSort={vi.fn()}
          order="asc"
          sort="ticketOwner"
          tickets={[ROW]}
          variant="queue"
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("columnheader", { name: /ticket owner/iu })
    ).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts through a button in the header", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <TicketTable
          onSort={onSort}
          order="desc"
          sort="createdAt"
          tickets={[ROW]}
          variant="queue"
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /ticket owner/iu }));

    expect(onSort).toHaveBeenCalledWith("ticketOwner");
  });
});
