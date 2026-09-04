import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  type TicketRow,
  TicketTable,
} from "../../../src/components/TicketTable";

/**
 * STYLE-07 (extended) — the two presentations of the same list.
 *
 * §8.7 lets the desktop table and the mobile cards look different. It does not
 * let the small one say less: a column dropped below 768px is information the
 * reader cannot reach at all, because there is no wider view to switch to.
 *
 * jsdom applies no media query, so both are in the document here and CSS decides
 * which is visible. That is what makes this assertable at all — whether the
 * right one is *shown* at a given width is RESP-02's question, in Playwright.
 */

const TICKET: TicketRow = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  requestedPriority: "HIGH",
  itPriority: null,
  currentStatus: "NEW",
  createdAt: "2026-08-01T09:14:00.000Z",
  updatedAt: "2026-08-03T11:02:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  ticketOwner: null,
};

const renderTable = () =>
  render(
    <MemoryRouter>
      <TicketTable
        onSort={() => undefined}
        order="desc"
        sort="createdAt"
        tickets={[TICKET]}
      />
    </MemoryRouter>
  );

describe("the desktop table", () => {
  it("names every column ui-spec.md defines", () => {
    renderTable();

    for (const heading of [
      "Ticket No.",
      "Created Date",
      "Summary",
      "Category",
      "Requested Priority",
      "IT Priority",
      "Current Status",
      "Ticket Owner",
      "Last Updated",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(heading, "u") })
      ).toBeInTheDocument();
    }
  });

  // Lab 2 never assigns an owner, so this is every row rather than an edge case.
  it("says an unassigned owner is unassigned rather than leaving the cell blank", () => {
    const { container } = renderTable();
    const table = container.querySelector(".tkt-table") as HTMLElement;

    expect(
      within(table).getByText("Not yet assigned to an IT owner")
    ).toBeInTheDocument();
  });

  it("shows the owner's name once there is one", () => {
    render(
      <MemoryRouter>
        <TicketTable
          onSort={() => undefined}
          order="desc"
          sort="createdAt"
          tickets={[
            { ...TICKET, ticketOwner: { id: 9, name: "Michael Brown" } },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Michael Brown").length).toBeGreaterThan(0);
  });

  it("announces the current sort rather than only drawing an arrow", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: /Created Date/u })
    ).toHaveAttribute("aria-sort", "descending");
  });

  // A sortable column that is not the current sort still gets "none" rather
  // than a missing attribute: WAI-ARIA treats the two as different states, and
  // "none" is what tells a screen reader user the column can be sorted at
  // all, just not right now.
  it("marks an inactive sortable column with aria-sort='none'", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: /Summary/u })
    ).toHaveAttribute("aria-sort", "none");
  });

  // A column with no field at all — Category is never sortable — carries no
  // aria-sort, because it does not have the capability "none" would claim.
  it("leaves a column that is never sortable without a sort state", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: "Category" })
    ).not.toHaveAttribute("aria-sort");
  });

  it("links the ticket number to its detail screen", () => {
    const { container } = renderTable();
    const table = container.querySelector(".tkt-table") as HTMLElement;

    expect(
      within(table).getByRole("link", { name: "TKT-2026-000042" })
    ).toHaveAttribute("href", "/tickets/42");
  });
});

