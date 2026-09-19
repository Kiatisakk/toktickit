import { screen, waitFor, within } from "@testing-library/react";
import { configure } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InternalNote } from "../../src/lib/api";
import {
  permittedTargets,
  STATUS_LABELS,
  TICKET_STATUSES,
} from "../../src/lib/ticketStatus";
import {
  jsonResponse,
  NO_COMMENTS,
  renderAt,
  TICKET,
} from "../lab-02/ticketDetailHarness";
import {
  ADMIN_USER,
  authContext,
  JENNIFER_USER,
  STAFF_USER,
} from "../support/auth";

/**
 * UI-15 and UI-16 — the IT Staff Ticket Detail (ui-spec.md §6, Issue #51).
 *
 * The same screen a Requester reads, with three fields live: owner, IT
 * Priority and status. What a Requester sees of those three is asserted here
 * too, because "editable for staff" is only meaningful beside "read-only for
 * everyone else" (STYLE-09).
 */

// Two requests deep, as the Requester suite is: the ticket, then its comments.
configure({ asyncUtilTimeout: 5000 });

const OWNERS = [
  { id: 11, name: "Michael Brown" },
  { id: 16, name: "Wanida Thongchai" },
];

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** The default Internal Note a successful post answers with. */
const postedNote = (call: Call, id = 900): InternalNote => ({
  id,
  body: (call.body as { body: string }).body,
  author: { id: STAFF_USER.id, name: STAFF_USER.name, role: STAFF_USER.role },
  createdAt: "2026-09-18T04:00:00.000Z",
});

const api = ({
  // Typed loosely on purpose. Inferred from TICKET, whose owner and IT
  // Priority are null, the default made every test that passed a real owner or
  // priority a type error — invisible to Vitest, which does not typecheck, and
  // fatal to `tsc -b`, which the build runs.
  ticket = TICKET as Record<string, unknown>,
  onPatch = (_call: Call, current: unknown): Promise<Response> =>
    Promise.resolve(jsonResponse(current)),
  notes = [] as InternalNote[],
  onPostNote = (call: Call): Promise<Response> =>
    Promise.resolve(jsonResponse(postedNote(call), 201)),
} = {}) => {
  const calls: Call[] = [];
  let current: Record<string, unknown> = { ...ticket };

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      const call = { url, method, body };

      calls.push(call);

      if (method === "PATCH") {
        // The endpoint answers with the whole ticket, so the screen redraws
        // from what the server stored (api-spec.md §7).
        current = { ...current, ...(body as Record<string, unknown>) };

        if (url.endsWith("/owner")) {
          const ownerId = (body as { ownerId: number | null }).ownerId;

          current["ticketOwner"] =
            ownerId === null
              ? null
              : (OWNERS.find((one) => one.id === ownerId) ?? null);
          delete current["ownerId"];
        }

        if (url.endsWith("/status")) {
          current["currentStatus"] = (body as { status: string }).status;
          delete current["status"];
        }

        return onPatch(call, current);
      }

      if (url.endsWith("/comments")) {
        return Promise.resolve(jsonResponse(NO_COMMENTS));
      }

      // The unrecognised-GET fallback below answers with the ticket, which
      // is not a valid Internal Notes response — so `/notes` is handled
      // explicitly, for both the read and the post.
      if (method === "GET" && url.endsWith("/notes")) {
        return Promise.resolve(jsonResponse({ data: notes }));
      }

      if (method === "POST" && url.endsWith("/notes")) {
        return onPostNote(call);
      }

      if (url.endsWith("/staff/owners")) {
        return Promise.resolve(jsonResponse(OWNERS));
      }

      return Promise.resolve(jsonResponse(current));
    })
  );

  return { calls };
};

const asStaff = () =>
  renderAt("/tickets/42", authContext({ user: STAFF_USER }));

const user = () => userEvent.setup();

