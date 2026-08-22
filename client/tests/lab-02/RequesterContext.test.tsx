import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequesterProvider } from "../../src/context/RequesterContext";
import { useRequester } from "../../src/context/useRequester";

/**
 * UI-04 — the selection survives a reload.
 * UI-05 — changing requester clears what the previous one was looking at.
 */

const REQUESTERS = [
  {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.ac.th",
  },
  { id: 2, name: "Somchai Wattana", email: "somchai.wattana@example.ac.th" },
];

const STORAGE_KEY = "toktickit.developmentRequesterId";

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

/** Reports what the context holds, so a test can read it out of the DOM. */
const Probe = () => {
  const { status, requester, generation, select, clear } = useRequester();

  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="name">{requester?.name ?? "none"}</p>
      <p data-testid="generation">{generation}</p>
      <button onClick={() => select(REQUESTERS[1] as never)} type="button">
        Switch to Somchai
      </button>
      <button onClick={clear} type="button">
        Clear
      </button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <MemoryRouter>
      <RequesterProvider>
        <Probe />
      </RequesterProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(REQUESTERS))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with nothing stored", () => {
  it("settles on no selection without calling the API", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("restoring a stored selection", () => {
  it("resolves the stored id back to a requester", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("name")).toHaveTextContent("Jennifer Anderson");
    });
    expect(screen.getByTestId("status")).toHaveTextContent("selected");
  });

  // BR-07 across a reload. The id is re-resolved against the *active* list
  // rather than trusted, so a requester deactivated since the last visit cannot
  // come back through storage.
  it("discards a stored id that is no longer active", async () => {
    window.localStorage.setItem(STORAGE_KEY, "99");

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored value that is not a number", async () => {
    window.localStorage.setItem(STORAGE_KEY, "not-an-id");

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
  });

  it("falls back to no selection when the API cannot be reached", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    renderProbe();

    // Acting as an identity we could not confirm is exactly what BR-07 forbids,
    // so an unreachable API means no selection rather than a hopeful one.
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
  });
});

describe("changing the current requester", () => {
  it("persists the new selection", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
    await userEvent.click(screen.getByRole("button", { name: /switch/i }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("2");
    expect(screen.getByTestId("name")).toHaveTextContent("Somchai Wattana");
  });

  // BR-08 — requester-scoped screens key their data off `generation`, so a bump
  // is what makes the previous requester's rows leave the screen before the
  // replacement arrives.
  it("bumps the generation so scoped data is discarded", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
    const before = screen.getByTestId("generation").textContent;

    await userEvent.click(screen.getByRole("button", { name: /switch/i }));

    expect(screen.getByTestId("generation").textContent).not.toBe(before);
  });

  it("forgets the selection when cleared", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("none");
    });
    await userEvent.click(screen.getByRole("button", { name: /switch/i }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("status")).toHaveTextContent("none");
  });
});
