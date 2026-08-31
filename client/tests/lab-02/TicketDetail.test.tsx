import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RequesterContext,
  type RequesterContextValue,
} from "../../src/context/requesterContextValue";
import type { AttachmentMetadata } from "../../src/lib/api";
import { TicketDetail } from "../../src/routes/TicketDetail";

/**
 * The Requester Ticket Detail screen.
 *
 * Two things carry the weight here. A ticket that is not yours must look exactly
 * like a ticket that does not exist — the API refuses to tell them apart, and
 * this screen must not undo that by wording the two differently. And a removed
 * attachment must keep its metadata while losing its Download, which is the
 * visible half of soft removal.
 */

const CONTEXT: RequesterContextValue = {
  status: "selected",
  requester: {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.ac.th",
  },
  generation: 0,
  select: () => undefined,
  clear: () => undefined,
};

const ATTACHMENT: AttachmentMetadata = {
  id: 11,
  originalFilename: "battery-report.pdf",
  mimeType: "application/pdf",
  sizeBytes: 284_119,
  uploadedAt: "2026-08-19T09:15:02.117Z",
  uploadedBy: { id: 1, name: "Jennifer Anderson" },
  status: "ACTIVE",
  removedAt: null,
  removedReason: null,
  removedBy: null,
};

const TICKET = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  description: "It started after last week's update.",
  requestedPriority: "HIGH",
  itPriority: null,
  currentStatus: "NEW",
  resolutionSummary: null,
  createdAt: "2026-08-01T09:14:00.000Z",
  updatedAt: "2026-08-03T11:02:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requester: { id: 1, name: "Jennifer Anderson" },
  ticketOwner: null,
  attachments: [] as AttachmentMetadata[],
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

const respond = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(jsonResponse(body, status)));

const renderAt = (path = "/tickets/42") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RequesterContext.Provider value={CONTEXT}>
        <Routes>
          <Route element={<TicketDetail />} path="/tickets/:ticketId" />
        </Routes>
      </RequesterContext.Provider>
    </MemoryRouter>
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a ticket you own", () => {
  it("shows the ticket number and summary", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(
      screen.getAllByText("Laptop battery drains quickly").length
    ).toBeGreaterThan(0);
  });

  it("shows the description, which the list never carries", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("It started after last week's update.")
    ).toBeInTheDocument();
  });

  it("scopes the request to the current requester", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/42"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Development-Requester-Id": "1",
          }),
        })
      );
    });
  });

  // §8.5: read-only, with no control that could change a system-managed value.
  it.each(["Ticket No.", "Ticket Date", "Requester", "Summary"])(
    "renders %s read-only",
    async (label) => {
      vi.stubGlobal("fetch", respond(TICKET));

      renderAt();

      expect(await screen.findByLabelText(label)).toHaveAttribute("readonly");
    }
  );

  it("offers no control that could change the ticket", async () => {
    const { container } = renderAt();

    vi.stubGlobal("fetch", respond(TICKET));

    await waitFor(() => {
      for (const input of container.querySelectorAll("input")) {
        // The file input is the one writable control, and it adds rather than
        // edits.
        expect(input.hasAttribute("readonly") || input.type === "file").toBe(
          true
        );
      }
    });
  });

  /**
   * The three fields Lab 2 never populates are present and say why.
   *
   * §4.2 excludes the work that fills them, not the fact that they exist. A
   * missing field tells a requester nothing; an empty one tells them nobody has
   * triaged this yet (D-04).
   */
  it("says an unset IT Priority is unset", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("Not set until IT triages this ticket")
    ).toBeInTheDocument();
  });

  it("says the ticket has no owner yet", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(await screen.findByLabelText("Ticket Owner")).toHaveValue(
      "Not yet assigned"
    );
  });

  it("shows the resolution placeholder the figure draws", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("No resolution summary available yet.")
    ).toBeInTheDocument();
  });

  // Figure 1 draws four tabs and §4.2 excludes the features behind three of
  // them. Drawing them disabled would advertise a screen this lab must not
  // build.
  it.each([
    "Public Comments",
    "Internal Notes",
    "Service Actions",
    "Event Log",
  ])("does not offer %s", async (excluded) => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    await screen.findByText("TKT-2026-000042");
    expect(screen.queryByText(excluded)).toBeNull();
  });
});

