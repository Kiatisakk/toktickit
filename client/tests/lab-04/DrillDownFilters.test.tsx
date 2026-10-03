import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyTickets } from "../../src/routes/MyTickets";
import { StaffTicketQueue } from "../../src/routes/StaffTicketQueue";
import {
  authContext,
  JENNIFER_USER,
  renderWithAuth,
  STAFF_USER,
} from "../support/auth";
import { jsonResponse } from "../support/http";

/**
 * UI-17 and UI-18 — My Tickets and the Ticket Queue read their initial filters
 * from the address, so a dashboard card opens an already filtered list
 * (ui-spec.md section 5; FR-22; AC-34).
 */

const EMPTY_PAGE = {
  data: [],
  meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
};

const stub = (listPath: string) => {
  const fetchMock = vi.fn((input: string) => {
    const url = new URL(input);

    if (url.pathname === listPath) {
      return Promise.resolve(jsonResponse(EMPTY_PAGE));
    }

    if (url.pathname === "/api/staff/owners") {
      return Promise.resolve(
        jsonResponse([
          { id: 11, name: "Michael Brown" },
          { id: 12, name: "Sarah Johnson" },
        ])
      );
    }

    return Promise.resolve(jsonResponse([{ id: 3, name: "Network" }]));
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const listCalls = (fetchMock: ReturnType<typeof stub>, listPath: string) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(input))
    .filter((url) => url.pathname === listPath);

const lastCall = (fetchMock: ReturnType<typeof stub>, listPath: string) =>
  listCalls(fetchMock, listPath).at(-1) as URL;

const Where = () => {
  const location = useLocation();

  return (
    <output data-testid="where">{location.pathname + location.search}</output>
  );
};

const renderMyTickets = (search: string) =>
  renderWithAuth(
    <>
      <MyTickets />
      <Where />
    </>,
    {
      context: authContext({ user: JENNIFER_USER }),
      path: `/my-tickets${search}`,
    }
  );

const renderQueue = (search: string) =>
  renderWithAuth(
    <>
      <StaffTicketQueue />
      <Where />
    </>,
    {
      context: authContext({ user: STAFF_USER }),
      path: `/staff/tickets${search}`,
    }
  );

const where = () => screen.getByTestId("where").textContent;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-17 My Tickets reads URL filters", () => {
  it("sends statusGroup=open from the address and shows a removable chip", async () => {
    const fetchMock = stub("/api/tickets");

    renderMyTickets("?statusGroup=open");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/tickets")).toHaveLength(1);
    });

    expect(
      lastCall(fetchMock, "/api/tickets").searchParams.get("statusGroup")
    ).toBe("open");
    expect(screen.getByText("Open tickets")).toBeInTheDocument();
    // The header button, enabled because a filter is active (the empty list
    // adds a second one in its no-results message).
    const [clear] = screen.getAllByRole("button", { name: "Clear Filters" });

    expect(clear).toBeEnabled();
  });

  it("removing the chip updates the address and the request", async () => {
    const fetchMock = stub("/api/tickets");

    renderMyTickets("?statusGroup=open");

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Remove the Open tickets filter",
      })
    );

    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
    expect(where()).toBe("/my-tickets");

    await waitFor(() => {
      expect(
        lastCall(fetchMock, "/api/tickets").searchParams.has("statusGroup")
      ).toBe(false);
    });
  });

  it("initialises the request and the visible filter from ?status=RESOLVED", async () => {
    const fetchMock = stub("/api/tickets");

    renderMyTickets("?status=RESOLVED");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/tickets")).toHaveLength(1);
    });

    expect(lastCall(fetchMock, "/api/tickets").searchParams.get("status")).toBe(
      "RESOLVED"
    );
    expect(screen.getByLabelText("Current Status")).toHaveValue("RESOLVED");
    // A status the select shows needs no chip.
    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
  });

  it("writes a changed filter back to the address", async () => {
    stub("/api/tickets");
    renderMyTickets("");

    await userEvent
      .setup()
      .selectOptions(await screen.findByLabelText("Current Status"), "CLOSED");

    expect(where()).toBe("/my-tickets?status=CLOSED");
  });

  it("choosing a status drops the group, which the API would refuse alongside it", async () => {
    const fetchMock = stub("/api/tickets");

    renderMyTickets("?statusGroup=open");

    await userEvent
      .setup()
      .selectOptions(await screen.findByLabelText("Current Status"), "NEW");

    expect(where()).toBe("/my-tickets?status=NEW");

    await waitFor(() => {
      const url = lastCall(fetchMock, "/api/tickets");

      expect(url.searchParams.get("status")).toBe("NEW");
      expect(url.searchParams.has("statusGroup")).toBe(false);
    });
  });

  it("ignores a value the screen would not offer rather than sending it", async () => {
    const fetchMock = stub("/api/tickets");

    renderMyTickets("?status=NOPE&statusGroup=all");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/tickets")).toHaveLength(1);
    });

    const url = lastCall(fetchMock, "/api/tickets");

    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.has("statusGroup")).toBe(false);
  });
});

