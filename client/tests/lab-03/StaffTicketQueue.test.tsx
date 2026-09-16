import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QueueRow } from "../../src/lib/api";
import { StaffTicketQueue } from "../../src/routes/StaffTicketQueue";
import { authContext, renderWithAuth, STAFF_USER } from "../support/auth";

/**
 * UI-10, UI-11, UI-12 and UI-25 — the staff Ticket Queue (ui-spec.md §5).
 *
 * `fetch` is stubbed per URL: the queue, the owners and the categories are three
 * calls, and a stub that answered all of them with one body would let a screen
 * render the queue from the owners list and still pass.
 */

const OWNED: QueueRow = {
  id: 7,
  ticketNumber: "TKT-2026-000007",
  summary: "VPN drops every hour",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "IN_PROGRESS",
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-02T09:00:00.000Z",
  category: { id: 3, name: "Network" },
  relatedSystem: { id: 3, name: "VPN" },
  ticketOwner: { id: 11, name: "Michael Brown" },
  requester: { id: 1, name: "Jennifer Anderson" },
};

const UNOWNED: QueueRow = {
  ...OWNED,
  id: 8,
  ticketNumber: "TKT-2026-000008",
  summary: "Printer jams on tray 2",
  itPriority: null,
  currentStatus: "NEW",
  ticketOwner: null,
  requester: { id: 2, name: "Somchai Wattana" },
};

const page = (data: QueueRow[]) => ({
  data,
  meta: {
    page: 1,
    pageSize: 10,
    totalItems: data.length,
    totalPages: data.length ? 1 : 0,
  },
});

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const stub = (queue: (url: URL) => unknown = () => page([OWNED, UNOWNED])) => {
  const fetchMock = vi.fn((input: string) => {
    const url = new URL(input);

    if (url.pathname === "/api/staff/tickets") {
      return Promise.resolve(json(queue(url)));
    }

    if (url.pathname === "/api/staff/owners") {
      return Promise.resolve(json([{ id: 11, name: "Michael Brown" }]));
    }

    return Promise.resolve(json([{ id: 3, name: "Network" }]));
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const queueCalls = (fetchMock: ReturnType<typeof stub>) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(input))
    .filter((url) => url.pathname === "/api/staff/tickets");

const render = () =>
  renderWithAuth(<StaffTicketQueue />, {
    context: authContext({ user: STAFF_USER }),
    path: "/staff/tickets",
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-10 the queue renders its rows and controls", () => {
  it("shows every row with the queue's controls", async () => {
    stub();
    render();

    const table = await screen.findByRole("table");

    expect(within(table).getByText(OWNED.summary)).toBeInTheDocument();
    expect(within(table).getByText(UNOWNED.summary)).toBeInTheDocument();

    for (const label of [
      "Search",
      "Category",
      "Requested Priority",
      "IT Priority",
      "Current Status",
      "Owner",
    ]) {
      expect(
        screen.getByLabelText(new RegExp(`^${label}`, "u"))
      ).toBeInTheDocument();
    }
  });

  it("makes IT Priority, Current Status and Ticket Owner sortable, which My Tickets does not", async () => {
    stub();
    render();

    const table = await screen.findByRole("table");

    for (const name of ["IT Priority", "Current Status", "Ticket Owner"]) {
      expect(
        within(table).getByRole("button", { name: new RegExp(name, "u") })
      ).toBeInTheDocument();
    }
    // Category stays unsortable: the API refuses it.
    expect(
      within(table).queryByRole("button", { name: /^Category/u })
    ).not.toBeInTheDocument();
  });

  it("asks the API for the owner sort when that header is pressed", async () => {
    const fetchMock = stub();
    render();

    const table = await screen.findByRole("table");
    await userEvent.click(
      within(table).getByRole("button", { name: /Ticket Owner/u })
    );

    await waitFor(() => {
      expect(queueCalls(fetchMock).at(-1)?.searchParams.get("sort")).toBe(
        "ticketOwner"
      );
    });
  });

  it("offers every sortable field in the mobile sort control too", async () => {
    stub();
    render();

    await screen.findByRole("table");
    const sortBy = screen.getByLabelText("Sort by");
    const values = within(sortBy)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    // Below 768px the table and its header buttons are gone; sorting must
    // stay reachable (ui-spec.md §5).
    expect(values).toEqual(
      expect.arrayContaining(["itPriority", "currentStatus", "ticketOwner"])
    );
  });
});

describe("UI-11 an unowned ticket reads Unassigned", () => {
  it("says Unassigned in words, never an empty cell", async () => {
    stub();
    render();

    const table = await screen.findByRole("table");
    const row = within(table).getByText(UNOWNED.summary).closest("tr");

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Unassigned")).toBeVisible();
  });

  it("sends unassigned=true, not an owner id, for the Unassigned option", async () => {
    const fetchMock = stub();
    render();

    await screen.findByRole("table");
    await userEvent.selectOptions(
      screen.getByLabelText(/^Owner/u),
      "unassigned"
    );

    await waitFor(() => {
      const last = queueCalls(fetchMock).at(-1);

      expect(last?.searchParams.get("unassigned")).toBe("true");
      expect(last?.searchParams.has("ownerId")).toBe(false);
    });
  });

  it("sends ownerId for a named owner, and resets to the first page", async () => {
    const fetchMock = stub();
    render();

    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText(/^Owner/u), "11");

    await waitFor(() => {
      const last = queueCalls(fetchMock).at(-1);

      expect(last?.searchParams.get("ownerId")).toBe("11");
      expect(last?.searchParams.has("unassigned")).toBe(false);
      expect(last?.searchParams.get("page")).toBe("1");
    });
  });
});

describe("UI-12 empty and no-results are different", () => {
  it("says the queue is empty when nothing is filtered", async () => {
    stub(() => page([]));
    render();

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(
      screen.queryByText("No tickets match these filters")
    ).not.toBeInTheDocument();
  });

  it("says nothing matches, with Clear Filters, when a filter is on", async () => {
    stub((url) =>
      url.searchParams.has("unassigned") ? page([]) : page([OWNED])
    );
    render();

    await screen.findByRole("table");
    await userEvent.selectOptions(
      screen.getByLabelText(/^Owner/u),
      "unassigned"
    );

    expect(
      await screen.findByText("No tickets match these filters")
    ).toBeInTheDocument();
    expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();

    const clear = screen
      .getAllByRole("button", { name: "Clear Filters" })
      .at(-1);

    await userEvent.click(clear as HTMLElement);

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("offers a retry when the queue cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) =>
        Promise.resolve(
          new URL(input).pathname === "/api/staff/tickets"
            ? json(
                {
                  error: {
                    code: "INTERNAL_ERROR",
                    message: "Something went wrong.",
                  },
                },
                500
              )
            : json([])
        )
      )
    );
    render();

    expect(
      await screen.findByText("Could not load the ticket queue")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});

describe("UI-25 opening a ticket from the queue", () => {
  it("makes the ticket number a link to the detail, in the table and on the card", async () => {
    stub();
    render();

    await screen.findByRole("table");

    const links = screen.getAllByRole("link", { name: OWNED.ticketNumber });

    // One in the table row, one on the card below 768px — both keyboard
    // reachable, both announce themselves as links.
    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link).toHaveAttribute("href", `/tickets/${OWNED.id}`);
    }
  });
});
