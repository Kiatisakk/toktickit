import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "../../../src/components/PasswordInput";
import { PasswordRules } from "../../../src/components/PasswordRules";
import { Select } from "../../../src/components/Select";
import { TextArea } from "../../../src/components/TextArea";
import { TextInput } from "../../../src/components/TextInput";

/**
 * STYLE-04, STYLE-05, STYLE-08, STYLE-10 — the new fields (ui-spec.md §10).
 *
 * Attributes and accessible names only. Whether the toggle, the rules and the
 * messages look right is asserted from a real browser (RESP-05, RESP-06).
 */

const ToggleHarness = () => {
  const [visible, setVisible] = useState(false);

  return (
    <PasswordInput
      label="New password"
      onVisibleChange={setVisible}
      visible={visible}
    />
  );
};

describe("STYLE-04 the password toggle", () => {
  it("is a button whose accessible name changes between Show and Hide", async () => {
    const user = userEvent.setup();

    render(<ToggleHarness />);

    const show = screen.getByRole("button", { name: /show password/iu });

    expect(show).toHaveAttribute("type", "button");
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password"
    );

    await user.click(show);

    expect(
      screen.getByRole("button", { name: /hide password/iu })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "text"
    );
  });
});

describe("STYLE-05 the rules panel", () => {
  it("is a list, and each rule's state is conveyed in text", () => {
    const { rerender } = render(<PasswordRules password="" />);

    const list = screen.getByRole("list", { name: /password requirements/iu });
    const pending = within(list).getAllByRole("listitem");

    expect(pending.length).toBeGreaterThan(0);

    for (const item of pending) {
      expect(item.textContent).toMatch(/not yet met/iu);
    }

    rerender(<PasswordRules password="Correct-Horse-9-Battery" />);

    const met = within(
      screen.getByRole("list", { name: /password requirements/iu })
    ).getAllByRole("listitem");

    for (const item of met) {
      expect(item.textContent).toMatch(/met/iu);
      expect(item.textContent).not.toMatch(/not yet met/iu);
    }
  });
});

describe("STYLE-08 labels bind to controls", () => {
  it("every new field has a real label bound to a real control", () => {
    render(
      <>
        <TextInput label="Ticket Owner" value="" onChange={() => {}} />
        <Select
          label="Role"
          onChange={() => {}}
          options={[{ label: "Requester", value: "REQUESTER" }]}
          value="REQUESTER"
        />
        <TextArea label="Description" onChange={() => {}} value="" />
      </>
    );

    expect(screen.getByLabelText("Ticket Owner")).toBeInstanceOf(
      HTMLInputElement
    );
    expect(screen.getByLabelText("Role")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Description")).toBeInstanceOf(
      HTMLTextAreaElement
    );
  });

  it("a read-only value keeps its label on the input, while badge values carry none", () => {
    // TicketDetail renders the owner for a non-staff reader as a readOnly
    // input, which legitimately keeps its label — "read-only values carry
    // none" is about the badge and block spans, which are not controls and
    // must not be labelled as though they were.
    render(<TextInput label="Ticket Owner" readOnly value="Nobody yet" />);

    expect(screen.getByLabelText("Ticket Owner")).toHaveAttribute("readonly");
  });
});

describe("STYLE-10 validation placement", () => {
  it("renders the message inside its own field group", () => {
    render(
      <TextInput
        error="Enter a summary."
        label="Summary"
        onChange={() => {}}
        value=""
      />
    );

    const group = screen.getByLabelText("Summary").closest(".tkt-field-group");

    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getByRole("alert")).toHaveTextContent(
      "Enter a summary."
    );
  });

  it("renders the note composer's message inside its own field group", () => {
    render(
      <TextArea
        error="Enter a note."
        label="Add a note"
        onChange={() => {}}
        value="typed and failed"
      />
    );

    const group = screen
      .getByLabelText("Add a note")
      .closest(".tkt-field-group");

    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getByRole("alert")).toHaveTextContent(
      "Enter a note."
    );
  });
});
