import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { AuthContext } from "../../src/context/authContextValue";
import { AuthGuard, type GuardedArea } from "../../src/routes/AuthGuard";
import { ADMIN_USER, authContext, STAFF_USER } from "../support/auth";

/**
 * UI-26 — the route guard sends each visitor to the screen they may use.
 *
 * Replaces Lab 2's RequesterGuard suite, whose intent — a protected screen is
 * never rendered without an identity, not even for a frame, and a check still
 * in flight waits rather than redirecting — carries over unchanged. What
 * changed is where the identity comes from.
 */

const renderAt = (
  context: ReturnType<typeof authContext>,
  { path = "/my-tickets", area }: { path?: string; area?: GuardedArea } = {}
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={context}>
        <Routes>
          <Route element={<h1>Sign in</h1>} path="/login" />
          <Route
            element={
              <AuthGuard area="password-change">
                <h1>Change password</h1>
              </AuthGuard>
            }
            path="/change-password"
          />
          <Route
            element={
              <AuthGuard {...(area ? { area } : {})}>
                <h1>Protected screen</h1>
              </AuthGuard>
            }
            path="/my-tickets"
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );

const heading = () => screen.getByRole("heading", { level: 1 });

describe("UI-26 nobody signed in", () => {
  it("sends the visitor to sign in", () => {
    renderAt(authContext({ status: "anonymous", user: null }));

    expect(heading()).toHaveTextContent("Sign in");
  });

  it("does not render the protected screen even briefly", () => {
    renderAt(authContext({ status: "anonymous", user: null }));

    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
  });
});

describe("UI-26 signed in", () => {
  it("renders the protected screen", () => {
    renderAt(authContext());

    expect(heading()).toHaveTextContent("Protected screen");
  });

  it("sends a user who has no change outstanding away from change password", () => {
    renderAt(authContext(), { path: "/change-password" });

    expect(heading()).toHaveTextContent("Protected screen");
  });
});

describe("UI-26 a password change outstanding", () => {
  it("sends the user to change their password instead (AC-02)", () => {
    renderAt(authContext({ mustChangePassword: true }));

    expect(heading()).toHaveTextContent("Change password");
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
  });

  it("admits them to the change-password screen", () => {
    renderAt(authContext({ mustChangePassword: true }), {
      path: "/change-password",
    });

    expect(heading()).toHaveTextContent("Change password");
  });
});

describe("UI-26 while the session check is still in flight", () => {
  it("waits rather than redirecting", () => {
    renderAt(authContext({ status: "resolving", user: null }));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
  });
});

describe("UI-26 a screen limited to some roles", () => {
  const renderAdminScreen = (context: ReturnType<typeof authContext>) =>
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <AuthContext.Provider value={context}>
          <Routes>
            <Route element={<h1>My Tickets</h1>} path="/my-tickets" />
            <Route
              element={
                <AuthGuard roles={["ADMIN"]}>
                  <h1>User Management</h1>
                </AuthGuard>
              }
              path="/admin/users"
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

  it("admits an Administrator", () => {
    renderAdminScreen(authContext({ user: ADMIN_USER }));

    expect(heading()).toHaveTextContent("User Management");
  });

  it.each([
    { who: "a Requester", context: authContext() },
    { who: "IT Staff", context: authContext({ user: STAFF_USER }) },
  ])(
    "redirects $who to My Tickets rather than showing an error",
    ({ context }) => {
      // ui-spec.md §8: the destination is absent and the route redirects. The
      // server still refuses the same user with 403 — this is navigation.
      renderAdminScreen(context);

      expect(heading()).toHaveTextContent("My Tickets");
    }
  );

  it("still sends a signed-out visitor to sign in first", () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <AuthContext.Provider
          value={authContext({ status: "anonymous", user: null })}
        >
          <Routes>
            <Route element={<h1>Sign in</h1>} path="/login" />
            <Route
              element={
                <AuthGuard roles={["ADMIN"]}>
                  <h1>User Management</h1>
                </AuthGuard>
              }
              path="/admin/users"
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(heading()).toHaveTextContent("Sign in");
  });
});
