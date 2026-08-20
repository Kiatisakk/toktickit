import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select } from "../../../src/components/Select";
import { TextArea } from "../../../src/components/TextArea";
import { TextInput } from "../../../src/components/TextInput";

/**
 * STYLE-01 and STYLE-02 — see docs/lab-02/tests.md.
 *
 * These assert class names and ARIA wiring rather than rendered colour. jsdom
 * has no layout engine and does not resolve a stylesheet, so "is this
 * #A4262C?" is a Playwright question; "does this carry tkt-field--invalid?" is
 * this one. That split is why ui-spec.md gives every component a semantic class
 * of its own instead of leaning on framework utilities.
 */

describe("required field marker", () => {
  it("renders an asterisk beside the label", () => {
    render(<TextInput label="Summary" required />);

    const marker = document.querySelector(".tkt-required");

    expect(marker).not.toBeNull();
    expect(marker).toHaveTextContent("*");
  });

  it("hides the asterisk from assistive technology and marks the control required instead", () => {
    render(<TextInput label="Summary" required />);

    expect(document.querySelector(".tkt-required")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByLabelText(/summary/i)).toBeRequired();
  });

  it("omits the asterisk when the field is optional", () => {
    render(<TextInput label="Nickname" />);

    expect(document.querySelector(".tkt-required")).toBeNull();
  });

  // §8.3: "Required fields show a red asterisk. The asterisk does not replace
  // the validation message." Both have to be present at once.
  it("shows the message as well as the asterisk when invalid", () => {
    render(
      <TextInput
        error="Summary must be at least 5 characters."
        label="Summary"
        required
      />
    );

    expect(document.querySelector(".tkt-required")).not.toBeNull();
    expect(
      screen.getByText("Summary must be at least 5 characters.")
    ).toHaveClass("tkt-field-error");
  });
});

describe("validation message placement", () => {
  it("ties the message to its control with aria-describedby", () => {
    render(<TextInput error="Summary is required." label="Summary" required />);

    const control = screen.getByLabelText(/summary/i);
    const describedBy = control.getAttribute("aria-describedby");

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Summary is required."
    );
  });

  it("marks the control invalid", () => {
    render(<TextInput error="Summary is required." label="Summary" />);

    expect(screen.getByLabelText(/summary/i)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("renders the message inside the field group, not in a page-level summary", () => {
    const { container } = render(
      <TextInput error="Summary is required." label="Summary" />
    );

    const group = container.querySelector(".tkt-field-group");

    expect(group?.querySelector(".tkt-field-error")).toHaveTextContent(
      "Summary is required."
    );
  });

  it("suppresses the hint while an error is showing", () => {
    render(
      <TextInput
        error="Summary is required."
        hint="A one-line title for the problem."
        label="Summary"
      />
    );

    expect(
      screen.queryByText("A one-line title for the problem.")
    ).not.toBeInTheDocument();
  });
});

describe("editable, read-only and invalid states", () => {
  it("gives an editable control the base class only", () => {
    render(<TextInput label="Summary" />);

    const control = screen.getByLabelText("Summary");

    expect(control).toHaveClass("tkt-field");
    expect(control).not.toHaveClass("tkt-field--readonly");
    expect(control).not.toHaveClass("tkt-field--invalid");
  });

  it("distinguishes a read-only control and keeps it uneditable", () => {
    render(<TextInput label="Ticket No." readOnly value="TKT-2025-000042" />);

    const control = screen.getByLabelText("Ticket No.");

    expect(control).toHaveClass("tkt-field--readonly");
    expect(control).toHaveAttribute("readonly");
  });

  it("distinguishes an invalid control", () => {
    render(<TextInput error="Required." label="Summary" />);

    expect(screen.getByLabelText("Summary")).toHaveClass("tkt-field--invalid");
  });

  it("marks a disabled control and leaves it unusable", () => {
    render(<TextInput disabled label="Summary" />);

    expect(screen.getByLabelText("Summary")).toBeDisabled();
  });
});

describe("multiline description", () => {
  it("carries the multiline class so it can be taller than a single-line input", () => {
    render(<TextArea label="Description" />);

    expect(screen.getByLabelText("Description")).toHaveClass(
      "tkt-field--multiline"
    );
  });
});

describe("select", () => {
  it("labels the control and renders its options", () => {
    render(
      <Select
        label="Category"
        options={[
          { value: "1", label: "Hardware" },
          { value: "2", label: "Network" },
        ]}
      />
    );

    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Hardware" })
    ).toBeInTheDocument();
  });

  it("renders a disabled placeholder rather than letting it be chosen", () => {
    render(
      <Select
        label="Category"
        options={[{ value: "1", label: "Hardware" }]}
        placeholder="Choose a category"
      />
    );

    expect(
      screen.getByRole("option", { name: "Choose a category" })
    ).toBeDisabled();
  });
});
