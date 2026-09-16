import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/components/AppShell";
import { AuthContext } from "../../src/context/authContextValue";
import { ADMIN_USER, authContext, STAFF_USER } from "../support/auth";

/**
 * UI-14 — the shell shows who is signed in, and nothing else about identity.
 *
 * Role-dependent navigation (UI-13, AC-34) is not here: the navigation is still
 * the Lab 2 pair until a staff screen exists to link to.
 */

const renderShell = ({
  auth = authContext(),
}: {
  auth?: ReturnType<typeof authContext>;
} = {}) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <AppShell>content</AppShell>
      </AuthContext.Provider>
    </MemoryRouter>
  );

describe("UI-14 the signed-in identity", () => {
  it("shows the name and the role", () => {
    renderShell();

    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
  });

  it("names the role in words rather than in enum values", () => {
    renderShell({ auth: authContext({ user: STAFF_USER }) });

    expect(screen.getByText("IT Staff")).toBeInTheDocument();
    expect(screen.queryByText("IT_STAFF")).not.toBeInTheDocument();
  });

  it("offers Logout", () => {
    renderShell();

    expect(
      screen.getByRole("button", { name: /logout/iu })
    ).toBeInTheDocument();
  });

  it("ends the session when Logout is pressed", async () => {
    const signOut = vi.fn(() => Promise.resolve());

    renderShell({ auth: authContext({ signOut }) });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /logout/iu }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows no Logout when nobody is signed in", () => {
    renderShell({ auth: authContext({ status: "anonymous", user: null }) });

    expect(
      screen.queryByRole("button", { name: /logout/iu })
    ).not.toBeInTheDocument();
  });
});

describe("UI-14 the retired selector", () => {
  it("offers no Change Requester action on an application screen", () => {
    renderShell();

    expect(
      screen.queryByRole("button", { name: /change requester/iu })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/acting as/iu)).not.toBeInTheDocument();
  });

  it("never shows a placeholder identity when nobody is signed in", () => {
    // Lab 2 read "No requester selected" here. With no signed-in user there is
    // nobody to name, and the guard has already sent the visitor to sign in.
    renderShell({ auth: authContext({ status: "anonymous", user: null }) });

    expect(screen.queryByText(/no requester/iu)).not.toBeInTheDocument();
  });
});

describe("the role badge", () => {
  it("renders the role through the shared badge component", () => {
    renderShell();

    const role = screen.getByText("Requester");

    expect(role).toHaveClass("tkt-badge");
    expect(role).toHaveAttribute("data-kind", "role");
  });

  it("names the administrator role as the handout does", () => {
    renderShell({
      auth: authContext({ user: { ...STAFF_USER, role: "ADMIN" } }),
    });

    expect(screen.getByText("Administrator")).toHaveClass("tkt-badge");
  });
});

describe("UI-13 navigation by role", () => {
  const destinations = () =>
    [
      ...screen
        .getByRole("navigation", { name: "Primary" })
        .querySelectorAll("a"),
    ].map((link) => link.textContent);

  // The order and membership ui-spec.md §2 gives, role by role. A destination
  // a role may not use is absent rather than disabled (AC-34).
  it("offers an Administrator all four, in ui-spec.md's order", () => {
    renderShell({ auth: authContext({ user: ADMIN_USER }) });

    expect(destinations()).toEqual([
      "Ticket Queue",
      "User Management",
      "My Tickets",
      "Create Ticket",
    ]);
  });

  it("offers IT Staff the Ticket Queue but not User Management", () => {
    renderShell({ auth: authContext({ user: STAFF_USER }) });

    expect(destinations()).toEqual([
      "Ticket Queue",
      "My Tickets",
      "Create Ticket",
    ]);
  });

  it("offers a Requester neither staff destination", () => {
    renderShell();

    expect(
      screen.queryByRole("link", { name: /ticket queue|user management/iu })
    ).not.toBeInTheDocument();
    expect(destinations()).toEqual(["My Tickets", "Create Ticket"]);
  });
});