// Raised in review of PR #27: between 768px and 991px the table is still the
// presentation, and nine columns of real data are wider than the viewport.
describe("the tablet band", () => {
  it("keeps the overflow inside a container of its own", () => {
    const { container } = renderTable();
    const scroller = container.querySelector(".tkt-table-scroll");

    expect(scroller).not.toBeNull();
    expect(scroller?.querySelector(".tkt-table")).not.toBeNull();
  });

  // A scrollable box that cannot be focused hides its far columns from anyone
  // not using a pointer.
  it("can be reached and scrolled from the keyboard", () => {
    const { container } = renderTable();

    expect(container.querySelector(".tkt-table-scroll")).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("names the region, since a bare scrollable box announces nothing", () => {
    const { container } = renderTable();

    expect(container.querySelector(".tkt-table-scroll")).toHaveAttribute(
      "aria-label",
      "Your tickets"
    );
  });

  // Without an explicit role a bare <div> has none, and `aria-label` is only
  // ever surfaced as an accessible name on an element that has one — so the
  // label above is inert without this.
  it("gives the scroll container the role its aria-label needs to mean anything", () => {
    const { container } = renderTable();

    expect(container.querySelector(".tkt-table-scroll")).toHaveAttribute(
      "role",
      "region"
    );
  });
});

describe("clicking a sortable header", () => {
  it("asks for that column when it is not already the sort", async () => {
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <TicketTable
          onSort={onSort}
          order="desc"
          sort="createdAt"
          tickets={[TICKET]}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "Ticket No." }));

    expect(onSort).toHaveBeenCalledWith("ticketNumber");
  });

  // The header button carries the same field regardless of direction — it is
  // `onSort`, driven by the caller, that decides a repeat click means
  // "toggle". This only proves the header always sends its own field.
  it("asks for the same field again when its own header is clicked twice", async () => {
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <TicketTable
          onSort={onSort}
          order="desc"
          sort="createdAt"
          tickets={[TICKET]}
        />
      </MemoryRouter>
    );

    const header = screen.getByRole("button", { name: /Created Date/u });

    await userEvent.click(header);
    await userEvent.click(header);

    expect(onSort).toHaveBeenNthCalledWith(1, "createdAt");
    expect(onSort).toHaveBeenNthCalledWith(2, "createdAt");
  });
});

describe("the mobile sort control", () => {
  // Below 768px `.tkt-table` — sort buttons included — is hidden entirely
  // (components.css), so this is the only way left to change the sort.
  it("offers every sortable column and none of the others", () => {
    renderTable();

    const select = screen.getByLabelText("Sort by");

    for (const label of [
      "Ticket No.",
      "Created Date",
      "Summary",
      "Requested Priority",
      "Last Updated",
    ]) {
      expect(
        within(select).getByRole("option", { name: label })
      ).toBeInTheDocument();
    }

    for (const label of ["Category", "IT Priority", "Current Status"]) {
      expect(within(select).queryByRole("option", { name: label })).toBeNull();
    }
  });

  it("calls onSort with the chosen field", async () => {
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <TicketTable
          onSort={onSort}
          order="desc"
          sort="createdAt"
          tickets={[TICKET]}
        />
      </MemoryRouter>
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Sort by"),
      "ticketNumber"
    );

    expect(onSort).toHaveBeenCalledWith("ticketNumber");
  });

  // The direction control re-sends the *current* field — the same call a
  // second click on an active header makes, which `onSort` already treats as
  // "toggle the direction".
  it("re-sends the current field from the direction toggle", async () => {
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <TicketTable
          onSort={onSort}
          order="desc"
          sort="createdAt"
          tickets={[TICKET]}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /Descending/u }));

    expect(onSort).toHaveBeenCalledWith("createdAt");
  });

  it("labels the direction toggle with the current order", () => {
    renderTable();

    expect(
      screen.getByRole("button", { name: /Descending/u })
    ).toBeInTheDocument();
  });
});

describe("the mobile cards", () => {
  const card = (container: HTMLElement) =>
    container.querySelector(".tkt-ticket-card") as HTMLElement;

  it("exists alongside the table", () => {
    const { container } = renderTable();

    expect(card(container)).not.toBeNull();
  });

  // The point of this file. Every value the table shows has to be reachable
  // from the card too.
  it.each([
    ["ticket number", "TKT-2026-000042"],
    ["summary", "Laptop battery drains quickly"],
    ["category", "Hardware"],
    ["related system", "Corporate Laptop"],
    ["requested priority", "High"],
    ["status", "New"],
  ])("carries the %s", (_label, value) => {
    const { container } = renderTable();

    expect(within(card(container)).getByText(value)).toBeInTheDocument();
  });

  it("carries the ticket owner row too", () => {
    const { container } = renderTable();

    expect(
      within(card(container)).getByText("Ticket Owner")
    ).toBeInTheDocument();
  });

  it("says that IT priority is unset rather than omitting the row", () => {
    const { container } = renderTable();

    expect(
      within(card(container)).getByText("IT Priority")
    ).toBeInTheDocument();
    expect(
      within(card(container)).getByText("IT priority not set")
    ).toBeInTheDocument();
  });

  it("links to the same detail screen", () => {
    const { container } = renderTable();

    expect(
      within(card(container)).getByRole("link", { name: "TKT-2026-000042" })
    ).toHaveAttribute("href", "/tickets/42");
  });
});