const patches = (calls: Call[]) =>
  calls.filter((call) => call.method === "PATCH");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-15 claim, reassign and release", () => {
  it("offers Claim on an unassigned ticket, and sends the signed-in staff member's id", async () => {
    const { calls } = api({ ticket: { ...TICKET, ticketOwner: null } });

    asStaff();

    const claim = await screen.findByRole("button", { name: "Claim" });

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /ticket owner/iu })
    ).toBeNull();

    await user().click(claim);

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({
      body: { ownerId: STAFF_USER.id },
    });
    expect(patches(calls)[0]?.url).toMatch(
      /\/api\/staff\/tickets\/42\/owner$/u
    );

    // Redrawn from the response: the owner is now shown as a choice.
    expect(
      await screen.findByRole("combobox", { name: /ticket owner/iu })
    ).toHaveValue(String(STAFF_USER.id));
  });

  it("offers the eligible owners and a Release on an assigned ticket", async () => {
    const { calls } = api({
      ticket: { ...TICKET, ticketOwner: OWNERS[0] },
    });

    asStaff();

    const owner = await screen.findByRole("combobox", {
      name: /ticket owner/iu,
    });

    // The eligible owners arrive in their own request, so the options appear
    // after the control does.
    await waitFor(() =>
      expect(
        within(owner)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toStrictEqual(OWNERS.map((one) => one.name))
    );
    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();

    await user().selectOptions(owner, String(OWNERS[1]?.id));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({
      body: { ownerId: OWNERS[1]?.id },
    });

    await user().click(screen.getByRole("button", { name: "Release" }));

    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    expect(patches(calls)[1]).toMatchObject({ body: { ownerId: null } });
    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
  });

  it("says why when the server refuses the owner, leaving the ticket as it was", async () => {
    const { calls } = api({
      ticket: { ...TICKET, ticketOwner: null },
      onPatch: () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "TICKET_OWNER_INELIGIBLE",
                message:
                  "Only active IT Staff and Administrators can own a ticket.",
              },
            },
            400
          )
        ),
    });

    asStaff();

    await user().click(await screen.findByRole("button", { name: "Claim" }));

    expect(
      await screen.findByText(
        "Only active IT Staff and Administrators can own a ticket."
      )
    ).toBeInTheDocument();
    expect(patches(calls)).toHaveLength(1);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});

describe("AC-19 IT Priority is editable, Requested Priority is not", () => {
  it("sends the chosen priority and leaves Requested Priority read-only", async () => {
    const { calls } = api({
      ticket: { ...TICKET, itPriority: "MEDIUM", requestedPriority: "HIGH" },
    });

    asStaff();

    const itPriority = await screen.findByRole("combobox", {
      name: /it priority/iu,
    });

    expect(itPriority).toHaveValue("MEDIUM");

    await user().selectOptions(itPriority, "LOW");

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({
      url: expect.stringMatching(/\/it-priority$/u),
      body: { itPriority: "LOW" },
    });

    // Requested Priority is the Requester's, and has no control at all here:
    // it is a badge in its own field group, which is where this looks for it.
    expect(
      screen.queryByRole("combobox", { name: /requested priority/iu })
    ).toBeNull();

    const requested = screen
      .getByText("Requested Priority")
      .closest(".tkt-field-group");

    expect(
      within(requested as HTMLElement).getByText("High")
    ).toBeInTheDocument();
  });

  it("clears IT Priority with null rather than an empty string", async () => {
    const { calls } = api({ ticket: { ...TICKET, itPriority: "HIGH" } });

    asStaff();

    await user().selectOptions(
      await screen.findByRole("combobox", { name: /it priority/iu }),
      ""
    );

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({ body: { itPriority: null } });
  });
});

describe("UI-16 only permitted transitions are offered", () => {
  it.each(
    TICKET_STATUSES.filter((status) => status !== "CANCELLED").map(
      (status) => [status] as const
    )
  )(
    "from %s, the control lists exactly the permitted targets",
    async (from) => {
      api({ ticket: { ...TICKET, currentStatus: from } });

      asStaff();

      const control = await screen.findByRole("combobox", {
        name: /current status/iu,
      });
      const offered = within(control)
        .getAllByRole("option")
        .map((option) => option.textContent)
        .filter((label) => label !== "Move to…");

      expect(offered).toStrictEqual(
        permittedTargets(from).map((target) => STATUS_LABELS[target])
      );
    }
  );

  it("sends the chosen status and redraws from the response", async () => {
    const { calls } = api({ ticket: { ...TICKET, currentStatus: "NEW" } });

    asStaff();

    await user().selectOptions(
      await screen.findByRole("combobox", { name: /current status/iu }),
      "OPEN"
    );

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({
      url: expect.stringMatching(/\/status$/u),
      body: { status: "OPEN" },
    });

    // The hint says where the ticket is now, read back from the response.
    expect(await screen.findByText("Now Open.")).toBeInTheDocument();
  });

  it("shows a cancelled ticket's status read-only, with a note and no dropdown", async () => {
    api({ ticket: { ...TICKET, currentStatus: "CANCELLED" } });

    asStaff();

    expect(
      await screen.findByText(/cannot be moved again/iu)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /current status/iu })
    ).toBeNull();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("says why when the server refuses a transition", async () => {
    api({
      ticket: { ...TICKET, currentStatus: "NEW" },
      onPatch: () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "INVALID_STATUS_TRANSITION",
                message:
                  "That is not a permitted status change for this ticket.",
              },
            },
            400
          )
        ),
    });

    asStaff();

    await user().selectOptions(
      await screen.findByRole("combobox", { name: /current status/iu }),
      "OPEN"
    );

    expect(
      await screen.findByText(
        "That is not a permitted status change for this ticket."
      )
    ).toBeInTheDocument();
  });

  it("matches the matrix in specification.md §5, cell by cell", () => {
    // The client's copy of the matrix, checked against §5's own table — the
    // same table UNIT-02 checks the server's copy against.
    expect(
      Object.fromEntries(
        TICKET_STATUSES.map((status) => [status, permittedTargets(status)])
      )
    ).toStrictEqual({
      NEW: ["OPEN", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: [
        "IN_PROGRESS",
        "WAITING_FOR_REQUESTER",
        "RESOLVED",
        "CANCELLED",
      ],
      CANCELLED: [],
    });
  });
});

