import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequesterDashboard } from "../../src/routes/RequesterDashboard";
import { authContext, JENNIFER_USER, renderWithAuth } from "../support/auth";
import { REQUESTER_DASHBOARD, zeroed } from "../support/dashboards";
import { jsonResponse } from "../support/http";

/**
 * UI-10 to UI-13 — the Requester dashboard (ui-spec.md section 4; FR-17;
 * AC-31, AC-33, AC-39).
 */

const stubFetch = (...answers: (() => Promise<Response>)[]) => {
  const queue = [...answers];
  const fetchMock = vi.fn(() => {
    const next = queue.length > 1 ? queue.shift() : queue[0];

    return next ? next() : Promise.reject(new Error("no answer"));
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const ok = (body: unknown) => () => Promise.resolve(jsonResponse(body));
const refused = (status: number, code: string) => () =>
  Promise.resolve(
    jsonResponse(
      { error: { code, message: "A message that must never be shown." } },
      status
    )
  );

const renderDashboard = () =>
  renderWithAuth(<RequesterDashboard />, {
    context: authContext({ user: JENNIFER_USER }),
    path: "/dashboard",
  });

const cardLinks = () => [
  ...document.querySelectorAll<HTMLAnchorElement>("a[data-card]"),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-10 the cards", () => {
  it("shows four cards linking to My Tickets, each with a View all and no delta", async () => {
    const fetchMock = stubFetch(ok(REQUESTER_DASHBOARD));

    renderDashboard();

    await screen.findByRole("link", { name: /^Open, 3 tickets/u });

    expect(
      cardLinks().map((link) => [
        link.dataset["card"],
        link.getAttribute("href"),
      ])
    ).toEqual([
      ["open", "/my-tickets?statusGroup=open"],
      ["waiting-for-me", "/my-tickets?status=WAITING_FOR_REQUESTER"],
      ["resolved", "/my-tickets?status=RESOLVED"],
      ["closed", "/my-tickets?status=CLOSED"],
    ]);

    for (const link of cardLinks()) {
      expect(link).toHaveTextContent("View all");
      expect(link.querySelector(".tkt-metric__delta")).toHaveTextContent("");
      expect(link.textContent).not.toContain("yesterday");
    }

    expect(
      screen.getByRole("link", { name: "Waiting for me, 1 ticket, view all" })
    ).toBeInTheDocument();

    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(new URL(url).pathname).toBe("/api/dashboard/requester");
    expect(new URL(url).search).toBe("");
  });
});

describe("UI-11 recent list and quick actions", () => {
  it("shows their own recent Tickets with status badges, and the two quick actions", async () => {
    stubFetch(ok(REQUESTER_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^Open, 3 tickets/u });

    const recent = within(
      screen.getByRole("region", { name: "My Recent Tickets" })
    );
    const rows = recent.getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("In Progress");
    // The Requester's attention item says so in words as well as colour.
    expect(rows[1]).toHaveTextContent("Waiting for Requester");
    expect(recent.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/my-tickets"
    );

    const quick = within(screen.getByRole("region", { name: "Quick Actions" }));

    expect(
      quick.getByRole("link", { name: /create ticket/iu })
    ).toHaveAttribute("href", "/tickets/new");
    expect(quick.getByText("Submit a new request")).toBeInTheDocument();
    expect(
      quick.getByRole("link", { name: /view my tickets/iu })
    ).toHaveAttribute("href", "/my-tickets");
    expect(quick.getByText("Track existing requests")).toBeInTheDocument();
  });
});

describe("UI-12 zero state", () => {
  it("keeps four linked cards at 0 and invites a first Ticket", async () => {
    stubFetch(ok(zeroed(REQUESTER_DASHBOARD)));
    renderDashboard();

    await screen.findByRole("link", { name: /^Open, 0 tickets/u });

    expect(cardLinks()).toHaveLength(4);

    for (const link of cardLinks()) {
      expect(link).toHaveAttribute("href");
      expect(link.querySelector(".tkt-metric__value")).toHaveTextContent("0");
    }

    const recent = within(
      screen.getByRole("region", { name: "My Recent Tickets" })
    );

    expect(
      recent.getByText("You haven't raised any tickets yet.")
    ).toBeInTheDocument();

    const create = recent.getByRole("link", { name: "Create Ticket" });

    expect(create).toHaveAttribute("href", "/tickets/new");
    expect(create).toHaveClass("tkt-btn--primary");
  });
});

describe("UI-13 loading, failure and forbidden", () => {
  it("announces loading and shows four placeholders and no figures", () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    renderDashboard();

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    expect(document.querySelectorAll(".tkt-metric--placeholder")).toHaveLength(
      4
    );
    expect(cardLinks()).toHaveLength(0);
  });

  it("shows a safe failure whose Try again recovers", async () => {
    const fetchMock = stubFetch(
      refused(500, "INTERNAL_ERROR"),
      ok(REQUESTER_DASHBOARD)
    );

    renderDashboard();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(
      "The dashboard could not be loaded. Try again."
    );
    expect(alert).not.toHaveTextContent("must never be shown");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: /^Open, 3 tickets/u });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shows the access message and no numbers when refused", async () => {
    stubFetch(refused(403, "FORBIDDEN"));
    renderDashboard();

    expect(
      await screen.findByText("You do not have access to this dashboard.")
    ).toBeInTheDocument();
    expect(cardLinks()).toHaveLength(0);
  });
});
