import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequesterProvider } from "../../src/context/RequesterContext";
import { RequesterGuard } from "../../src/routes/RequesterGuard";

/**
 * UI-03 — requester-scoped screens are unreachable without a current context
 * (AC-04, BR-10).
 *
 * The guard is what makes that one rule rather than five: every scoped route
 * sits behind it, so no screen has to remember to check.
 */

const REQUESTERS = [
  {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.ac.th",
  },
];

const STORAGE_KEY = "toktickit.developmentRequesterId";

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RequesterProvider>
        <Routes>
          <Route
            element={
              <RequesterGuard>
                <p>Protected screen</p>
              </RequesterGuard>
            }
            path="/my-tickets"
          />
          <Route element={<p>Selection screen</p>} path="/select-requester" />
        </Routes>
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

describe("with no requester selected", () => {
  it("sends the visitor to the selection screen", async () => {
    renderAt("/my-tickets");

    expect(await screen.findByText("Selection screen")).toBeInTheDocument();
  });

  it("does not render the protected screen even briefly", async () => {
    renderAt("/my-tickets");

    await screen.findByText("Selection screen");
    expect(screen.queryByText("Protected screen")).toBeNull();
  });
});

describe("with a requester selected", () => {
  it("renders the protected screen", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");

    renderAt("/my-tickets");

    expect(await screen.findByText("Protected screen")).toBeInTheDocument();
  });
});

describe("while the stored selection is still being confirmed", () => {
  // Redirecting during `resolving` would make every reload flash the selector
  // and would throw away a perfectly valid selection.
  it("waits rather than redirecting", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined))
    );

    renderAt("/my-tickets");

    await waitFor(() => {
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });
    expect(screen.queryByText("Selection screen")).toBeNull();
  });
});
