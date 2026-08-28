import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequesterProvider } from "../../src/context/RequesterContext";
import { RequesterSelection } from "../../src/routes/RequesterSelection";

/**
 * UI-01 — the selector's loading, empty and failure states.
 * UI-02 — the selector says plainly that it is not a login screen.
 *
 * `fetch` is stubbed throughout: these assert what the screen does with an
 * answer, not that the API gives one. Whether the endpoint hides inactive
 * requesters is API-02's job, one layer down.
 */

const REQUESTERS = [
  {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.ac.th",
  },
  { id: 2, name: "Somchai Wattana", email: "somchai.wattana@example.ac.th" },
];

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RequesterProvider>
        <RequesterSelection />
      </RequesterProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loading state", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );
  });

  it("shows a loading block while the requesters are being fetched", () => {
    renderScreen();

    expect(screen.getByText("Loading requesters…")).toBeInTheDocument();
  });

  // §8.1 lists Continue among the screen's required elements, so it is present
  // from the first render rather than appearing once the fetch resolves.
  it("still shows Continue, disabled, while loading", () => {
    renderScreen();

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("loaded state", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(REQUESTERS))
    );
  });

  it("offers every requester the API returned", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Jennifer Anderson" })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("option", { name: "Somchai Wattana" })
    ).toBeInTheDocument();
  });

  // AC-01: the list comes from the database, not from a constant in the source.
  it("requests the requesters from the API rather than hard-coding them", async () => {
    renderScreen();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/requesters"),
        expect.anything()
      );
    });
  });

  it("keeps Continue disabled until a requester is chosen", async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });
  });

  it("enables Continue once a requester is chosen", async () => {
    renderScreen();

    const select = await screen.findByLabelText(/development requester/i);
    await userEvent.selectOptions(select, "1");

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("uses a keyboard-operable native control", async () => {
    renderScreen();

    const select = await screen.findByLabelText(/development requester/i);

    expect(select.tagName).toBe("SELECT");
  });
});

describe("empty state", () => {
  it("explains what to do when no active requester exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    expect(
      await screen.findByText("No requesters available")
    ).toBeInTheDocument();
    expect(screen.getByText(/db:seed/)).toBeInTheDocument();
  });

  it("offers no Continue action when there is nothing to continue with", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    await screen.findByText("No requesters available");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  // An empty state with no way forward is a dead end. ui-spec.md requires the
  // empty and error states to carry an action.
  it("offers a way to re-check after seeding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    expect(
      await screen.findByRole("button", { name: "Check again" })
    ).toBeInTheDocument();
  });
});

describe("failure state", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
  });

  it("reports the failure and offers a retry", async () => {
    renderScreen();

    expect(
      await screen.findByText("Could not load Development Requesters")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  // BR-20 — the screen shows a sentence a person can act on, not the exception.
  it("shows a readable message rather than the underlying error", async () => {
    renderScreen();

    await screen.findByText("Could not load Development Requesters");
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });
});

describe("wording", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(REQUESTERS))
    );
  });

  // BR-03 and §4.2: the one way this feature can mislead is by looking like
  // authentication, so the denial is asserted rather than trusted.
  it("states that this is not a login screen", async () => {
    renderScreen();

    await screen.findByLabelText(/development requester/i);
    expect(screen.getByText(/this is not a login screen/i)).toBeInTheDocument();
  });

  it("says that authentication arrives in Lab 3", async () => {
    renderScreen();

    await screen.findByLabelText(/development requester/i);
    expect(
      screen.getByText(/authentication arrives in lab 3/i)
    ).toBeInTheDocument();
  });

  it("explains that only active requesters are listed", async () => {
    renderScreen();

    await screen.findByLabelText(/development requester/i);
    expect(
      screen.getByText(/only active development requesters are shown/i)
    ).toBeInTheDocument();
  });

  // Every other screen is guarded, so with nobody selected "/" would redirect to
  // My Tickets, which would redirect straight back here. A Cancel that cannot
  // leave is worse than no Cancel, and §8.1 does not require one.
  it("hides Cancel when there is nowhere to cancel to", async () => {
    renderScreen();

    await screen.findByLabelText(/development requester/i);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("never calls itself a sign-in", async () => {
    renderScreen();

    await screen.findByLabelText(/development requester/i);
    expect(document.body.textContent).not.toMatch(/\bsign in\b/i);
    expect(document.body.textContent).not.toMatch(/\blog in\b/i);
  });
});
