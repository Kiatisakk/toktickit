import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../../src/components/AppShell";
import { Breadcrumb } from "../../../src/components/Breadcrumb";
import { StateBlock } from "../../../src/components/StateBlock";
import {
  RequesterContext,
  type RequesterContextValue,
} from "../../../src/context/requesterContextValue";

/** STYLE-05 and STYLE-06 — see docs/lab-02/tests.md. */

/**
 * The shell takes its identity from the context and from nowhere else, so a
 * test that wants a name supplies a context rather than a prop. Rendering with
 * no provider is the honest "nobody selected yet" case, which is what the
 * selection screen itself does.
 */
const renderShell = (
  path: string,
  requester: RequesterContextValue["requester"] = null
) => {
  const value: RequesterContextValue = {
    status: requester ? "selected" : "none",
    requester,
    generation: 0,
    select: () => undefined,
    clear: () => undefined,
  };

  return render(
    <MemoryRouter initialEntries={[path]}>
      <RequesterContext.Provider value={value}>
        <AppShell>
          <p>Screen content</p>
        </AppShell>
      </RequesterContext.Provider>
    </MemoryRouter>
  );
};

const JENNIFER = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
};

describe("application shell", () => {
  it("shows the TokTickIT identity", () => {
    renderShell("/my-tickets");

    expect(
      screen.getByRole("link", { name: /toktickit/i })
    ).toBeInTheDocument();
  });

  it("offers both primary navigation destinations", () => {
    renderShell("/my-tickets");

    expect(
      screen.getByRole("link", { name: "My Tickets" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create Ticket" })
    ).toBeInTheDocument();
  });

  // The active page is signalled by aria-current as well as a class, so the
  // state does not depend on seeing an underline.
  it("marks the active page", () => {
    renderShell("/my-tickets");

    const active = screen.getByRole("link", { name: "My Tickets" });

    expect(active).toHaveClass("tkt-nav-link--active");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("does not mark an inactive page", () => {
    renderShell("/my-tickets");

    expect(screen.getByRole("link", { name: "Create Ticket" })).not.toHaveClass(
      "tkt-nav-link--active"
    );
  });

  it("says plainly when no requester has been selected", () => {
    renderShell("/my-tickets");

    expect(screen.getByText("No requester selected")).toBeInTheDocument();
  });

  it("shows the current requester once the context has one", () => {
    renderShell("/my-tickets", JENNIFER);

    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
  });

  it("offers Change Requester once there is a requester to change", () => {
    renderShell("/my-tickets", JENNIFER);

    expect(
      screen.getByRole("button", { name: "Change Requester" })
    ).toBeInTheDocument();
  });

  // There is nothing to change from before one is chosen, and the selection
  // screen renders inside this shell.
  it("hides Change Requester when nobody is selected", () => {
    renderShell("/my-tickets");

    expect(
      screen.queryByRole("button", { name: "Change Requester" })
    ).toBeNull();
  });

  it("gives the mobile navigation toggle an accessible name and expanded state", () => {
    renderShell("/my-tickets");

    const toggle = screen.getByRole("button", { name: "Menu" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "tkt-primary-nav");
  });

  it("names the primary navigation landmark", () => {
    renderShell("/my-tickets");

    expect(
      screen.getByRole("navigation", { name: "Primary" })
    ).toBeInTheDocument();
  });
});

describe("breadcrumb", () => {
  it("names its landmark and marks the final crumb as the current page", () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: "My Tickets", to: "/my-tickets" },
            { label: "Ticket Details" },
          ]}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" })
    ).toBeInTheDocument();
    expect(screen.getByText("Ticket Details")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("links every crumb except the last", () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: "My Tickets", to: "/my-tickets" },
            { label: "Ticket Details" },
          ]}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: "My Tickets" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ticket Details" })).toBeNull();
  });
});

describe("state block", () => {
  // BR-35 requires "you have no tickets" and "your filters matched nothing" to
  // be visibly different. Distinct kinds are what makes that testable later.
  it("distinguishes empty from no-results", () => {
    const { container: empty } = render(
      <StateBlock kind="empty" title="No tickets yet" />
    );
    const { container: noResults } = render(
      <StateBlock kind="no-results" title="No tickets match your filters" />
    );

    expect(empty.querySelector(".tkt-state")).toHaveAttribute(
      "data-state",
      "empty"
    );
    expect(noResults.querySelector(".tkt-state")).toHaveAttribute(
      "data-state",
      "no-results"
    );
  });

  it("announces loading politely", () => {
    const { container } = render(
      <StateBlock kind="loading" title="Loading…" />
    );

    expect(container.querySelector(".tkt-state")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("raises an error state as an alert", () => {
    render(<StateBlock kind="error" title="Something went wrong" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("hides its decorative icon from assistive technology", () => {
    const { container } = render(
      <StateBlock kind="empty" title="Nothing here" />
    );

    expect(container.querySelector(".tkt-state__icon")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
