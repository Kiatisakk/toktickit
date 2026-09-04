import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequesterContext } from "../../src/context/requesterContextValue";
import { TicketDetail } from "../../src/routes/TicketDetail";
import {
  CONTEXT,
  jsonResponse,
  renderAt,
  respond,
  TICKET,
} from "./ticketDetailHarness";

/**
 * The Requester Ticket Detail screen (§12 names this file).
 *
 * The weight here is on what the screen refuses to do. A ticket that is not
 * yours must look exactly like a ticket that does not exist — the API declines
 * to tell the two apart, and this screen must not undo that by wording them
 * differently. Nothing on it may change the ticket, because Lab 2 gives a
 * Requester no way to.
 *
 * The attachment lifecycle rendered inside it has its own suite, in
 * `AttachmentSection.test.tsx`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a ticket you own", () => {
  /*
   * The screen has no heading of its own, as Figure 1 has none.
   *
   * It used to open with an h1 of the ticket number over a subtitle of the
   * summary — both of which are fields in the card immediately beneath, so a
   * reader met the same two values twice and the card started further down for
   * no reason.
   */
  it("shows the ticket number and summary as fields, not as a heading", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(await screen.findByLabelText("Ticket No.")).toHaveValue(
      "TKT-2026-000042"
    );
    expect(screen.getByLabelText("Summary")).toHaveValue(
      "Laptop battery drains quickly"
    );
  });

  // A departure from Figure 1, which has no heading here: a page whose first
  // line names what you are looking at is easier to arrive at than one opening
  // straight into a grid of labels.
  it("names the ticket in a heading above the card", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByRole("heading", { name: "TKT-2026-000042" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Laptop battery drains quickly").length
    ).toBeGreaterThan(0);
  });

  it("puts Back to My Tickets beside that heading", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    const { container } = renderAt();

    await screen.findByLabelText("Ticket No.");

    const header = container.querySelector(".tkt-list-header");

    expect(
      within(header as HTMLElement).getByRole("button", {
        name: "Back to My Tickets",
      })
    ).toBeInTheDocument();
  });

  it("shows the description, which the list never carries", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("It started after last week's update.")
    ).toBeInTheDocument();
  });

  it("scopes the request to the current requester", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/42"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Development-Requester-Id": "1",
          }),
        })
      );
    });
  });

  // §8.5: read-only, with no control that could change a system-managed value.
  it.each(["Ticket No.", "Ticket Date", "Requester", "Summary"])(
    "renders %s read-only",
    async (label) => {
      vi.stubGlobal("fetch", respond(TICKET));

      renderAt();

      expect(await screen.findByLabelText(label)).toHaveAttribute("readonly");
    }
  );

  it("offers no control that could change the ticket", async () => {
    const { container } = renderAt();

    vi.stubGlobal("fetch", respond(TICKET));

    await waitFor(() => {
      for (const input of container.querySelectorAll("input")) {
        // The file input is the one writable control, and it adds rather than
        // edits.
        expect(input.hasAttribute("readonly") || input.type === "file").toBe(
          true
        );
      }
    });
  });

  /**
   * The three fields Lab 2 never populates are present and say why.
   *
   * §4.2 excludes the work that fills them, not the fact that they exist. A
   * missing field tells a requester nothing; an empty one tells them nobody has
   * triaged this yet (D-04).
   */
  it("says an unset IT Priority is unset", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("Not set until IT triages this ticket")
    ).toBeInTheDocument();
  });

  it("says the ticket has no owner yet", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(await screen.findByLabelText("Ticket Owner")).toHaveValue(
      "Not yet assigned"
    );
  });

  it("shows the resolution placeholder the figure draws", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("No resolution summary available yet.")
    ).toBeInTheDocument();
  });

  // Figure 1 draws four tabs and §4.2 excludes the features behind three of
  // them. Drawing them disabled would advertise a screen this lab must not
  // build.
  it.each([
    "Public Comments",
    "Internal Notes",
    "Service Actions",
    "Event Log",
  ])("does not offer %s", async (excluded) => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    await screen.findByLabelText("Ticket No.");
    expect(screen.queryByText(excluded)).toBeNull();
  });
});

