import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Login } from "../../src/routes/Login";
import { authContext, renderWithAuth } from "../support/auth";
import { jsonResponse, respond } from "../support/http";

/**
 * UI-01 to UI-06 — the sign-in screen.
 *
 * The assertions that matter here are about what the screen does *not* say. A
 * refused sign-in must name neither field, or the form becomes the account
 * oracle the server refuses to be (BR-08, AC-05).
 */

const signedIn = vi.fn();

const renderLogin = () =>
  renderWithAuth(<Login />, { context: authContext({ signedIn }) });

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/email/iu), email);
  await user.type(screen.getByLabelText(/^password/iu), password);
  await user.click(screen.getByRole("button", { name: /sign in/iu }));
};

beforeEach(() => {
  signedIn.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-01 the form", () => {
  it("renders both fields with real labels and an enabled Sign In", () => {
    renderLogin();

    expect(screen.getByLabelText(/email/iu)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/iu)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/iu })).toBeEnabled();
  });

  it("masks the password field", () => {
    renderLogin();

    expect(screen.getByLabelText(/^password/iu)).toHaveAttribute(
      "type",
      "password"
    );
  });
});

describe("UI-02 validation", () => {
  it("reports each empty field beneath the control it concerns", async () => {
    const fetchMock = respond({});

    vi.stubGlobal("fetch", fetchMock);
    renderLogin();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /sign in/iu }));

    expect(
      await screen.findByText("Enter your email address.")
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  });

  it("does not call the API for an invalid form", async () => {
    const fetchMock = respond({});

    vi.stubGlobal("fetch", fetchMock);
    renderLogin();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /sign in/iu }));

    // BR-17: this is feedback, not the boundary — the server validates the same
    // thing. But a form that posts an empty body on every click is a form that
    // spends the rate limiter on nothing.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("UI-03 refused credentials", () => {
  const refusal = {
    error: {
      code: "INVALID_CREDENTIALS",
      message: "That email address and password do not match an account.",
    },
  };

  it("shows one message and singles out neither field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(refusal, 401)))
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Wrong1!wrong");

    const alerts = await screen.findAllByRole("alert");

    expect(alerts).toHaveLength(1);
    // AC-05. Naming Password would say the address exists; naming Email would
    // say it does not.
    expect(alerts[0]?.textContent ?? "").not.toMatch(/^Enter your/u);
    expect(screen.queryByText("Enter your password.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Enter your email address.")
    ).not.toBeInTheDocument();
  });

  it("keeps what the user typed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(refusal, 401)))
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Wrong1!wrong");

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/email/iu)).toHaveValue(
      "jennifer.anderson@example.ac.th"
    );
  });

  it("does not record a sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(refusal, 401)))
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Wrong1!wrong");

    await screen.findByRole("alert");

    expect(signedIn).not.toHaveBeenCalled();
  });
});

describe("UI-04 a deactivated account", () => {
  it("shows a distinct message naming the account as deactivated", async () => {
    const body = {
      error: {
        code: "ACCOUNT_INACTIVE",
        message: "This account has been deactivated. Contact an administrator.",
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(body, 403)))
    );
    renderLogin();

    await fillAndSubmit("natthaphong.chaiyaporn@example.ac.th", "Requester5!");

    // AC-06, D-04. Safe to say, because the password has already verified —
    // the person reading this is the account's owner.
    expect(await screen.findByText(/deactivated/iu)).toBeInTheDocument();
  });
});

describe("UI-05 the API is unreachable", () => {
  it("fails safely and keeps the entered values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("boom")))
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Requester1!");

    expect(
      await screen.findByText(/cannot reach toktickit/iu)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/iu)).toHaveValue(
      "jennifer.anderson@example.ac.th"
    );
  });
});

describe("UI-06 the busy state", () => {
  it("disables the button while the request runs and does not submit twice", async () => {
    let release: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        })
    );

    vi.stubGlobal("fetch", fetchMock);
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Requester1!");

    const button = screen.getByRole("button", { name: /signing in/iu });

    expect(button).toBeDisabled();

    // The duplicate-submission control is the disabled button itself (BR-17).
    await userEvent.setup().click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    release?.(
      jsonResponse({
        user: {
          id: 1,
          name: "Jennifer Anderson",
          email: "jennifer.anderson@example.ac.th",
          role: "REQUESTER",
        },
        mustChangePassword: false,
      })
    );

    await waitFor(() => {
      expect(signedIn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("the show/hide toggle", () => {
  it("is a button whose name says what pressing it will do", async () => {
    renderLogin();

    const user = userEvent.setup();
    const password = screen.getByLabelText(/^password/iu);

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toBeInTheDocument();
  });

  it("does not submit the form", async () => {
    const fetchMock = respond({});

    vi.stubGlobal("fetch", fetchMock);
    renderLogin();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Show password" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Enter your email address.")
    ).not.toBeInTheDocument();
  });

  it("hides the password again on submit, so a failure never leaves it on screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            { error: { code: "INVALID_CREDENTIALS", message: "No." } },
            401
          )
        )
      )
    );
    renderLogin();

    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/email/iu),
      "jennifer.anderson@example.ac.th"
    );
    await user.type(screen.getByLabelText(/^password/iu), "Wrong1!wrong");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: /sign in/iu }));

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/^password/iu)).toHaveAttribute(
      "type",
      "password"
    );
  });
});

describe("the refusal wording", () => {
  it("uses the words ui-spec.md gives it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            {
              error: { code: "INVALID_CREDENTIALS", message: "server wording" },
            },
            401
          )
        )
      )
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Wrong1!wrong");

    expect(
      await screen.findByText("Invalid email or password. Please try again.")
    ).toBeInTheDocument();
  });
});

describe("the signed-out header", () => {
  it("renders the shell header with no navigation and no user", () => {
    renderWithAuth(<Login />, {
      context: authContext({ status: "anonymous", user: null, signedIn }),
    });

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /logout/iu })
    ).not.toBeInTheDocument();
  });
});

describe("while the request runs", () => {
  it("makes both fields read-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );
    renderLogin();

    await fillAndSubmit("jennifer.anderson@example.ac.th", "Requester1!");

    expect(screen.getByLabelText(/email/iu)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^password/iu)).toHaveAttribute("readonly");
  });
});
