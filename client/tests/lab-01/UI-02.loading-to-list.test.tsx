import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

/**
 * UI-02 — Loading state changes to category list.
 *
 * fetch is mocked: these tests describe how the page reacts to the API, not
 * whether the API works. API-02 covers that.
 */
const CATEGORIES = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Check System — success path", () => {
  it("shows a loading state and then the categories from the API", async () => {
    // Hold the categories request open so the loading state is observable.
    let releaseCategories: (() => void) | undefined;
    const categoriesPending = new Promise<void>((resolve) => {
      releaseCategories = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/health")) {
          return jsonResponse({ status: "ok", service: "TokTickIT API" });
        }
        await categoriesPending;
        return jsonResponse(CATEGORIES);
      })
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("button", { name: "Check System" })).toBeDisabled();

    releaseCategories!();

    expect(await screen.findByText("Online")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  it("renders whatever the API returns rather than a hard-coded list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/api/health")
          ? jsonResponse({ status: "ok", service: "TokTickIT API" })
          : jsonResponse([{ id: 9, name: "Printer" }])
      )
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("Printer")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
