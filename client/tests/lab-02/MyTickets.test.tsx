import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RequesterContext,
  type RequesterContextValue,
} from "../../src/context/requesterContextValue";
import { MyTickets } from "../../src/routes/MyTickets";

/**
 * UI-11 — an empty list and a query that matched nothing are different states.
 *
 * The API cannot tell them apart; both are `data: []`. The screen decides by
 * whether any filter is active, which is the only place that distinction can be
 * made — so it is the only place it can be got wrong.
 */

const CATEGORIES = [
  { id: 2, name: "Hardware" },
  { id: 4, name: "Network" },
];

const ticket = (id: number) => ({
  id,
  ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
  summary: `Ticket number ${id}`,
  requestedPriority: "MEDIUM",
  itPriority: null,
  currentStatus: "NEW",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-02T09:00:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  ticketOwner: null,
});

const CONTEXT: RequesterContextValue = {
  status: "selected",
  requester: {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.ac.th",
  },
  generation: 0,
  select: () => undefined,
  clear: () => undefined,
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

/** Answers the category call, and the ticket list from whatever is supplied. */
const listFetch = (
  tickets: ReturnType<typeof ticket>[],
  meta: Partial<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }> = {}
) =>
  vi.fn((url: string) => {
    if (url.includes("/api/categories")) {
      return Promise.resolve(jsonResponse(CATEGORIES));
    }

    return Promise.resolve(
      jsonResponse({
        data: tickets,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: tickets.length,
          totalPages: Math.max(1, Math.ceil(tickets.length / 10)),
          ...meta,
        },
      })
    );
  });

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RequesterContext.Provider value={CONTEXT}>
        <MyTickets />
      </RequesterContext.Provider>
    </MemoryRouter>
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a populated list", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", listFetch([ticket(1), ticket(2)]));
  });

  it("shows each ticket number", async () => {
    renderScreen();

    expect(await screen.findAllByText("TKT-2026-000001")).not.toHaveLength(0);
  });

  it("links each ticket to its detail screen", async () => {
    renderScreen();

    const links = await screen.findAllByRole("link", {
      name: "TKT-2026-000001",
    });

    expect(links[0]).toHaveAttribute("href", "/tickets/1");
  });

  it("scopes the request to the current requester", async () => {
    renderScreen();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Development-Requester-Id": "1",
          }),
        })
      );
    });
  });
});

describe("an empty result", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", listFetch([]));
  });

  // BR-35, first half: nothing has been raised yet.
  it("says there are no tickets yet when nothing is filtered", async () => {
    renderScreen();

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
  });

  it("offers Create Ticket as the way out of an empty list", async () => {
    renderScreen();

    await screen.findByText("No tickets yet");
    expect(
      screen.getAllByRole("button", { name: "Create Ticket" }).length
    ).toBeGreaterThan(0);
  });

  // BR-35, second half: tickets exist, this query found none of them. Saying
  // "no tickets yet" here would be a lie the user cannot check.
  it("says the filters matched nothing once one is applied", async () => {
    renderScreen();

    await screen.findByText("No tickets yet");
    await userEvent.type(screen.getByLabelText("Search"), "nothing");

    expect(
      await screen.findByText("No tickets match your filters")
    ).toBeInTheDocument();
  });

  it("offers Clear Filters as the way out of a no-results state", async () => {
    renderScreen();

    await screen.findByText("No tickets yet");
    await userEvent.type(screen.getByLabelText("Search"), "nothing");

    await screen.findByText("No tickets match your filters");
    expect(
      screen.getAllByRole("button", { name: "Clear Filters" }).length
    ).toBeGreaterThan(0);
  });

  it("distinguishes the two states by their data-state", async () => {
    const { container } = renderScreen();

    await screen.findByText("No tickets yet");
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();

    await userEvent.type(screen.getByLabelText("Search"), "nothing");

    await screen.findByText("No tickets match your filters");
    expect(container.querySelector('[data-state="no-results"]')).not.toBeNull();
  });
});

