import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RequesterContext,
  type RequesterContextValue,
} from "../../src/context/requesterContextValue";
import { CreateTicket } from "../../src/routes/CreateTicket";

/**
 * UI-07 — reference data comes from the API rather than from a constant.
 * UI-08 — validation messages land beside the field they concern.
 * UI-09 — the submit control is disabled and busy while the request runs.
 * UI-10 — a failed submission keeps every value the user typed.
 *
 * `fetch` is stubbed: these assert what the screen does with an answer. Whether
 * the endpoint validates the same rules is API-05's job, one layer down.
 */

const CATEGORIES = [
  { id: 2, name: "Hardware" },
  { id: 4, name: "Network" },
];
const SYSTEMS = [
  { id: 7, name: "Corporate Laptop" },
  { id: 3, name: "VPN" },
];

const REQUESTER = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
};

const CONTEXT: RequesterContextValue = {
  status: "selected",
  requester: REQUESTER,
  generation: 0,
  select: () => undefined,
  clear: () => undefined,
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

/** Answers the two reference calls; POST is supplied per test. */
const referenceFetch = (onPost?: () => Promise<Response>) =>
  vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return onPost ? onPost() : Promise.resolve(jsonResponse({}, 500));
    }

    if (url.includes("/api/categories")) {
      return Promise.resolve(jsonResponse(CATEGORIES));
    }

    return Promise.resolve(jsonResponse(SYSTEMS));
  });

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RequesterContext.Provider value={CONTEXT}>
        <CreateTicket />
      </RequesterContext.Provider>
    </MemoryRouter>
  );

const fillValid = async () => {
  await userEvent.selectOptions(
    await screen.findByLabelText(/^category/i),
    "2"
  );
  await userEvent.selectOptions(screen.getByLabelText(/related system/i), "7");
  await userEvent.type(
    screen.getByLabelText(/^summary/i),
    "Laptop battery drains quickly"
  );
  await userEvent.type(
    screen.getByLabelText(/^description/i),
    "The battery drains much faster than usual even when idle."
  );
};

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: /create ticket/i }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reference data", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  // AC-08 — the options are database rows, not a constant in the source.
  it("loads categories and related systems from the API", async () => {
    renderScreen();

    expect(
      await screen.findByRole("option", { name: "Hardware" })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VPN" })).toBeInTheDocument();
  });

  it("disables the classification fields until they have loaded", () => {
    renderScreen();

    expect(screen.getByLabelText(/^category/i)).toBeDisabled();
  });

  it("shows a failure state when the reference data cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    renderScreen();

    expect(
      await screen.findByText("Could not load the form")
    ).toBeInTheDocument();
  });
});

describe("read-only context", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("shows the current requester without letting it be edited", async () => {
    renderScreen();

    const field = await screen.findByLabelText("Requester");

    expect(field).toHaveValue("Jennifer Anderson");
    expect(field).toHaveAttribute("readonly");
  });

  it("marks the system-generated fields as read-only", async () => {
    renderScreen();

    expect(await screen.findByLabelText("Ticket No.")).toHaveClass(
      "tkt-field--readonly"
    );
    expect(screen.getByLabelText("Ticket Date")).toHaveClass(
      "tkt-field--readonly"
    );
  });
});

describe("validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("reports every empty required field at once", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByText("Category is required.")).toBeInTheDocument();
  });

  // §8.3 — beside the control, not collected into one summary at the top.
  it("puts each message inside its own field group", async () => {
    const { container } = renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    const groups = [...container.querySelectorAll(".tkt-field-group")];
    const withSummaryError = groups.find((group) =>
      group.textContent?.includes("Summary is required.")
    );

    expect(withSummaryError?.querySelector("label")).toHaveTextContent(
      "Summary"
    );
  });

  it("rejects a summary below the minimum length", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.type(screen.getByLabelText(/^summary/i), "abc");
    await submit();

    expect(
      screen.getByText(/Summary must be between 5 and 150 characters/)
    ).toBeInTheDocument();
  });

  it("treats a whitespace-only summary as empty", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.type(screen.getByLabelText(/^summary/i), "        ");
    await submit();

    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
  });

  it("never calls the API when the form is invalid", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    expect(fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("submitting", () => {
  // BR-17 — the disabled busy button is the whole duplicate-submission control.
  it("disables the submit control while the request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(() => new Promise<Response>(() => undefined))
    );

    renderScreen();
    await fillValid();
    await submit();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });
  });

  // The mechanism is that there is nothing left to click: the control renames
  // itself and disables, so a second submit cannot be issued at all. Asserting
  // "clicked twice, sent once" would be asserting something weaker.
  it("leaves no enabled submit control to click a second time", async () => {
    const post = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", referenceFetch(post));

    renderScreen();
    await fillValid();
    await submit();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^create ticket$/i })
      ).toBeNull();
    });

    const busy = screen.getByRole("button", { name: /creating/i });
    await userEvent.click(busy);

    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("success", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(async () =>
        jsonResponse(
          {
            id: 42,
            ticketNumber: "TKT-2026-000042",
            summary: "Laptop battery drains quickly",
            currentStatus: "NEW",
            createdAt: "2026-08-29T09:14:22.481Z",
          },
          201
        )
      )
    );
  });

  it("shows the ticket number the backend issued", async () => {
    renderScreen();
    await fillValid();
    await submit();

    expect(await screen.findByText(/TKT-2026-000042/)).toBeInTheDocument();
  });

  it("offers a clear next action", async () => {
    renderScreen();
    await fillValid();
    await submit();

    expect(
      await screen.findByRole("button", { name: "Go to My Tickets" })
    ).toBeInTheDocument();
  });

  it("never invents a ticket number of its own", async () => {
    renderScreen();
    await fillValid();
    await submit();

    await screen.findByText(/TKT-2026-000042/);
    // Anything else on screen matching the pattern would mean the client is
    // guessing at a value only the server may assign (BR-01).
    const shown = document.body.textContent?.match(/TKT-\d{4}-\d{6}/gu) ?? [];
    expect(new Set(shown)).toEqual(new Set(["TKT-2026-000042"]));
  });
});

describe("a failed submission", () => {
  const failingPost = async () => {
    throw new TypeError("Failed to fetch");
  };

  // BR-19 and Part 6, item 5. Retyping a long description because a connection
  // dropped is the failure people actually remember.
  it("keeps every value the user typed", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/^summary/i)).toHaveValue(
      "Laptop battery drains quickly"
    );
    expect(screen.getByLabelText(/^description/i)).toHaveValue(
      "The battery drains much faster than usual even when idle."
    );
    expect(screen.getByLabelText(/^category/i)).toHaveValue("2");
  });

  it("says what happened without showing the exception", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/could not|unable/i);
    expect(alert).not.toHaveTextContent("TypeError");
  });

  it("re-enables the submit control so it can be tried again", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    await screen.findByRole("alert");

    expect(
      screen.getByRole("button", { name: /create ticket/i })
    ).toBeEnabled();
  });

  // The server is authoritative, so a field-level rejection it reports has to
  // reach the field even when the client thought the value was fine.
  it("shows field messages the server reported", async () => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(async () =>
        jsonResponse(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "The ticket could not be created.",
              details: {
                summary: "Summary is already used by another ticket.",
              },
            },
          },
          400
        )
      )
    );

    renderScreen();
    await fillValid();
    await submit();

    expect(
      await screen.findByText("Summary is already used by another ticket.")
    ).toBeInTheDocument();
  });
});
