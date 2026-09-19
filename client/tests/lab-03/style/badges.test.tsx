import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../../../src/components/Badge";

/**
 * STYLE-01 and STYLE-02 — badges render through one component (ui-spec.md §1).
 *
 * Class names and words, never colours: jsdom resolves no stylesheet, so
 * anything about colour belongs in the browser suite (tests.md, Test Strategy).
 */
describe("STYLE-01 the role badge", () => {
  it.each([
    {
      value: "REQUESTER",
      label: "Requester",
      modifier: "tkt-badge--requester",
    },
    { value: "IT_STAFF", label: "IT Staff", modifier: "tkt-badge--it-staff" },
    { value: "ADMIN", label: "Administrator", modifier: "tkt-badge--admin" },
  ])(
    "renders $label through the shared badge with a role modifier",
    ({ value, label, modifier }) => {
      render(<Badge kind="role" value={value} />);

      const badge = screen.getByText(label);

      expect(badge).toHaveClass("tkt-badge", modifier);
      expect(badge).toHaveAttribute("data-kind", "role");
    }
  );

  it("never shows the raw enum value", () => {
    render(<Badge kind="role" value="IT_STAFF" />);

    expect(screen.queryByText("IT_STAFF")).not.toBeInTheDocument();
  });
});

describe("STYLE-02 the new status badges", () => {
  it.each([
    { value: "REOPENED", label: "Reopened", modifier: "tkt-badge--reopened" },
    {
      value: "CANCELLED",
      label: "Cancelled",
      modifier: "tkt-badge--cancelled",
    },
  ])("renders $label with its modifier", ({ value, label, modifier }) => {
    render(<Badge kind="status" value={value} />);

    expect(screen.getByText(label)).toHaveClass("tkt-badge", modifier);
  });

  it("labels the renamed status Waiting for Requester, never Pending", () => {
    render(<Badge kind="status" value="WAITING_FOR_REQUESTER" />);

    // Title-casing would print "Waiting For Requester" (ui-spec.md §5).
    expect(screen.getByText("Waiting for Requester")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });
});