/**
 * The page controls, on the screen rather than in isolation.
 *
 * `pagination.test.tsx` exercised the component directly and passed throughout —
 * but every mock in this file returned one or two tickets, so `totalPages` was
 * always 1 and `Pagination` correctly rendered nothing. Nothing here had ever
 * seen a page control. Raised by inspection of the running app, not by a test.
 */
describe("the page controls on the screen", () => {
  const sixPages = () =>
    listFetch([ticket(1), ticket(2)], {
      page: 1,
      pageSize: 10,
      totalItems: 55,
      totalPages: 6,
    });

  it("renders the windowed page numbers", async () => {
    vi.stubGlobal("fetch", sixPages());

    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    for (const label of ["Page 1", "Page 2", "Page 3", "Page 6"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("leaves out the pages the window skips", async () => {
    vi.stubGlobal("fetch", sixPages());

    renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    expect(screen.queryByRole("button", { name: "Page 5" })).toBeNull();
  });

  it("reports the real total rather than the length of the page", async () => {
    vi.stubGlobal("fetch", sixPages());

    renderScreen();

    expect(
      await screen.findByText("Showing 1 to 10 of 55 tickets")
    ).toBeInTheDocument();
  });

  it("asks the API for the page that was clicked", async () => {
    vi.stubGlobal("fetch", sixPages());

    renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=3"),
        expect.anything()
      );
    });
  });

  // The illustration draws one object: rows and the controls that page through
  // them share a surface. Two boxes read as a separate widget that happens to
  // sit underneath the table.
  it("shares a surface with the table rather than sitting below it", async () => {
    vi.stubGlobal("fetch", sixPages());

    const { container } = renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    const list = container.querySelector(".tkt-list");

    expect(list?.querySelector(".tkt-table")).not.toBeNull();
    expect(list?.querySelector(".tkt-pagination")).not.toBeNull();
  });

  // The reason the whole screen exists at one page is not a bug.
  it("renders no controls when everything fits on one page", async () => {
    vi.stubGlobal("fetch", listFetch([ticket(1)]));

    const { container } = renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    expect(container.querySelector(".tkt-pagination")).toBeNull();
  });
});

describe("filtering", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", listFetch([ticket(1)]));
  });

  it("keeps Clear Filters unavailable until something is filtered", async () => {
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    expect(
      screen.getByRole("button", { name: "Clear Filters" })
    ).toBeDisabled();
  });

  it("sends the filter to the API rather than filtering in the browser", async () => {
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "4");

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("categoryId=4"),
        expect.anything()
      );
    });
  });

  // Staying on page three of a result set that now has one page shows nothing
  // and looks like a failure.
  it("returns to the first page when the query changes", async () => {
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "4");

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.anything()
      );
    });
  });
});

describe("the loading state", () => {
  // ui-spec.md §7 asks for skeleton rows here, not a centred block. Raised in
  // review of PR #27: a block of a different height makes the page jump on
  // every refetch, and a filter change is a refetch.
  it("shows skeleton rows before the response arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );

    const { container } = renderScreen();

    expect(container.querySelector(".tkt-skeleton")).not.toBeNull();
  });

  it("still announces the load to a screen reader", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );

    renderScreen();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your tickets."
    );
  });

  it("keeps the filter bar usable while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );

    renderScreen();

    expect(screen.getByLabelText("Search")).toBeEnabled();
  });

  it("shows it again on a refetch rather than leaving stale rows", async () => {
    vi.stubGlobal("fetch", listFetch([ticket(1)]));

    const { container } = renderScreen();
    await screen.findAllByText("TKT-2026-000001");

    // A filter change refetches. Leaving the previous rows on screen would show
    // results that do not match the controls above them.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );
    await userEvent.selectOptions(screen.getByLabelText("Category"), "4");

    await waitFor(() => {
      expect(container.querySelector(".tkt-skeleton")).not.toBeNull();
    });
  });
});

