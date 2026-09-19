import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../../src/components/AppShell";
import { AuthContext } from "../../../src/context/authContextValue";
import { authContext, STAFF_USER } from "../../support/auth";

/**
 * STYLE-03 — the active destination is marked by class and `aria-current`
 * (AC-34), never by colour alone.
 *
 * `aria-current="page"` is not a prop anyone wrote: react-router's `NavLink`
 * adds it to the active link itself. The test pins the behaviour, not the
 * mechanism — if the router ever stops doing it, this fails and the marker
 * has to be written by hand.
 */
describe("STYLE-03 the active navigation marking", () => {
  const renderAtQueue = () =>
    render(
      <MemoryRouter initialEntries={["/staff/tickets"]}>
        <AuthContext.Provider value={authContext({ user: STAFF_USER })}>
          <AppShell>content</AppShell>
        </AuthContext.Provider>
      </MemoryRouter>
    );

  it("marks the current destination with the active class and aria-current", () => {
    renderAtQueue();

    const active = screen.getByRole("link", { name: /ticket queue/iu });

    expect(active).toHaveClass("tkt-nav-link--active");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("leaves every other destination unmarked", () => {
    renderAtQueue();

    const inactive = screen.getByRole("link", { name: /my tickets/iu });

    expect(inactive).toHaveClass("tkt-nav-link");
    expect(inactive).not.toHaveClass("tkt-nav-link--active");
    expect(inactive).not.toHaveAttribute("aria-current");
  });
});
