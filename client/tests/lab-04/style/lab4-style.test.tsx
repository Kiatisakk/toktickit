import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionForm } from "../../../src/components/ActionForm";
import { ActionsList } from "../../../src/components/ActionsList";
import { AppShell } from "../../../src/components/AppShell";
import { Badge } from "../../../src/components/Badge";
import { ResolveDialog } from "../../../src/components/ResolveDialog";
import { AuthContext } from "../../../src/context/authContextValue";
import type { TicketAction, TicketDetail } from "../../../src/lib/api";
import { RequesterDashboard } from "../../../src/routes/RequesterDashboard";
import { StaffDashboard } from "../../../src/routes/StaffDashboard";
import { TICKET } from "../../lab-02/ticketDetailHarness";
import { authContext, renderWithAuth, STAFF_USER } from "../../support/auth";
import { REQUESTER_DASHBOARD, STAFF_DASHBOARD } from "../../support/dashboards";
import { jsonResponse } from "../../support/http";

/**
 * STYLE-01 to STYLE-06 — the Lab 4 screens' markers, classes and accessibility
 * attributes (ui-spec.md sections 3, 6, 7 and 9; AC-39, AC-40, AC-43).
 *
 * Class names, words and attributes, never colours: jsdom resolves no
 * stylesheet, so how a card or a badge looks belongs to the browser suite
 * (RESP-01 to RESP-05).
 */

const action = (over: Partial<TicketAction> = {}): TicketAction => ({
  id: 1,
  ticketId: 42,
  state: "PLANNED",
  actionAt: "2026-09-05T03:15:00.000Z",
  description: "Replaced the faulty access point",
  result: null,
  followUpRequired: false,
  followUpNote: null,
  followUpState: "NOT_REQUIRED",
  followsUpId: null,
  attachmentNotes: null,
  cancelReason: null,
  recordedBy: { id: 11, name: "Michael Brown" },
  performedBy: { id: 11, name: "Michael Brown" },
  version: 1,
  createdAt: "2026-09-05T02:50:00.000Z",
  updatedAt: "2026-09-05T02:50:00.000Z",
  ...over,
});

const FOUR_ACTIONS: TicketAction[] = [
  action({ id: 1, state: "PLANNED" }),
  action({
    id: 2,
    state: "DONE",
    result: "Signal restored.",
    followUpRequired: true,
    followUpNote: "Check next week.",
    followUpState: "OPEN",
  }),
  action({
    id: 3,
    state: "CANCELLED",
    cancelReason: "Not needed",
    followUpRequired: true,
    followUpNote: "Void note",
    followUpState: "VOID",
  }),
  action({
    id: 4,
    state: "DONE",
    result: "Verified.",
    followsUpId: 2,
    followUpRequired: true,
    followUpNote: "Closed by this",
    followUpState: "CLOSED",
  }),
];

const stubFetch = (body: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(jsonResponse(body)))
  );
};

const headingLevels = (): number[] =>
  screen.getAllByRole("heading").map((heading) => Number(heading.tagName[1]));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("STYLE-01 badges", () => {
  it("renders every Action state through the one badge component, carrying its word", () => {
    const { container } = render(
      <>
        {(["PLANNED", "DONE", "CANCELLED"] as const).map((state) => (
          <Badge key={state} kind="action" value={state} />
        ))}
      </>
    );

    const badges = [...container.querySelectorAll(".tkt-badge")];

    expect(badges.map((badge) => badge.textContent)).toStrictEqual([
      "Planned",
      "Done",
      "Cancelled",
    ]);

    for (const badge of badges) {
      expect(badge).toHaveAttribute("data-kind", "action");
    }

    expect(badges.map((badge) => badge.className)).toStrictEqual([
      "tkt-badge tkt-badge--planned",
      "tkt-badge tkt-badge--done",
      "tkt-badge tkt-badge--cancelled",
    ]);
  });

  it("renders every follow-up state through it too, Not required in two words", () => {
    const { container } = render(
      <>
        {(["NOT_REQUIRED", "OPEN", "CLOSED", "VOID"] as const).map((state) => (
          <Badge key={state} kind="followUp" value={state} />
        ))}
      </>
    );

    expect(
      [...container.querySelectorAll(".tkt-badge")].map(
        (badge) => badge.textContent
      )
    ).toStrictEqual(["Not required", "Open", "Closed", "Void"]);
  });

  it("draws the State and Follow-up cells of the Actions list as badges, not as bare text", () => {
    render(
      <MemoryRouter>
        <ActionsList actions={FOUR_ACTIONS} onCommand={vi.fn()} writable />
      </MemoryRouter>
    );

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(FOUR_ACTIONS.length);

    for (const row of rows) {
      const state = row.querySelector('td[data-label="State"]');
      const followUp = row.querySelector('td[data-label="Follow-up"]');

      expect(state?.querySelector('.tkt-badge[data-kind="action"]')).not.toBe(
        null
      );
      expect(
        followUp?.querySelector('.tkt-badge[data-kind="followUp"]')
      ).not.toBe(null);
      // Nothing but the badge carries the state's word.
      expect(state?.textContent).toBe(
        state?.querySelector(".tkt-badge")?.textContent
      );
    }
  });
});

