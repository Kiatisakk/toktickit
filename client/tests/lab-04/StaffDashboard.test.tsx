import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffDashboard } from "../../src/routes/StaffDashboard";
import { authContext, renderWithAuth, STAFF_USER } from "../support/auth";
import { STAFF_DASHBOARD, zeroed } from "../support/dashboards";
import { jsonResponse } from "../support/http";

/**
 * UI-01 to UI-09 — the staff dashboard (ui-spec.md section 3; FR-18; AC-28,
 * AC-31, AC-39).
 *
 * `fetch` answers the one dashboard endpoint, so a screen that built a card from
 * anything but the response could not pass.
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
  renderWithAuth(<StaffDashboard />, {
    context: authContext({ user: STAFF_USER }),
    path: "/dashboard",
  });

const cardLinks = () => [
  ...document.querySelectorAll<HTMLAnchorElement>("a[data-card]"),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-01 the cards", () => {
  it("shows eight cards in order, with their labels and values from the API", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(cardLinks().map((link) => link.dataset["card"])).toEqual([
      "new",
      "open",
      "in-progress",
      "waiting",
      "reopened",
      "my-assigned",
      "unassigned",
      "my-follow-ups",
    ]);
    expect(
      cardLinks().map((link) => link.textContent?.replaceAll(" ", ""))
    ).toEqual([
      "New14▲ +3 from yesterday",
      "Open9▼ −1 from yesterday",
      "In Progress6No change from yesterday",
      "Waiting for Requester2No change from yesterday",
      "Reopened1▲ +1 from yesterday",
      "My Assigned5",
      "Unassigned4",
      "My open follow-ups1",
    ]);
  });

  it("asks only the staff endpoint, sending no identity", async () => {
    const fetchMock = stubFetch(ok(STAFF_DASHBOARD));

    renderDashboard();
    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(new URL(url).pathname).toBe("/api/dashboard/staff");
    expect(new URL(url).search).toBe("");
    expect(init.body).toBeUndefined();
  });
});

describe("UI-02 a card is one link", () => {
  it("is a single anchor to the drill-down the API returned, named in words", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const hrefs = Object.fromEntries(
      cardLinks().map((link) => [
        link.dataset["card"],
        link.getAttribute("href"),
      ])
    );

    expect(hrefs).toEqual({
      new: "/staff/tickets?status=NEW",
      open: "/staff/tickets?status=OPEN",
      "in-progress": "/staff/tickets?status=IN_PROGRESS",
      waiting: "/staff/tickets?status=WAITING_FOR_REQUESTER",
      reopened: "/staff/tickets?status=REOPENED",
      "my-assigned": "/staff/tickets?ownerId=11&statusGroup=open",
      unassigned: "/staff/tickets?unassigned=true&statusGroup=open",
      "my-follow-ups": "/staff/tickets?followUp=mine",
    });

    for (const link of cardLinks()) {
      expect(link.querySelectorAll("a, button")).toHaveLength(0);
    }

    expect(
      screen.getByRole("link", {
        name: "New, 14 tickets, up 3 from yesterday",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open, 9 tickets, down 1 from yesterday",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "In Progress, 6 tickets, no change from yesterday",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My Assigned, 5 tickets" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My open follow-ups, 1 ticket" })
    ).toBeInTheDocument();
  });

  it("can be reached and activated from the keyboard", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    const first = await screen.findByRole("link", {
      name: /^New, 14 tickets/u,
    });

    first.focus();

    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("href");
    expect(first).not.toHaveAttribute("tabindex", "-1");
  });
});

describe("UI-03 delta text", () => {
  it("shows an arrow and words for up, down and no change, and nothing for a null delta", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const text = (card: string) =>
      document
        .querySelector(`a[data-card="${card}"] .tkt-metric__delta`)
        ?.textContent?.replaceAll(" ", "");

    expect(text("new")).toBe("▲ +3 from yesterday");
    expect(text("open")).toBe("▼ −1 from yesterday");
    expect(text("in-progress")).toBe("No change from yesterday");

    for (const card of ["my-assigned", "unassigned", "my-follow-ups"]) {
      expect(text(card)).toBe("");
    }
  });

  it("keeps every card the same height whether or not it has a delta", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    // The delta line is always present, empty for the cards without one, so a
    // row of cards stays aligned.
    expect(document.querySelectorAll(".tkt-metric__delta")).toHaveLength(8);
  });
});

describe("UI-04 loading", () => {
  it("shows placeholders and an announced Loading dashboard, with no figures", () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    renderDashboard();

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    expect(document.querySelectorAll(".tkt-metric--placeholder")).toHaveLength(
      8
    );
    expect(cardLinks()).toHaveLength(0);
    expect(screen.queryByText("14")).not.toBeInTheDocument();
  });
});

describe("UI-05 zero state", () => {
  it("keeps every card, linked, at 0, and says the recent list is empty", async () => {
    stubFetch(ok(zeroed(STAFF_DASHBOARD)));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 0 tickets/u });

    expect(cardLinks()).toHaveLength(8);

    for (const link of cardLinks()) {
      expect(link).toHaveAttribute("href");
      expect(link.querySelector(".tkt-metric__value")).toHaveTextContent("0");
    }

    expect(
      screen.getByText("No tickets assigned to you yet.")
    ).toBeInTheDocument();
    // Quick Actions are still there beside the empty message.
    expect(
      within(screen.getByRole("region", { name: "Quick Actions" })).getByRole(
        "link",
        { name: /create ticket/iu }
      )
    ).toBeInTheDocument();
  });
});

describe("UI-06 failure", () => {
  it("shows a safe message and Try again, which retries", async () => {
    const fetchMock = stubFetch(
      refused(500, "INTERNAL_ERROR"),
      ok(STAFF_DASHBOARD)
    );

    renderDashboard();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(
      "The dashboard could not be loaded. Try again."
    );
    expect(alert).not.toHaveTextContent("must never be shown");
    expect(cardLinks()).toHaveLength(0);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps Refresh available beside the failure", async () => {
    stubFetch(refused(500, "INTERNAL_ERROR"));
    renderDashboard();

    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: /refresh/iu })).toBeEnabled();
  });
});

describe("UI-07 forbidden", () => {
  it("shows the access message and no numbers", async () => {
    stubFetch(refused(403, "FORBIDDEN"));
    renderDashboard();

    expect(
      await screen.findByText("You do not have access to this dashboard.")
    ).toBeInTheDocument();
    expect(cardLinks()).toHaveLength(0);
    expect(screen.queryByText("14")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument();
  });
});

describe("UI-08 Refresh and Quick Actions", () => {
  it("disables Refresh while busy, keeps the figures, and refetches", async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetchMock = stubFetch(
      ok(STAFF_DASHBOARD),
      () =>
        // oxlint-disable-next-line promise/avoid-new
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );

    renderDashboard();
    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const refresh = screen.getByRole("button", { name: /^refresh$/iu });

    expect(refresh).toBeEnabled();

    await userEvent.setup().click(refresh);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const busy = screen.getByRole("button", { name: /refreshing/iu });

    expect(busy).toBeDisabled();
    // The old figures stay until the new ones arrive.
    expect(
      screen.getByRole("link", { name: /^New, 14 tickets/u })
    ).toBeInTheDocument();

    finish(
      jsonResponse({
        ...STAFF_DASHBOARD,
        cards: STAFF_DASHBOARD.cards.map((card) =>
          card.key === "new" ? { ...card, count: 15, delta: 4 } : card
        ),
      })
    );

    expect(
      await screen.findByRole("link", { name: /^New, 15 tickets/u })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^refresh$/iu })).toBeEnabled();
  });

  it("links Create Ticket, Search Tickets and My Queue where specified", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const quick = within(screen.getByRole("region", { name: "Quick Actions" }));

    expect(
      quick.getByRole("link", { name: /create ticket/iu })
    ).toHaveAttribute("href", "/tickets/new");
    expect(
      quick.getByRole("link", { name: /search tickets/iu })
    ).toHaveAttribute("href", "/staff/tickets");
    expect(quick.getByRole("link", { name: /my queue/iu })).toHaveAttribute(
      "href",
      "/staff/tickets?ownerId=11&statusGroup=open"
    );
  });
});

describe("UI-09 My Recent Tickets", () => {
  it("shows number, summary, status badge and time, linking each row", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const recent = within(
      screen.getByRole("region", { name: "My Recent Tickets" })
    );
    const rows = recent.getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement).getByRole("link", {
        name: "TKT-2026-000007",
      })
    ).toHaveAttribute("href", "/tickets/7");
    expect(rows[0]).toHaveTextContent("VPN drops every hour");
    expect(rows[0]).toHaveTextContent("In Progress");
    expect(rows[0]?.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-10-05T03:15:00.000Z"
    );
    // The word, not only a colour (ui-spec.md section 8).
    expect(rows[1]).toHaveTextContent("Waiting for Requester");
  });

  it("sends View all to the caller's own Tickets", async () => {
    stubFetch(ok(STAFF_DASHBOARD));
    renderDashboard();

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/staff/tickets?ownerId=11"
    );
  });
});