describe("STYLE-09 a Requester sees none of it", () => {
  it("gives a Requester read-only fields and no staff control", async () => {
    api({ ticket: { ...TICKET, ticketOwner: null, currentStatus: "NEW" } });

    renderAt("/tickets/42", authContext({ user: JENNIFER_USER }));

    await screen.findByLabelText("Ticket No.");

    for (const name of [
      /ticket owner/iu,
      /it priority/iu,
      /current status/iu,
    ]) {
      expect(screen.queryByRole("combobox", { name })).toBeNull();
    }

    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
    expect(screen.getByLabelText("Ticket Owner")).toHaveValue(
      "Not yet assigned"
    );
  });

  it("gives an Administrator the same controls as IT Staff", async () => {
    api({ ticket: { ...TICKET, ticketOwner: null } });

    renderAt("/tickets/42", authContext({ user: ADMIN_USER }));

    expect(
      await screen.findByRole("button", { name: "Claim" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /current status/iu })
    ).toBeInTheDocument();
  });
});

describe("UI-17 Public Comments and Internal Notes are distinct (BR-04, Issue #52)", () => {
  it("gives each section its own heading, the notes heading a lock icon, and both standing notes", async () => {
    api();

    asStaff();

    const commentsHeading = await screen.findByRole("heading", {
      name: "Public Comments",
    });
    const notesHeading = screen.getByRole("heading", {
      name: /internal notes/iu,
    });

    expect(commentsHeading).toBeInTheDocument();
    expect(notesHeading).toBeInTheDocument();

    // The icon is decorative (aria-hidden), so it plays no part in the
    // accessible name above — it is a second, independent signal.
    expect(notesHeading.querySelector(".bi-lock-fill")).toBeInTheDocument();
    expect(commentsHeading.querySelector(".bi-lock-fill")).toBeNull();

    // The standing note beside each heading, worded oppositely so neither
    // reads as the other with the colour removed.
    expect(screen.getByText("Visible to the Requester")).toBeInTheDocument();
    expect(
      screen.getByText("Not visible to the Requester")
    ).toBeInTheDocument();
  });

  it("draws the notes composer button as secondary, beside the comments composer's primary", async () => {
    api();

    asStaff();

    const postComment = await screen.findByRole("button", {
      name: "Post Comment",
    });
    const postNote = screen.getByRole("button", { name: "Post Note" });

    expect(postComment).toHaveClass("tkt-btn--primary");
    expect(postNote).toHaveClass("tkt-btn--secondary");
  });

  it("repeats the restriction at the note composer itself", async () => {
    api();

    asStaff();

    await screen.findByRole("button", { name: "Post Note" });

    // The standing note beside the heading is not the only place it is
    // said: the composer's own hint states it again, at the point of
    // posting, where a lapse would actually cause harm.
    expect(
      screen.getByText("Up to 5000 characters. Not visible to the Requester.")
    ).toBeInTheDocument();
  });
});

describe("UI-19 the note composer preserves typed text on failure (AC-36, Issue #52)", () => {
  it("keeps what was typed when posting a note fails", async () => {
    api({
      onPostNote: () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: "Something went wrong. Please try again.",
              },
            },
            500
          )
        ),
    });

    asStaff();

    const noteField = await screen.findByLabelText(/add a note/iu);

    await user().type(noteField, "Escalating this to the network team.");
    await user().click(screen.getByRole("button", { name: "Post Note" }));

    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
    expect(noteField).toHaveValue("Escalating this to the network team.");
  });
});