describe("UI-18 the queue reads URL filters", () => {
  it("sends status, statusGroup, ownerId, unassigned and followUp from the address", async () => {
    const fetchMock = stub("/api/staff/tickets");

    renderQueue("?status=NEW&ownerId=11");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/staff/tickets")).toHaveLength(1);
    });

    const first = lastCall(fetchMock, "/api/staff/tickets");

    expect(first.searchParams.get("status")).toBe("NEW");
    expect(first.searchParams.get("ownerId")).toBe("11");
  });

  it("sends statusGroup with ownerId for My Assigned and shows the chip", async () => {
    const fetchMock = stub("/api/staff/tickets");

    renderQueue("?ownerId=11&statusGroup=open");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/staff/tickets")).toHaveLength(1);
    });

    const url = lastCall(fetchMock, "/api/staff/tickets");

    expect(url.searchParams.get("ownerId")).toBe("11");
    expect(url.searchParams.get("statusGroup")).toBe("open");
    expect(screen.getByText("Open tickets")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Owner")).toHaveValue("11");
    });
  });

  it("sends unassigned=true for the Unassigned card and selects Unassigned", async () => {
    const fetchMock = stub("/api/staff/tickets");

    renderQueue("?unassigned=true&statusGroup=open");

    await waitFor(() => {
      expect(listCalls(fetchMock, "/api/staff/tickets")).toHaveLength(1);
    });

    const url = lastCall(fetchMock, "/api/staff/tickets");

    expect(url.searchParams.get("unassigned")).toBe("true");
    expect(url.searchParams.has("ownerId")).toBe(false);
    expect(screen.getByLabelText("Owner")).toHaveValue("unassigned");
  });

  it("sends followUp=mine and shows its chip, which removal clears from the address and the list", async () => {
    const fetchMock = stub("/api/staff/tickets");

    renderQueue("?followUp=mine");

    await waitFor(() => {
      expect(
        lastCall(fetchMock, "/api/staff/tickets").searchParams.get("followUp")
      ).toBe("mine");
    });

    expect(screen.getByText("My open follow-ups")).toBeInTheDocument();

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Remove the My open follow-ups filter",
      })
    );

    expect(screen.queryByText("My open follow-ups")).not.toBeInTheDocument();
    expect(where()).toBe("/staff/tickets");

    await waitFor(() => {
      expect(
        lastCall(fetchMock, "/api/staff/tickets").searchParams.has("followUp")
      ).toBe(false);
    });
  });

  it("writes Owner back as ownerId, and Unassigned as unassigned=true", async () => {
    stub("/api/staff/tickets");
    renderQueue("");

    const user = userEvent.setup();
    const owner = await screen.findByLabelText("Owner");

    await screen.findByRole("option", { name: "Michael Brown" });
    await user.selectOptions(owner, "11");

    expect(where()).toBe("/staff/tickets?ownerId=11");

    await user.selectOptions(owner, "unassigned");

    expect(where()).toBe("/staff/tickets?unassigned=true");
  });

  it("Clear Filters empties the address as well as the controls", async () => {
    const fetchMock = stub("/api/staff/tickets");

    renderQueue("?ownerId=11&statusGroup=open&followUp=mine");

    const [clear] = await screen.findAllByRole("button", {
      name: "Clear Filters",
    });

    await userEvent.setup().click(clear as HTMLElement);

    expect(where()).toBe("/staff/tickets");
    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();

    await waitFor(() => {
      const url = lastCall(fetchMock, "/api/staff/tickets");

      expect(url.searchParams.has("ownerId")).toBe(false);
      expect(url.searchParams.has("statusGroup")).toBe(false);
      expect(url.searchParams.has("followUp")).toBe(false);
    });
  });
});
