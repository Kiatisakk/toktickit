import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../../../src/components/Badge";

/** STYLE-04 — badge meaning never depends on colour. */

describe("priority badges", () => {
  it.each([
    ["LOW", "Low"],
    ["MEDIUM", "Medium"],
    ["HIGH", "High"],
  ])("renders %s as readable text", (value, label) => {
    render(<Badge kind="priority" value={value} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("carries a modifier class per value", () => {
    const { container } = render(<Badge kind="priority" value="HIGH" />);

    expect(container.querySelector(".tkt-badge")).toHaveClass(
      "tkt-badge--high"
    );
  });
});

describe("status badges", () => {
  it.each([
    ["NEW", "New"],
    ["IN_PROGRESS", "In Progress"],
    ["RESOLVED", "Resolved"],
  ])("renders %s as readable text", (value, label) => {
    render(<Badge kind="status" value={value} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("turns an underscored enum into words rather than showing the raw value", () => {
    render(<Badge kind="status" value="IN_PROGRESS" />);

    expect(screen.queryByText("IN_PROGRESS")).toBeNull();
  });
});

describe("meaning without colour", () => {
  // ui-spec.md §8. A red badge and an amber badge are the same badge to a
  // reader who cannot tell them apart, so the word has to carry the meaning.
  it.each(["LOW", "MEDIUM", "HIGH", "NEW", "RESOLVED"])(
    "always renders the word for %s",
    (value) => {
      const { container } = render(<Badge kind="status" value={value} />);

      expect(container.textContent?.trim().length).toBeGreaterThan(0);
    }
  );

  it("gives every value a distinct label", () => {
    const labels = ["LOW", "MEDIUM", "HIGH"].map((value) => {
      const { container } = render(<Badge kind="priority" value={value} />);

      return container.textContent;
    });

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("an unset value", () => {
  // Lab 2 never sets IT Priority, so this is the common case rather than an
  // edge one. An empty cell says nothing about whether the value is missing or
  // the column is broken.
  it("renders a dash rather than an empty cell", () => {
    const { container } = render(<Badge kind="priority" value={null} />);

    expect(container.textContent).toContain("—");
  });

  it("explains itself to assistive technology", () => {
    render(
      <Badge emptyLabel="IT priority not set" kind="priority" value={null} />
    );

    expect(screen.getByText("IT priority not set")).toBeInTheDocument();
  });

  it("hides the dash itself, since it is decoration", () => {
    const { container } = render(<Badge kind="priority" value={null} />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "—"
    );
  });
});