/**
 * Findings from the peer review of PR #27.
 */
describe("when the categories cannot be loaded", () => {
  const categoriesFail = vi.fn((url: string) => {
    if (url.includes("/api/categories")) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }

    return Promise.resolve(
      jsonResponse({
        data: [ticket(1)],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      })
    );
  });

  // An empty dropdown that silently filters nothing is indistinguishable from a
  // category list with no categories in it.
  it("says the filter is unavailable rather than showing an empty one", async () => {
    vi.stubGlobal("fetch", categoriesFail);

    renderScreen();

    expect(
      await screen.findByText(
        "Categories could not be loaded, so this filter is unavailable."
      )
    ).toBeInTheDocument();
  });

  it("disables the control instead of offering a choice it cannot honour", async () => {
    vi.stubGlobal("fetch", categoriesFail);

    renderScreen();

    await screen.findByText(
      "Categories could not be loaded, so this filter is unavailable."
    );
    expect(screen.getByLabelText("Category")).toBeDisabled();
  });

  it("still shows the ticket list, which does not depend on it", async () => {
    vi.stubGlobal("fetch", categoriesFail);

    renderScreen();

    expect(await screen.findAllByText("TKT-2026-000001")).not.toHaveLength(0);
  });
});

describe("retrying after a failure", () => {
  // The retry used to build an AbortController nothing ever aborted, so a
  // filter change during a slow retry left two requests racing and the loser
  // could answer last.
  it("goes through the same effect, so the request is abortable", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/categories")) {
          return Promise.resolve(jsonResponse(CATEGORIES));
        }

        calls += 1;

        if (calls === 1) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }

        return Promise.resolve(
          jsonResponse({
            data: [ticket(7)],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          })
        );
      })
    );

    renderScreen();

    await screen.findByText("Could not load your tickets");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findAllByText("TKT-2026-000007")).not.toHaveLength(0);
  });
});

describe("switching requester", () => {
  // BR-08 on the client. The API side is covered by API-08; this is the half
  // that decides whether one person's rows stay on screen under another
  // person's name.
  it("refetches when the current requester changes", async () => {
    const fetchMock = listFetch([ticket(1)]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <MemoryRouter>
        <RequesterContext.Provider value={CONTEXT}>
          <MyTickets />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await screen.findAllByText("TKT-2026-000001");
    const before = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/tickets")
    ).length;

    rerender(
      <MemoryRouter>
        <RequesterContext.Provider
          value={{
            ...CONTEXT,
            generation: CONTEXT.generation + 1,
            requester: {
              id: 2,
              name: "Somchai Wattana",
              email: "somchai.wattana@example.ac.th",
            },
          }}
        >
          <MyTickets />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const after = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/tickets")
      ).length;

      expect(after).toBeGreaterThan(before);
    });
  });

  it("asks for the new requester's tickets, not the old one's", async () => {
    const fetchMock = listFetch([ticket(1)]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <MemoryRouter>
        <RequesterContext.Provider value={CONTEXT}>
          <MyTickets />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await screen.findAllByText("TKT-2026-000001");

    rerender(
      <MemoryRouter>
        <RequesterContext.Provider
          value={{
            ...CONTEXT,
            generation: CONTEXT.generation + 1,
            requester: {
              id: 2,
              name: "Somchai Wattana",
              email: "somchai.wattana@example.ac.th",
            },
          }}
        >
          <MyTickets />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Development-Requester-Id": "2",
          }),
        })
      );
    });
  });
});

describe("failure", () => {
  it("reports a failure and offers a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/categories")) {
          return jsonResponse(CATEGORIES);
        }

        throw new TypeError("Failed to fetch");
      })
    );

    renderScreen();

    expect(
      await screen.findByText("Could not load your tickets")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});
