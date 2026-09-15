import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCategories, fetchHealth } from "../../src/api";
import App from "../../src/App";
import { AuthContext } from "../../src/context/authContextValue";
import {
  ATTACHMENT,
  jsonResponse,
  renderAt,
  respond,
  TICKET,
} from "../lab-02/ticketDetailHarness";
import { authContext, STAFF_USER } from "../support/auth";

/**
 * The two defects raised in review on PR #60.
 *
 * Both were invisible to the suites that already existed for the same reason:
 * each one only appears for a caller the existing tests never played — a
 * status check made with the cookie the Lab 1 client never sent, and a ticket
 * opened by someone who is not its requester.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the system status check", () => {
  it("sends the session cookie with both requests", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ status: "ok" }))
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchHealth();
    await fetchCategories();

    // The categories half needs a session since Lab 3. Without credentials the
    // browser drops the cookie across origins and a healthy system reads
    // Offline.
    for (const call of fetchMock.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(call[1]?.credentials).toBe("include");
    }
  });

  it("reports Online for a signed-in user when both requests succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith("/api/health")
            ? jsonResponse({ status: "ok", service: "toktickit-api" })
            : jsonResponse([{ id: 1, name: "Hardware" }])
        )
      )
    );

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authContext()}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /check system/iu }));

    expect(await screen.findByText("Online")).toBeInTheDocument();
  });
});

describe("attachments on a ticket that is not yours", () => {
  const STAFF = authContext({ user: STAFF_USER });
  const withFile = () => respond({ ...TICKET, attachments: [ATTACHMENT] });

  it("offers Download to IT Staff opening a Requester's ticket", async () => {
    vi.stubGlobal("fetch", withFile());

    renderAt("/tickets/42", STAFF);

    const row = await screen.findByText(ATTACHMENT.originalFilename);
    const item = row.closest("li");

    expect(item).not.toBeNull();
    expect(
      within(item as HTMLElement).getByRole("button", { name: /download/iu })
    ).toBeInTheDocument();
  });

  it("offers neither Remove nor Add Attachment, because the server refuses both", async () => {
    vi.stubGlobal("fetch", withFile());

    renderAt("/tickets/42", STAFF);

    await screen.findByText(ATTACHMENT.originalFilename);

    expect(
      screen.queryByRole("button", { name: /^remove$/iu })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/add attachment/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/up to 5 MB/iu)).not.toBeInTheDocument();
  });

  it("still offers both to the requester", async () => {
    vi.stubGlobal("fetch", withFile());

    renderAt();

    await screen.findByText(ATTACHMENT.originalFilename);

    expect(
      screen.getByRole("button", { name: /^remove$/iu })
    ).toBeInTheDocument();
    expect(screen.getByText(/add attachment/iu)).toBeInTheDocument();
  });
});