describe("STYLE-02 metric cards", () => {
  const cardsOf = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLElement>("[data-card]"),
  ];

  it("are anchors with a destination and a name on the staff dashboard, never clickable divs", async () => {
    stubFetch(STAFF_DASHBOARD);

    const { container } = renderWithAuth(<StaffDashboard />, {
      context: authContext({ user: STAFF_USER }),
      path: "/dashboard",
    });

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    const cards = cardsOf(container);

    expect(cards).toHaveLength(8);

    for (const card of cards) {
      expect(card.tagName).toBe("A");
      expect(card).toHaveClass("tkt-metric");
      expect(card).toHaveAttribute("href");
      expect(card.getAttribute("aria-label")).toMatch(/\d/u);
      // A link is in the tab order on its own; a tabindex of -1 would remove it.
      expect(card).not.toHaveAttribute("tabindex", "-1");
      expect(card).not.toHaveAttribute("role");
      expect(card).not.toHaveAttribute("onclick");
    }

    expect(container.querySelectorAll("div[data-card]")).toHaveLength(0);
  });

  it("are focusable in order and the focus marker is a rule of the stylesheet, not inline", async () => {
    stubFetch(REQUESTER_DASHBOARD);

    const { container } = renderWithAuth(<RequesterDashboard />, {
      context: authContext(),
      path: "/dashboard",
    });

    await screen.findAllByRole("link", { name: /view all/iu });

    const user = userEvent.setup();
    const cards = cardsOf(container);

    expect(cards).toHaveLength(4);

    for (const card of cards) {
      card.focus();

      expect(card).toHaveFocus();
      expect(card.getAttribute("style")).toBeNull();
    }

    // The visible focus ring lives in the stylesheet and is measured in the
    // browser (RESP-05); here the cards are shown to be reachable by keyboard.
    cards[0]?.focus();
    await user.tab();

    expect(cards[1]).toHaveFocus();
  });
});

describe("STYLE-03 non-colour cues", () => {
  it("gives every delta words as well as an arrow, and the accessible name in words alone", async () => {
    stubFetch(STAFF_DASHBOARD);

    renderWithAuth(<StaffDashboard />, {
      context: authContext({ user: STAFF_USER }),
      path: "/dashboard",
    });

    const up = await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(up).toHaveTextContent("▲ +3 from yesterday");
    expect(up.getAttribute("aria-label")).toBe(
      "New, 14 tickets, up 3 from yesterday"
    );
    expect(
      screen.getByRole("link", { name: /^Open, 9 tickets/u })
    ).toHaveTextContent("▼ −1 from yesterday");
    expect(
      screen.getByRole("link", { name: /^In Progress, 6 tickets/u })
    ).toHaveTextContent("No change from yesterday");
  });

  it("gives Action state and follow-up status text in the badge, not colour", () => {
    render(
      <MemoryRouter>
        <ActionsList actions={FOUR_ACTIONS} onCommand={vi.fn()} writable />
      </MemoryRouter>
    );

    for (const word of [
      "Planned",
      "Done",
      "Cancelled",
      "Open",
      "Void",
      "Closed",
    ]) {
      expect(document.querySelectorAll(".tkt-badge").length).toBeGreaterThan(0);
      expect(
        [...document.querySelectorAll(".tkt-badge")].some(
          (badge) => badge.textContent === word
        )
      ).toBe(true);
    }
  });

  it("marks the active navigation item with aria-current and a modifier class, not a colour alone", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthContext.Provider value={authContext({ user: STAFF_USER })}>
          <AppShell>content</AppShell>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: /primary/iu });
    const links = within(nav).getAllByRole("link");
    const current = links.filter(
      (link) => link.getAttribute("aria-current") === "page"
    );

    expect(links[0]).toHaveTextContent("Dashboard");
    expect(current).toStrictEqual([links[0]]);
    expect(current[0]).toHaveClass("tkt-nav-link--active");
  });
});

