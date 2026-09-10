import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePassword } from "../../src/routes/ChangePassword";
import { authContext, renderWithAuth } from "../support/auth";
import { jsonResponse } from "../support/requester";

/**
 * UI-07 to UI-09 — the change-password screen.
 *
 * UI-09 is the one worth stating plainly: while a password change is
 * outstanding, navigation the server would refuse must be **absent**, not
 * disabled. A greyed-out link still says the destination exists.
 */

const gated = () =>
  renderWithAuth(<ChangePassword />, {
    context: authContext({ mustChangePassword: true }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-07 the rules panel", () => {
  it("lists every rule before anything is typed", () => {
    gated();

    const rules = screen.getByRole("list", { name: /password requirements/iu });

    expect(rules).toBeInTheDocument();
    expect(
      screen.getByText(/at least one upper-case letter/iu)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/at least one lower-case letter/iu)
    ).toBeInTheDocument();
    expect(screen.getByText(/at least one digit/iu)).toBeInTheDocument();
    expect(
      screen.getByText(/at least one special character/iu)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/between 8 and 128 characters/iu)
    ).toBeInTheDocument();
  });

  it("marks a rule met as soon as it is satisfied", async () => {
    gated();

    const upper = screen.getByText(/at least one upper-case letter/iu);

    expect(upper.closest("li")).not.toHaveClass("tkt-password-rule--met");

    await userEvent.setup().type(screen.getByLabelText(/^new password/iu), "A");

    expect(upper.closest("li")).toHaveClass("tkt-password-rule--met");
  });

  it("says met or not met in text, not only in colour", async () => {
    gated();

    await userEvent.setup().type(screen.getByLabelText(/^new password/iu), "A");

    // A tick and a colour are not available to a screen reader.
    expect(screen.getAllByText(/— met/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/— not yet met/u).length).toBeGreaterThan(0);
  });

  it("marks every rule met for a compliant password", async () => {
    gated();

    await userEvent
      .setup()
      .type(screen.getByLabelText(/^new password/iu), "Replaced1!");

    expect(screen.queryAllByText(/— not yet met/u)).toHaveLength(0);
  });
});

describe("UI-08 the confirmation", () => {
  it("reports a mismatch against Confirm, not against New", async () => {
    gated();

    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^new password/iu), "Replaced1!");
    await user.type(
      screen.getByLabelText(/confirm new password/iu),
      "Replaced2!"
    );

    const message = screen.getByText("This does not match the new password.");
    const confirmField = screen
      .getByLabelText(/confirm new password/iu)
      .closest(".tkt-field-group");

    // The new password is not wrong; the repetition of it is.
    expect(confirmField).toContainElement(message);
  });

  it("does not submit while the two differ", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({}, 204)));

    vi.stubGlobal("fetch", fetchMock);
    gated();

    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/iu), "Starting1!");
    await user.type(screen.getByLabelText(/^new password/iu), "Replaced1!");
    await user.type(
      screen.getByLabelText(/confirm new password/iu),
      "Replaced2!"
    );
    await user.click(screen.getByRole("button", { name: /save password/iu }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("UI-09 the gated shell", () => {
  it("renders no navigation at all", () => {
    gated();

    // AC-02. Absent, not disabled: a disabled link still names a destination
    // and invites the user to try it.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /my tickets/iu })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /create ticket/iu })
    ).not.toBeInTheDocument();
  });

  it("still offers Logout, so nobody is trapped", () => {
    gated();

    expect(
      screen.getByRole("button", { name: /logout/iu })
    ).toBeInTheDocument();
  });

  it("says why the change is being asked for", () => {
    gated();

    expect(screen.getByText(/starting password/iu)).toBeInTheDocument();
  });
});

describe("a wrong current password", () => {
  it("is reported against the current-password field", async () => {
    const body = {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Your current password is not correct.",
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(body, 401)))
    );
    gated();

    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/current password/iu),
      "Wrong1!wrong"
    );
    await user.type(screen.getByLabelText(/^new password/iu), "Replaced1!");
    await user.type(
      screen.getByLabelText(/confirm new password/iu),
      "Replaced1!"
    );
    await user.click(screen.getByRole("button", { name: /save password/iu }));

    const message = await screen.findByText(
      "Your current password is not correct."
    );
    const currentField = screen
      .getByLabelText(/current password/iu)
      .closest(".tkt-field-group");

    expect(currentField).toContainElement(message);
  });
});
