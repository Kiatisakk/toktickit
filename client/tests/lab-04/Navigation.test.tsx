import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/components/AppShell";
import { AuthContext } from "../../src/context/authContextValue";
import { Dashboard } from "../../src/routes/Dashboard";
import { Login } from "../../src/routes/Login";
import { router as appRouter } from "../../src/routes/router";
import {
  ADMIN_USER,
  authContext,
  JENNIFER_USER,
  renderWithAuth,
  STAFF_USER,
} from "../support/auth";
import { REQUESTER_DASHBOARD, STAFF_DASHBOARD } from "../support/dashboards";
import { jsonResponse } from "../support/http";

/**
 * UI-14 to UI-16 — `/dashboard` is every role's landing page and the first
 * navigation item (ui-spec.md section 2; FR-21; D-12; AC-38).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubDashboards = () => {
  const fetchMock = vi.fn((input: string) => {
    const path = new URL(input).pathname;

    if (path === "/api/dashboard/staff") {
      return Promise.resolve(jsonResponse(STAFF_DASHBOARD));
    }

    if (path === "/api/dashboard/requester") {
      return Promise.resolve(jsonResponse(REQUESTER_DASHBOARD));
    }

    return Promise.resolve(jsonResponse([]));
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const paths = (fetchMock: ReturnType<typeof stubDashboards>) =>
  fetchMock.mock.calls.map(([input]) => new URL(input).pathname);

describe("UI-14 the role chooses the dashboard", () => {
  it.each([
    { who: "IT Staff", user: STAFF_USER },
    { who: "an Administrator", user: ADMIN_USER },
  ])("renders the staff view for $who", async ({ user }) => {
    const fetchMock = stubDashboards();

    renderWithAuth(<Dashboard />, {
      context: authContext({ user }),
      path: "/dashboard",
    });

    expect(
      await screen.findByRole("link", { name: /^New, 14 tickets/u })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `Welcome back, ${user.name}`
    );
    expect(paths(fetchMock)).toEqual(["/api/dashboard/staff"]);
  });

  it("renders the Requester view for a Requester", async () => {
    const fetchMock = stubDashboards();

    renderWithAuth(<Dashboard />, {
      context: authContext({ user: JENNIFER_USER }),
      path: "/dashboard",
    });

    expect(
      await screen.findByRole("link", { name: /^Open, 3 tickets/u })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `Welcome, ${JENNIFER_USER.name}`
    );
    expect(screen.queryByText("Reopened")).not.toBeInTheDocument();
    expect(paths(fetchMock)).toEqual(["/api/dashboard/requester"]);
  });
});

describe("UI-15 Dashboard is first in navigation", () => {
  const destinations = () =>
    [
      ...screen
        .getByRole("navigation", { name: "Primary" })
        .querySelectorAll("a"),
    ].map((link) => link.textContent);

  it.each([
    {
      who: "a Requester",
      user: JENNIFER_USER,
      expected: ["Dashboard", "My Tickets", "Create Ticket"],
    },
    {
      who: "IT Staff",
      user: STAFF_USER,
      expected: ["Dashboard", "Ticket Queue", "My Tickets", "Create Ticket"],
    },
    {
      who: "an Administrator",
      user: ADMIN_USER,
      expected: [
        "Dashboard",
        "Ticket Queue",
        "User Management",
        "My Tickets",
        "Create Ticket",
      ],
    },
  ])(
    "lists the destinations for $who in ui-spec.md order",
    ({ user, expected }) => {
      renderWithAuth(<AppShell>content</AppShell>, {
        context: authContext({ user }),
      });

      expect(destinations()).toEqual(expected);
    }
  );

  it("marks the Dashboard as current on /dashboard by more than colour", () => {
    renderWithAuth(<AppShell>content</AppShell>, {
      context: authContext({ user: STAFF_USER }),
      path: "/dashboard",
    });

    const link = screen.getByRole("link", { name: "Dashboard" });

    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("tkt-nav-link--active");
  });
});

describe("UI-16 landing", () => {
  const renderApp = (path: string, context: ReturnType<typeof authContext>) => {
    // The application's own route table, so a redirect that was never wired in
    // the real router cannot pass here.
    const memory = createMemoryRouter(appRouter.routes, {
      initialEntries: [path],
    });

    render(
      <AuthContext.Provider value={context}>
        <RouterProvider router={memory} />
      </AuthContext.Provider>
    );

    return memory;
  };

  it.each([
    { who: "a Requester", user: JENNIFER_USER },
    { who: "IT Staff", user: STAFF_USER },
    { who: "an Administrator", user: ADMIN_USER },
  ])("sends / to /dashboard for $who", async ({ user }) => {
    stubDashboards();

    const memory = renderApp("/", authContext({ user }));

    await screen.findByRole("heading", { level: 1, name: /welcome/iu });

    expect(memory.state.location.pathname).toBe("/dashboard");
  });

  it("sends a Requester refused the staff queue to /dashboard", async () => {
    stubDashboards();

    const memory = renderApp(
      "/staff/tickets",
      authContext({ user: JENNIFER_USER })
    );

    await screen.findByRole("heading", { level: 1, name: /welcome/iu });

    expect(memory.state.location.pathname).toBe("/dashboard");
  });

  it("sends a non-Administrator refused User Management to /dashboard", async () => {
    stubDashboards();

    const memory = renderApp("/admin/users", authContext({ user: STAFF_USER }));

    await screen.findByRole("heading", { level: 1, name: /welcome/iu });

    expect(memory.state.location.pathname).toBe("/dashboard");
  });

  it("still sends a user who must change their password to /change-password", async () => {
    stubDashboards();

    const memory = renderApp(
      "/dashboard",
      authContext({ user: JENNIFER_USER, mustChangePassword: true })
    );

    await screen.findByRole("heading", { level: 1 });

    expect(memory.state.location.pathname).toBe("/change-password");
  });

  it("lands sign-in on /dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ user: STAFF_USER, mustChangePassword: false })
        )
      )
    );

    const memory = createMemoryRouter(
      [
        { path: "/login", element: <Login /> },
        { path: "/dashboard", element: <h1>Dashboard landing</h1> },
      ],
      { initialEntries: ["/login"] }
    );

    render(
      <AuthContext.Provider
        value={authContext({ status: "anonymous", user: null })}
      >
        <RouterProvider router={memory} />
      </AuthContext.Provider>
    );

    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/email/iu),
      "michael.brown@example.ac.th"
    );
    await user.type(screen.getByLabelText(/^password/iu), "ItStaff1!");
    await user.click(screen.getByRole("button", { name: /sign in/iu }));

    await screen.findByRole("heading", { name: "Dashboard landing" });

    expect(memory.state.location.pathname).toBe("/dashboard");
  });
});
