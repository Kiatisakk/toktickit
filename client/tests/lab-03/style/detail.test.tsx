import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../../../src/context/authContextValue";
import { TicketDetail } from "../../../src/routes/TicketDetail";
import { TICKET } from "../../lab-02/ticketDetailHarness";
import { authContext, STAFF_USER } from "../../support/auth";

/**
 * STYLE-09 — the staff detail marks operational fields editable and the rest
 * read-only (ui-spec.md §6).
 *
 * One screen with three live fields for staff, not two screens: the same grid
 * cells hold controls for staff and read-only badges for everyone else. A
 * cancelled ticket is read-only even for staff — it has no targets, not an
 * empty dropdown.
 */
describe("STYLE-09 editable versus read-only", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderDetail = (
    auth: ReturnType<typeof authContext>,
    ticket: Record<string, unknown> = TICKET as Record<string, unknown>
  ) => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).endsWith("/staff/owners")) {
          return Promise.resolve(
            new Response(JSON.stringify([{ id: 11, name: "Michael Brown" }]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }

        if (
          String(url).endsWith("/comments") ||
          String(url).endsWith("/notes")
        ) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify(ticket), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
    );

    render(
      <MemoryRouter initialEntries={["/tickets/42"]}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route element={<TicketDetail />} path="/tickets/:ticketId" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  it("marks the three operational fields editable for staff", async () => {
    renderDetail(authContext({ user: STAFF_USER }), {
      ...(TICKET as Record<string, unknown>),
      ticketOwner: { id: 11, name: "Michael Brown" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("IT Priority")).toBeInstanceOf(
        HTMLSelectElement
      );
    });

    expect(screen.getByLabelText("Current Status")).toBeInstanceOf(
      HTMLSelectElement
    );
    expect(screen.getByLabelText("Ticket Owner")).toBeInTheDocument();
  });

  it("marks the same fields read-only for a Requester", async () => {
    renderDetail(authContext());

    await waitFor(() => {
      expect(
        screen.getByText("Laptop battery drains quickly")
      ).toBeInTheDocument();
    });

    // No combobox behind these labels: badges and blocks, not controls.
    expect(screen.queryByLabelText("IT Priority")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current Status")).not.toBeInTheDocument();
    expect(screen.getByText("Requested Priority")).toBeInTheDocument();
  });

  it("shows a cancelled ticket read-only even to staff", async () => {
    renderDetail(authContext({ user: STAFF_USER }), {
      ...(TICKET as Record<string, unknown>),
      currentStatus: "CANCELLED",
    });

    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Current Status")).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be moved again/iu)).toBeInTheDocument();
  });
});