/**
 * Reported from the running screen.
 *
 * Three of the eight fields render a badge rather than an input, and they had
 * the height of a field and none of the box — so Requested Priority, IT
 * Priority and Current Status looked like they had lost their frames while the
 * five around them kept theirs. Figure 1 draws the pill inside the grey
 * read-only box.
 */
describe("the badge fields", () => {
  it("gives each of the three a box, as the fields beside them have", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    const { container } = renderAt();

    await screen.findByLabelText("Ticket No.");
    expect(container.querySelectorAll(".tkt-readonly-badge")).toHaveLength(3);
  });

  it("puts the badge inside the box rather than beside it", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    const { container } = renderAt();

    await screen.findByLabelText("Ticket No.");

    for (const box of container.querySelectorAll(".tkt-readonly-badge")) {
      expect(box.querySelector(".tkt-badge")).not.toBeNull();
    }
  });

  // Two cards stacked with nothing between them read as one, and the detail
  // screen is the first place two of them meet.
  it("keeps the attachment section a separate card", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    const { container } = renderAt();

    await screen.findByLabelText("Ticket No.");
    expect(container.querySelectorAll(".tkt-card")).toHaveLength(2);
  });
});

describe("loading", () => {
  // No test in this file had ever asserted the loading state existed at all.
  it("shows a loading state before the response arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );

    renderAt();

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});

/**
 * `generation` is in the fetch effect's dependency list so that switching
 * requester re-asks (see the comment above `load` in TicketDetail.tsx), but
 * nothing had ever exercised the case that makes that matter: the URL
 * survives a requester switch, and a ticket that belonged to the old
 * requester must stop being shown the moment the new one cannot see it.
 */
describe("switching requester", () => {
  it("turns a ticket that was visible into not-found once it belongs to someone else", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;

      if (headers?.["X-Development-Requester-Id"] === "1") {
        return Promise.resolve(jsonResponse(TICKET));
      }

      // The API answers a stranger's ticket exactly as a missing one.
      return Promise.resolve(
        jsonResponse(
          { error: { code: "TICKET_NOT_FOUND", message: "Not found." } },
          404
        )
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <MemoryRouter initialEntries={["/tickets/42"]}>
        <RequesterContext.Provider value={CONTEXT}>
          <Routes>
            <Route element={<TicketDetail />} path="/tickets/:ticketId" />
          </Routes>
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByLabelText("Ticket No.")).toHaveValue(
      "TKT-2026-000042"
    );

    rerender(
      <MemoryRouter initialEntries={["/tickets/42"]}>
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
          <Routes>
            <Route element={<TicketDetail />} path="/tickets/:ticketId" />
          </Routes>
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });
});

describe("a ticket that is not yours", () => {
  const refused = () =>
    respond(
      { error: { code: "TICKET_NOT_FOUND", message: "Not found." } },
      404
    );

  it("says it cannot be found", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });

  // The screen must not undo at the last moment what the API is careful about:
  // "yours but missing" and "someone else's" are one answer.
  it("does not distinguish it from a ticket that does not exist", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    const description = await screen.findByText(
      "This ticket does not exist, or it belongs to another requester."
    );

    expect(description).toBeInTheDocument();
  });

  it("offers a way back rather than a dead end", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    await screen.findByText("Ticket not found");
    expect(
      screen.getByRole("button", { name: "Back to My Tickets" })
    ).toBeInTheDocument();
  });

  // A path that cannot be an identifier is answered without asking.
  it.each(["/tickets/abc", "/tickets/1.5", "/tickets/-1"])(
    "refuses %s without calling the API",
    async (path) => {
      const fetchMock = respond(TICKET);
      vi.stubGlobal("fetch", fetchMock);

      renderAt(path);

      await screen.findByText("Ticket not found");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});

describe("failure", () => {
  it("reports a failure that is not a refusal, and offers a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );

    renderAt();

    expect(
      await screen.findByText("Could not load the ticket")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  /**
   * The server's own words, not ours.
   *
   * It names the rule that was broken — which limit, which type — and a message
   * of our own would either repeat it or contradict it.
   */
});
