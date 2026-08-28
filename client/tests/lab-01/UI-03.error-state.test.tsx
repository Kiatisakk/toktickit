import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

/**
 * UI-03 — API failure displays a useful error message.
 *
 * The two failure modes are checked separately because telling them apart is
 * the reason the page calls both endpoints: a stopped database must not look
 * like an unreachable API.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Check System — failure paths", () => {
  it("reports Offline with a useful message when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API"
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("names the database when the API is up but the categories fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/api/health")
          ? ({
              ok: true,
              json: async () => ({ status: "ok", service: "TokTickIT API" }),
            } as Response)
          : ({ ok: false, status: 500 } as Response)
      )
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load request categories from the database"
    );
  });

  it("lets the user retry after a failure", async () => {
    const fetchMock = vi
      .fn(async () => {
        throw new TypeError("Failed to fetch");
      })
      .mockName("fetch");

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const button = screen.getByRole("button", { name: "Check System" });

    await userEvent.click(button);
    expect(await screen.findByText("Offline")).toBeInTheDocument();

    expect(button).toBeEnabled();
  });
});