describe("STYLE-04 structure", () => {
  it("has one h1 and headings that never skip a level on the staff dashboard", async () => {
    stubFetch(STAFF_DASHBOARD);

    renderWithAuth(<StaffDashboard />, {
      context: authContext({ user: STAFF_USER }),
      path: "/dashboard",
    });

    await screen.findByRole("link", { name: /^New, 14 tickets/u });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const levels = headingLevels();

    expect(levels[0]).toBe(1);

    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] ?? 0).toBeLessThanOrEqual(
        (levels[index - 1] ?? 0) + 1
      );
    }
  });

  it("has one h1 and ordered headings on the Requester dashboard", async () => {
    stubFetch(REQUESTER_DASHBOARD);

    renderWithAuth(<RequesterDashboard />, {
      context: authContext(),
      path: "/dashboard",
    });

    await screen.findAllByRole("link", { name: /view all/iu });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const levels = headingLevels();

    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] ?? 0).toBeLessThanOrEqual(
        (levels[index - 1] ?? 0) + 1
      );
    }
  });

  it("gives the Actions list a caption and a column header for every column", () => {
    render(
      <MemoryRouter>
        <ActionsList actions={FOUR_ACTIONS} onCommand={vi.fn()} writable />
      </MemoryRouter>
    );

    const table = screen.getByRole("table", { name: "Actions taken" });
    const headers = within(table).getAllByRole("columnheader");

    expect(headers.map((header) => header.textContent)).toStrictEqual([
      "Date/time",
      "Description",
      "Performed by",
      "State",
      "Follow-up",
      "Row actions",
    ]);

    for (const header of headers) {
      expect(header).toHaveAttribute("scope", "col");
    }

    // Every body cell names its column, which is what the stacked card layout
    // below 768px reads from.
    for (const cell of table.querySelectorAll("tbody td")) {
      if (!cell.classList.contains("tkt-actions-table__row-actions")) {
        expect(cell).toHaveAttribute("data-label");
      }
    }
  });
});

describe("STYLE-05 form labelling", () => {
  const renderForm = (editing: TicketAction | null) => {
    stubFetch([{ id: 11, name: "Michael Brown" }]);

    return renderWithAuth(
      <ActionForm
        actions={FOUR_ACTIONS}
        editing={editing}
        onCancel={vi.fn()}
        onRefused={vi.fn()}
        onSaved={vi.fn()}
        reloadActions={() => Promise.resolve(null)}
        reloadTicket={() => Promise.resolve(true)}
        ticketId={42}
      />,
      { context: authContext({ user: STAFF_USER }), path: "/tickets/42" }
    );
  };

  it("binds a label to every field of the create form", async () => {
    renderForm(null);

    const form = await screen.findByRole("form", { name: "Add action" });
    const controls = [
      ...form.querySelectorAll<HTMLElement>("input, select, textarea"),
    ];

    expect(controls.length).toBeGreaterThanOrEqual(6);

    for (const control of controls) {
      // Resolved by the label association itself, not by a name attribute.
      expect(
        control.id,
        `${control.getAttribute("name")} needs an id for its label`
      ).not.toBe("");
      expect(
        form.querySelector(`label[for="${CSS.escape(control.id)}"]`),
        `${control.getAttribute("name")} has no bound label`
      ).not.toBe(null);
    }
  });

  it("associates every error with its field by aria-describedby", async () => {
    renderForm(null);

    const user = userEvent.setup();
    const form = await screen.findByRole("form", { name: "Add action" });

    await user.click(screen.getByRole("button", { name: /save/iu }));

    const description = within(form).getByLabelText(/^Description/u);
    const message = await screen.findByText("Enter a description.");

    await waitFor(() => {
      expect(description).toHaveAttribute("aria-invalid", "true");
    });

    const described = (description.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id));

    expect(described).toContain(message);
  });

  it("shows the fixed link of an edited Action as read-only text with no label and no control", async () => {
    renderForm(FOUR_ACTIONS[3] ?? null);

    const form = await screen.findByRole("form", { name: "Edit action #4" });

    expect(within(form).queryByLabelText(/follows up/iu)).toBeNull();
    expect(form.querySelector("label[for]")).not.toBeNull();

    const labels = [...form.querySelectorAll("label")].map(
      (label) => label.textContent
    );

    expect(labels.some((text) => /follows up/iu.test(text ?? ""))).toBe(false);
    expect(form.textContent).toContain("Action #2");
    expect(form.querySelector('[name="followsUpId"]')).toBeNull();
  });
});

describe("STYLE-06 the resolve dialog", () => {
  it("is a modal dialog with an accessible name that names the ticket", async () => {
    stubFetch({ data: [] });

    const ticket = { ...TICKET, version: 1 } as unknown as TicketDetail;

    render(
      <ResolveDialog
        onClose={vi.fn()}
        onResolved={vi.fn()}
        onStale={() => Promise.resolve(true)}
        ticket={ticket}
      />
    );

    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(
      `Resolve ticket ${TICKET.ticketNumber}`
    );
    expect(dialog.getAttribute("aria-labelledby")).not.toBeNull();
    expect(
      within(dialog).getByRole("heading", { name: /^Resolve ticket/u })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("list", { name: "Conditions for resolving" })
    ).toBeInTheDocument();
  });
});
