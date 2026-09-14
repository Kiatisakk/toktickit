import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/components/AppShell";
import { AuthContext } from "../../src/context/authContextValue";
import { RequesterContext } from "../../src/context/requesterContextValue";
import { authContext, STAFF_USER } from "../support/auth";
import { requesterContext } from "../support/requester";

/**
 * UI-14 — the shell shows who is signed in.
 *
 * Role-dependent navigation (UI-13, AC-34) is not here: the navigation is still
 * the Lab 2 pair, because this ticket is the expand half and no staff screen
 * exists to link to yet.
 */

const renderShell = ({
  auth = authContext(),
  requester = requesterContext(),
}: {
  auth?: ReturnType<typeof authContext>;
  requester?: ReturnType<typeof requesterContext>;
} = {}) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <RequesterContext.Provider value={requester}>
          <AppShell>content</AppShell>
        </RequesterContext.Provider>
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

  it("offers a way to sign in when nobody is", () => {
    // Otherwise the screen is reachable only by typing its URL: during the
    // expand half nothing else routes to it.
    renderShell({ auth: authContext({ status: "anonymous", user: null }) });

    expect(screen.getByRole("link", { name: /sign in/iu })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});

describe("while both identity mechanisms coexist", () => {
  it("says who is being acted as when the two differ", () => {
    // Only possible for the length of this one ticket. Naming it is better
    // than a header that quietly shows one person while the API acts as
    // another — which is the exact defect AppShell was already written to
    // avoid, when it accepted the name as a prop.
    renderShell({
      auth: authContext({ user: STAFF_USER }),
      requester: requesterContext(),
    });

    expect(
      screen.getByText(/acting as Jennifer Anderson/iu)
    ).toBeInTheDocument();
  });

  it("says nothing extra when they are the same person", () => {
    renderShell();

    expect(screen.queryByText(/acting as/iu)).not.toBeInTheDocument();
  });
});

describe("the session check", () => {
  it("offers no Sign In while it is still resolving", () => {
    // Otherwise the link flashes at everybody who is already signed in, for as
    // long as GET /api/auth/me takes to answer.
    renderShell({ auth: authContext({ status: "resolving", user: null }) });

    expect(
      screen.queryByRole("link", { name: /sign in/iu })
    ).not.toBeInTheDocument();
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
