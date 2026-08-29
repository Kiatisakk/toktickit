import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../../../src/components/Badge";
import { Icon } from "../../../src/components/Icon";

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

/**
 * STYLE-14 — the two badge columns must not read as one.
 *
 * Requested Priority and Current Status sit two columns apart. Before this,
 * Open, In Progress and Pending shared a single amber between them, and that
 * amber was also priority Medium — so a reader scanning a row met the same chip
 * twice and had to read both to learn they meant unrelated things.
 *
 * jsdom resolves no stylesheet, so the colours themselves are a Playwright
 * question. What is assertable here is the hook each colour hangs on: a distinct
 * modifier per status, and the kind on the element so the two families can be
 * told apart in CSS.
 */
describe("telling the two badge columns apart", () => {
  const classesFor = (kind: "priority" | "status", value: string) => {
    const { container } = render(<Badge kind={kind} value={value} />);

    return container.querySelector(".tkt-badge")?.className ?? "";
  };

  it("gives every status its own modifier", () => {
    const modifiers = [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "PENDING",
      "RESOLVED",
      "CLOSED",
    ].map((value) => classesFor("status", value));

    expect(new Set(modifiers).size).toBe(modifiers.length);
  });

  it("says which family a badge belongs to", () => {
    render(<Badge kind="status" value="PENDING" />);

    expect(screen.getByText("Pending")).toHaveAttribute("data-kind", "status");
  });

  // The one that would have caught the original problem: same word, different
  // column, and the element has to be distinguishable.
  it("distinguishes a priority from a status of the same name", () => {
    const { container } = render(
      <>
        <Badge kind="priority" value="MEDIUM" />
        <Badge kind="status" value="PENDING" />
      </>
    );

    const kinds = [...container.querySelectorAll(".tkt-badge")].map((badge) =>
      badge.getAttribute("data-kind")
    );

    expect(kinds).toStrictEqual(["priority", "status"]);
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

/**
 * STYLE-12 — icons support the label, never replace it.
 *
 * §8.3: "Buttons include visible text; icons may support but must not replace
 * unclear text." So the test that matters is not that an icon renders — it is
 * that removing every icon from the page would leave every control still
 * saying what it does.
 */
describe("icons", () => {
  const iconOf = (container: HTMLElement) => container.querySelector("i");

  it("is hidden from assistive technology, being decoration", () => {
    const { container } = render(<Icon name="search" />);

    expect(iconOf(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("carries no text of its own for a label to compete with", () => {
    const { container } = render(<Icon name="ticket" />);

    expect(container.textContent).toBe("");
  });

  // Our names, not Bootstrap's, so the whole set can be swapped in one file
  // rather than at every call site.
  it.each([
    ["search", "bi-search"],
    ["create", "bi-plus-circle"],
    ["reload", "bi-arrow-counterclockwise"],
    ["ticket", "bi-file-earmark-text"],
    ["user", "bi-person-circle"],
    ["brand", "bi-clock"],
  ] as const)("maps %s to %s", (name, glyph) => {
    const { container } = render(<Icon name={name} />);

    expect(iconOf(container)).toHaveClass("bi", glyph);
  });

  it("keeps a hook of our own, so the set is not the styling contract", () => {
    const { container } = render(<Icon name="user" />);

    expect(iconOf(container)).toHaveClass("tkt-icon");
  });
});