describe("a ticket that is not yours", () => {
  const refused = () =>
    respond(
      { error: { code: "TICKET_NOT_FOUND", message: "Not found." } },
      404
    );

  it("says it cannot be found", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });

  // The screen must not undo at the last moment what the API is careful about:
  // "yours but missing" and "someone else's" are one answer.
  it("does not distinguish it from a ticket that does not exist", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    const description = await screen.findByText(
      "This ticket does not exist, or it belongs to another requester."
    );

    expect(description).toBeInTheDocument();
  });

  it("offers a way back rather than a dead end", async () => {
    vi.stubGlobal("fetch", refused());

    renderAt();

    await screen.findByText("Ticket not found");
    expect(
      screen.getByRole("button", { name: "Back to My Tickets" })
    ).toBeInTheDocument();
  });

  // A path that cannot be an identifier is answered without asking.
  it.each(["/tickets/abc", "/tickets/1.5", "/tickets/-1"])(
    "refuses %s without calling the API",
    async (path) => {
      const fetchMock = respond(TICKET);
      vi.stubGlobal("fetch", fetchMock);

      renderAt(path);

      await screen.findByText("Ticket not found");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});

describe("attachments", () => {
  const withAttachments = (...list: AttachmentMetadata[]) =>
    respond({ ...TICKET, attachments: list });

  it("says so when there are none", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText("No files have been attached to this ticket.")
    ).toBeInTheDocument();
  });

  it("states the rules before a file is chosen", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(
      await screen.findByText(/JPG, PNG, WEBP or PDF · up to 5 MB/u)
    ).toBeInTheDocument();
  });

  it("lists an active attachment with its size and uploader", async () => {
    vi.stubGlobal("fetch", withAttachments(ATTACHMENT));

    const { container } = renderAt();

    expect(await screen.findByText("battery-report.pdf")).toBeInTheDocument();

    // One paragraph, several text nodes, so the assertion is on the element
    // rather than on a string a text matcher would have to reassemble.
    const meta = container.querySelector(".tkt-attachment__meta");

    expect(meta?.textContent).toContain("277 KB");
    expect(meta?.textContent).toContain("Jennifer Anderson");
  });

  // The client half of BR-21. The server enforces the rule; this stops the
  // picker offering files it is going to refuse — which is also why the
  // rejection test below uses a size failure rather than a type one: a
  // disallowed type cannot be chosen through the control at all.
  it("limits the file picker to the permitted types", async () => {
    vi.stubGlobal("fetch", respond(TICKET));

    renderAt();

    expect(await screen.findByLabelText(/Add Attachment/u)).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,application/pdf"
    );
  });

  it("offers Download and Remove on an active attachment", async () => {
    vi.stubGlobal("fetch", withAttachments(ATTACHMENT));

    renderAt();

    await screen.findByText("battery-report.pdf");
    expect(
      screen.getByRole("button", { name: "Download" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  /**
   * The visible half of soft removal, and what Part 8 asks to see: the record
   * of what was attached survives, the bytes do not.
   */
  const REMOVED: AttachmentMetadata = {
    ...ATTACHMENT,
    status: "REMOVED",
    removedAt: "2026-08-20T10:00:00.000Z",
    removedReason: "Uploaded the wrong screenshot.",
    removedBy: { id: 1, name: "Jennifer Anderson" },
  };

  it("keeps the metadata of a removed attachment", async () => {
    vi.stubGlobal("fetch", withAttachments(REMOVED));

    renderAt();

    expect(await screen.findByText("battery-report.pdf")).toBeInTheDocument();
  });

  it("shows why it was removed", async () => {
    vi.stubGlobal("fetch", withAttachments(REMOVED));

    renderAt();

    expect(
      await screen.findByText(/Uploaded the wrong screenshot\./u)
    ).toBeInTheDocument();
  });

  it("offers no Download for a removed attachment", async () => {
    vi.stubGlobal("fetch", withAttachments(REMOVED));

    renderAt();

    await screen.findByText("battery-report.pdf");
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
  });

  it("offers no Remove for something already removed", async () => {
    vi.stubGlobal("fetch", withAttachments(REMOVED));

    renderAt();

    await screen.findByText("battery-report.pdf");
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("disables the add control at five active attachments", async () => {
    const five = Array.from({ length: 5 }, (_unused, index) => ({
      ...ATTACHMENT,
      id: index + 1,
      originalFilename: `file-${index}.pdf`,
    }));

    vi.stubGlobal("fetch", withAttachments(...five));

    renderAt();

    await screen.findByText("file-0.pdf");
    expect(screen.getByLabelText(/Add Attachment/u)).toBeDisabled();
  });

  it("says why the add control is unavailable", async () => {
    const five = Array.from({ length: 5 }, (_unused, index) => ({
      ...ATTACHMENT,
      id: index + 1,
      originalFilename: `file-${index}.pdf`,
    }));

    vi.stubGlobal("fetch", withAttachments(...five));

    renderAt();

    expect(
      await screen.findByText(/Remove one before adding another\./u)
    ).toBeInTheDocument();
  });
});

describe("removing an attachment", () => {
  const openConfirm = async () => {
    vi.stubGlobal("fetch", respond({ ...TICKET, attachments: [ATTACHMENT] }));

    renderAt();

    await screen.findByText("battery-report.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
  };

  it("asks for confirmation rather than removing on the first click", async () => {
    await openConfirm();

    expect(
      screen.getByRole("group", { name: "Confirm removal" })
    ).toBeInTheDocument();
  });

  it("requires a reason before the confirm button works", async () => {
    await openConfirm();

    expect(
      screen.getByRole("button", { name: "Remove Attachment" })
    ).toBeDisabled();
  });

  it("enables confirmation once the reason is long enough", async () => {
    await openConfirm();

    await userEvent.type(
      screen.getByLabelText(/Reason for removing/u),
      "Wrong file"
    );

    expect(
      screen.getByRole("button", { name: "Remove Attachment" })
    ).toBeEnabled();
  });

  // Three characters is the rule; two is not "nearly".
  it("keeps confirmation disabled for a reason that is too short", async () => {
    await openConfirm();

    await userEvent.type(screen.getByLabelText(/Reason for removing/u), "ab");

    expect(
      screen.getByRole("button", { name: "Remove Attachment" })
    ).toBeDisabled();
  });

  it("can be cancelled", async () => {
    await openConfirm();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Confirm removal" })).toBeNull();
  });
});

describe("failure", () => {
  it("reports a failure that is not a refusal, and offers a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );

    renderAt();

    expect(
      await screen.findByText("Could not load the ticket")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  /**
   * The server's own words, not ours.
   *
   * It names the rule that was broken — which limit, which type — and a message
   * of our own would either repeat it or contradict it.
   */
  it("shows the attachment rejection the server describes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve(
            jsonResponse(
              {
                error: {
                  code: "FILE_TOO_LARGE",
                  message:
                    "That file is larger than 5 MB. Attach a smaller file.",
                },
              },
              413
            )
          );
        }

        return Promise.resolve(jsonResponse(TICKET));
      })
    );

    renderAt();

    await screen.findByText("No files have been attached to this ticket.");

    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      new File(["%PDF"], "huge.pdf", { type: "application/pdf" })
    );

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText(/larger than 5 MB/u)).toBeInTheDocument();
  });
});
