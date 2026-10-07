import {
  configure,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketAction } from "../../src/lib/api";
import {
  jsonResponse,
  NO_COMMENTS,
  renderAt,
  TICKET,
} from "../lab-02/ticketDetailHarness";
import { authContext, STAFF_USER } from "../support/auth";

/**
 * UI-19 to UI-30 and UI-38: the Actions Taken area of Ticket Detail
 * (ui-spec.md section 6, AC-40, AC-42, AC-46, AC-48).
 *
 * The fake server below answers the way api-spec.md section 4 says the real one
 * does, so a test reads as "the screen did this, given that" and not as a list
 * of stubbed URLs. Layout at each viewport (AC-43, RESP-03) is a browser
 * measurement, so nothing here claims it.
 */

// Three requests deep before the section is usable: ticket, comments, actions.
configure({ asyncUtilTimeout: 5000 });

const OWNERS = [
  { id: 11, name: "Michael Brown" },
  { id: 12, name: "Ploy Chaiyo" },
  { id: 16, name: "Wanida Thongchai" },
];

const STALE_MESSAGE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

const RELOAD_FAILED_MESSAGE =
  "This record was changed by someone else since you opened it, but the latest version could not be loaded. What you see may be out of date — reload the page before trying again.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const action = (over: Partial<TicketAction> = {}): TicketAction => ({
  id: 1,
  ticketId: 42,
  state: "PLANNED",
  actionAt: "2026-09-05T03:15:00.000Z",
  description: "Replaced the faulty access point",
  result: null,
  followUpRequired: false,
  followUpNote: null,
  followUpState: "NOT_REQUIRED",
  followsUpId: null,
  attachmentNotes: null,
  cancelReason: null,
  recordedBy: { id: 11, name: "Michael Brown" },
  performedBy: { id: 11, name: "Michael Brown" },
  version: 1,
  createdAt: "2026-09-05T02:50:00.000Z",
  updatedAt: "2026-09-05T02:50:00.000Z",
  ...over,
});

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

const error = (
  code: string,
  message: string,
  status: number,
  details?: object
) => jsonResponse({ error: { code, message, details } }, status);

interface Server {
  actions: TicketAction[];
  ticket: Record<string, unknown>;
  calls: Call[];
  /** Replace the answer to one write; return nothing to fall through to the default. */
  onWrite?: (
    call: Call,
    server: Server
  ) => Response | Promise<Response> | undefined;
  /** Fail every read of the Actions after the first. */
  actionReadsFail?: boolean;
  actionReads: number;
}

const serve = (
  initial: TicketAction[],
  options: Partial<Pick<Server, "onWrite" | "ticket" | "actionReadsFail">> = {}
): Server => {
  const server: Server = {
    actions: [...initial],
    ticket: { ...TICKET },
    calls: [],
    actionReads: 0,
    ...options,
  };

  const save = (id: number, change: Partial<TicketAction>) => {
    const found = server.actions.find((one) => one.id === id);

    if (!found) {
      return error("ACTION_NOT_FOUND", "No such action.", 404);
    }

    Object.assign(found, change, { version: found.version + 1 });

    return jsonResponse(found);
  };

  const respondToWrite = (call: Call): Response => {
    const { url, body = {} } = call;
    const id = Number(/\/api\/actions\/(\d+)/u.exec(url)?.[1]);

    if (call.method === "POST" && url.endsWith("/api/tickets/42/actions")) {
      const performer =
        OWNERS.find((one) => one.id === body["performedById"]) ?? OWNERS[0];
      const created = action({
        ...(body as Partial<TicketAction>),
        id: Math.max(0, ...server.actions.map((one) => one.id)) + 1,
        performedBy: performer ?? OWNERS[0] ?? { id: 0, name: "" },
        followUpState: body["followUpRequired"] ? "OPEN" : "NOT_REQUIRED",
        followsUpId: (body["followsUpId"] as number | undefined) ?? null,
      });

      server.actions.push(created);

      return jsonResponse(created, 201);
    }

    if (url.endsWith("/complete")) {
      return save(id, { state: "DONE", result: body["result"] as string });
    }

    if (url.endsWith("/cancel")) {
      return save(id, {
        state: "CANCELLED",
        cancelReason: body["cancelReason"] as string,
        followUpState: "VOID",
      });
    }

    return save(id, body as Partial<TicketAction>);
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined;
      const call: Call = { url, method, body };

      server.calls.push(call);

      if (method !== "GET") {
        return Promise.resolve(
          server.onWrite?.(call, server) ?? respondToWrite(call)
        );
      }

      if (url.endsWith("/comments")) {
        return Promise.resolve(jsonResponse(NO_COMMENTS));
      }

      if (url.endsWith("/notes")) {
        return Promise.resolve(jsonResponse({ data: [] }));
      }

      if (url.endsWith("/staff/owners")) {
        return Promise.resolve(jsonResponse(OWNERS));
      }

      if (url.endsWith("/actions")) {
        server.actionReads += 1;

        return Promise.resolve(
          server.actionReads > 1 && server.actionReadsFail
            ? error("INTERNAL_ERROR", "Something went wrong.", 500)
            : jsonResponse({ data: structuredClone(server.actions) })
        );
      }

      return Promise.resolve(jsonResponse(structuredClone(server.ticket)));
    })
  );

  return server;
};

const writes = (server: Server) =>
  server.calls.filter((call) => call.method !== "GET");

// The Ticket's own read-only "Description" shares a word with the form's field,
// so form fields are looked up inside the form.
const inForm = () =>
  within(
    screen.getByRole("form", {
      name: /^(Add|Edit|Complete|Cancel) action/u,
    })
  );

const asStaff = () =>
  renderAt("/tickets/42", authContext({ user: STAFF_USER }));

const asRequester = () => renderAt("/tickets/42");

const section = async () =>
  screen.findByRole("region", { name: "Actions Taken" });

const table = async () => within(await section()).findByRole("table");

const openAddForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Add action" }));

  return screen.findByRole("form", { name: "Add action" });
};

const typeDescription = async (
  user: ReturnType<typeof userEvent.setup>,
  text = "Swapped the patch cable"
) => {
  await user.type(inForm().getByLabelText(/^Description/u), text);
};

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Save" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-19 the Actions list", () => {
  it("shows the columns, the Actions in the server's order, and the badges", async () => {
    serve([
      action({
        id: 1,
        description: "Replaced the faulty access point",
        result: "Signal restored",
        state: "DONE",
        followUpRequired: true,
        followUpNote: "Check next week",
        followUpState: "OPEN",
      }),
      action({
        id: 2,
        actionAt: "2026-09-06T03:15:00.000Z",
        description: "Checked the signal again",
        followsUpId: 1,
        state: "CANCELLED",
        followUpRequired: true,
        followUpNote: "n",
        followUpState: "VOID",
        cancelReason: "Not needed",
      }),
    ]);

    asStaff();

    const list = await table();

    expect(
      within(list)
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual([
      "Date/time",
      "Description",
      "Performed by",
      "State",
      "Follow-up",
      "Row actions",
    ]);

    const rows = within(list).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Replaced the faulty access point");
    // The Result sits beneath the description once there is one.
    expect(rows[0]).toHaveTextContent("Result: Signal restored");
    expect(rows[0]).toHaveTextContent("Done");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[1]).toHaveTextContent("Checked the signal again");
    expect(rows[1]).toHaveTextContent("Cancelled");
    expect(rows[1]).toHaveTextContent("Void");
    expect(rows[1]).toHaveTextContent("Follows up #1");
    expect(rows[0]).not.toHaveTextContent("Follows up");
    // The resolve dialog (#75) links to an Action as `#action-<id>`.
    expect(rows[0]).toHaveAttribute("id", "action-1");
    expect(rows[1]).toHaveAttribute("id", "action-2");
  });

  it("says so when the Ticket has no Actions", async () => {
    serve([]);

    asStaff();

    expect(
      await screen.findByText("No actions have been recorded for this ticket.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("labels the not-required follow-up in words", async () => {
    serve([action()]);

    asStaff();

    expect(await table()).toHaveTextContent("Not required");
  });
});

describe("UI-20 create form validation", () => {
  it("refuses an empty description beside its field, focuses it, and sends nothing", async () => {
    const server = serve([]);
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await submit(user);

    const field = inForm().getByLabelText(/^Description/u);

    expect(await screen.findByText("Enter a description.")).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(/Enter a description\./u);
    expect(writes(server)).toHaveLength(0);
  });

  it("puts the server's details beneath their fields, focuses the first, and keeps the input", async () => {
    const server = serve([], {
      onWrite: () =>
        error("VALIDATION_FAILED", "Check the fields.", 400, {
          description: "Shorten the description.",
          attachmentNotes: "Too long for notes.",
        }),
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user, "A description");
    await user.type(
      inForm().getByLabelText(/^Attachment notes/u),
      "Some notes"
    );
    await submit(user);

    expect(
      await screen.findByText("Shorten the description.")
    ).toBeInTheDocument();
    expect(screen.getByText("Too long for notes.")).toBeInTheDocument();
    expect(inForm().getByLabelText(/^Description/u)).toHaveFocus();
    expect(inForm().getByLabelText(/^Description/u)).toHaveValue(
      "A description"
    );
    expect(inForm().getByLabelText(/^Attachment notes/u)).toHaveValue(
      "Some notes"
    );
    expect(writes(server)).toHaveLength(1);
  });

  it("requires the follow-up note once the box is ticked", async () => {
    const server = serve([]);
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await user.click(inForm().getByLabelText("Follow-up required"));
    await submit(user);

    expect(
      await screen.findByText("Say what the follow-up is.")
    ).toBeInTheDocument();
    expect(inForm().getByLabelText(/^Follow-up note/u)).toHaveFocus();
    expect(writes(server)).toHaveLength(0);
  });
});

describe("UI-21 create form behaviour", () => {
  it("defaults Performed by to the signed-in user and offers the active staff", async () => {
    serve([]);
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);

    const performer = inForm().getByLabelText(/^Performed by/u);

    expect(performer).toHaveValue("11");
    await waitFor(() =>
      expect(
        within(performer)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toEqual(["Michael Brown", "Ploy Chaiyo", "Wanida Thongchai"])
    );
  });

  it("shows the follow-up note only while the box is ticked", async () => {
    serve([]);
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);

    expect(
      inForm().queryByLabelText(/^Follow-up note/u)
    ).not.toBeInTheDocument();

    await user.click(inForm().getByLabelText("Follow-up required"));

    expect(inForm().getByLabelText(/^Follow-up note/u)).toBeRequired();

    await user.click(inForm().getByLabelText("Follow-up required"));

    expect(
      inForm().queryByLabelText(/^Follow-up note/u)
    ).not.toBeInTheDocument();
  });

  it("lists as Follows up only the Actions that require follow-up and are not cancelled", async () => {
    serve([
      action({
        id: 1,
        description: "Needs a call back",
        followUpRequired: true,
        followUpNote: "Ring them",
        followUpState: "OPEN",
      }),
      action({ id: 2, description: "No follow-up needed" }),
      action({
        id: 3,
        description: "Cancelled but required one",
        followUpRequired: true,
        followUpNote: "n",
        state: "CANCELLED",
        followUpState: "VOID",
      }),
    ]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await openAddForm(user);

    expect(
      within(inForm().getByLabelText("Follows up"))
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["None", "#1: Needs a call back"]);
  });

  it("sends the chosen link and the typed fields, and adds the Action to the list", async () => {
    const server = serve([
      action({
        id: 1,
        description: "Needs a call back",
        followUpRequired: true,
        followUpNote: "Ring them",
        followUpState: "OPEN",
      }),
    ]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await openAddForm(user);
    await typeDescription(user, "  Rang them back  ");
    await user.selectOptions(inForm().getByLabelText("Follows up"), "1");
    await submit(user);

    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );

    const [post] = writes(server);

    expect(post?.body).toMatchObject({
      description: "Rang them back",
      performedById: 11,
      followUpRequired: false,
      followUpNote: null,
      followsUpId: 1,
      result: null,
    });
    expect(await table()).toHaveTextContent("Rang them back");
  });
});

describe("UI-22 an ineligible performer", () => {
  it("shows ACTION_ASSIGNEE_INELIGIBLE beside Performed by and adds nothing", async () => {
    const server = serve([], {
      onWrite: () =>
        error(
          "ACTION_ASSIGNEE_INELIGIBLE",
          "That person can no longer perform actions.",
          400
        ),
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await submit(user);

    const performer = inForm().getByLabelText(/^Performed by/u);

    expect(
      await screen.findByText("That person can no longer perform actions.")
    ).toBeInTheDocument();
    expect(performer).toHaveAccessibleDescription(
      "That person can no longer perform actions."
    );
    expect(performer).toHaveFocus();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(server.actions).toHaveLength(0);
  });
});

describe("UI-23 view mode", () => {
  it("shows an Action's fields read-only with recorder, performer, state and times", async () => {
    serve([
      action({
        id: 5,
        state: "DONE",
        description: "Replaced the faulty access point",
        result: "Signal restored",
        followUpRequired: true,
        followUpNote: "Confirm after a week",
        followUpState: "OPEN",
        attachmentNotes: "Photo in IT-2026/AP-3",
        recordedBy: { id: 11, name: "Michael Brown" },
        performedBy: { id: 12, name: "Ploy Chaiyo" },
      }),
    ]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "View action #5" }));

    const view = await screen.findByRole("region", { name: "Action #5" });
    const values = within(view);

    expect(values.getByText("Signal restored")).toBeInTheDocument();
    expect(values.getByText("Confirm after a week")).toBeInTheDocument();
    expect(values.getByText("Photo in IT-2026/AP-3")).toBeInTheDocument();
    expect(values.getByText("Ploy Chaiyo")).toBeInTheDocument();
    expect(values.getByText("Michael Brown")).toBeInTheDocument();
    expect(values.getByText("Done")).toBeInTheDocument();
    expect(values.getByText("Recorded")).toBeInTheDocument();
    expect(values.getByText("Last updated")).toBeInTheDocument();
    expect(view.querySelector("input, textarea, select")).toBeNull();
    expect(
      values.getByText("This action can no longer be changed.")
    ).toBeInTheDocument();
  });

  it("shows the cancellation reason on a Cancelled Action", async () => {
    serve([
      action({ id: 5, state: "CANCELLED", cancelReason: "Booked in error" }),
    ]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "View action #5" }));

    expect(await screen.findByText("Booked in error")).toBeInTheDocument();
  });
});

describe("UI-24 edit rules by state", () => {
  it("offers Edit, Complete and Cancel on a Planned Action and View only otherwise", async () => {
    serve([
      action({ id: 1 }),
      action({ id: 2, state: "DONE", result: "Fixed" }),
      action({ id: 3, state: "CANCELLED", cancelReason: "No" }),
    ]);

    asStaff();

    const rows = within(await table())
      .getAllByRole("row")
      .slice(1);
    const names = (row: HTMLElement) =>
      within(row)
        .getAllByRole("button")
        .map((button) => button.textContent);

    expect(names(rows[0] as HTMLElement)).toEqual([
      "View",
      "Edit",
      "Complete",
      "Cancel action",
    ]);
    expect(names(rows[1] as HTMLElement)).toEqual(["View"]);
    expect(names(rows[2] as HTMLElement)).toEqual(["View"]);
  });

  it("sends the version it read, never followsUpId, and shows the link read-only", async () => {
    const server = serve([
      action({
        id: 1,
        followUpRequired: true,
        followUpNote: "Ring them",
        followUpState: "OPEN",
      }),
      action({
        id: 2,
        version: 4,
        description: "Called back",
        followsUpId: 1,
      }),
    ]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "Edit action #2" }));

    const form = await screen.findByRole("form", { name: "Edit action #2" });

    expect(within(form).getByText("Follows up")).toBeInTheDocument();
    expect(
      within(form).queryByRole("combobox", { name: "Follows up" })
    ).toBeNull();
    expect(form).toHaveTextContent("Action #1");
    expect(inForm().getByLabelText(/^Description/u)).toHaveValue("Called back");

    await user.clear(inForm().getByLabelText(/^Description/u));
    await user.type(
      inForm().getByLabelText(/^Description/u),
      "Called them back"
    );
    await submit(user);

    await waitFor(() => expect(writes(server)).toHaveLength(1));

    const [patch] = writes(server);

    expect(patch?.method).toBe("PATCH");
    expect(patch?.url).toMatch(/\/api\/actions\/2$/u);
    expect(patch?.body?.["version"]).toBe(4);
    expect(patch?.body?.["description"]).toBe("Called them back");
    expect(patch?.body).not.toHaveProperty("followsUpId");
    // The date was not touched, so it is not resent from a value that lost its seconds.
    expect(patch?.body).not.toHaveProperty("actionAt");
  });
});

describe("UI-25 complete form", () => {
  it("requires a Result, prefills the stored one, and turns the row Done", async () => {
    const server = serve([action({ id: 1, version: 3, result: "Half done" })]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(
      screen.getByRole("button", { name: "Complete action #1" })
    );

    const form = await screen.findByRole("form", {
      name: "Complete action #1",
    });
    const result = within(form).getByLabelText(/^Result/u);

    expect(result).toHaveValue("Half done");

    await user.clear(result);
    await user.click(within(form).getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("Enter the result before completing.")
    ).toBeInTheDocument();
    expect(writes(server)).toHaveLength(0);

    await user.type(result, "Replaced the unit");
    await user.click(within(form).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(writes(server)).toHaveLength(1));

    const [post] = writes(server);

    expect(post?.url).toMatch(/\/api\/actions\/1\/complete$/u);
    expect(post?.body).toEqual({ version: 3, result: "Replaced the unit" });

    const row = within(await table()).getAllByRole("row")[1] as HTMLElement;

    await waitFor(() => expect(row).toHaveTextContent("Done"));
    expect(row).toHaveTextContent("Result: Replaced the unit");
    expect(
      within(row).queryByRole("button", { name: /Complete action/u })
    ).toBeNull();
  });
});

describe("UI-26 cancel form", () => {
  it("requires a Reason and turns the row Cancelled with the reason visible", async () => {
    const server = serve([action({ id: 1, version: 2 })]);
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "Cancel action #1" }));

    const form = await screen.findByRole("form", { name: "Cancel action #1" });

    await user.click(within(form).getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("Enter a reason for cancelling.")
    ).toBeInTheDocument();
    expect(writes(server)).toHaveLength(0);

    await user.type(within(form).getByLabelText(/^Reason/u), "Booked in error");
    await user.click(within(form).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(writes(server)).toHaveLength(1));

    const [post] = writes(server);

    expect(post?.url).toMatch(/\/api\/actions\/1\/cancel$/u);
    expect(post?.body).toEqual({ version: 2, cancelReason: "Booked in error" });

    const row = within(await table()).getAllByRole("row")[1] as HTMLElement;

    await waitFor(() => expect(row).toHaveTextContent("Cancelled"));

    await user.click(
      within(row).getByRole("button", { name: "View action #1" })
    );

    expect(await screen.findByText("Booked in error")).toBeInTheDocument();
  });
});

describe("UI-27 the Requester sees the list read-only", () => {
  it("shows every Action and none of Add, Edit, Complete or Cancel", async () => {
    serve([
      action({ id: 1, attachmentNotes: "Photo in the shared folder" }),
      action({ id: 2, state: "DONE", result: "Fixed" }),
    ]);
    const user = userEvent.setup();

    asRequester();

    const list = await table();

    expect(await section()).toHaveTextContent(
      "Work IT has recorded on your ticket."
    );
    expect(within(list).getAllByRole("row")).toHaveLength(3);
    expect(
      screen.queryByRole("button", {
        name: /Add action|Edit|Complete|Cancel action/u,
      })
    ).toBeNull();
    expect(
      within(list)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["View", "View"]);

    // Every field is still reachable: the view carries what the table does not.
    await user.click(screen.getByRole("button", { name: "View action #1" }));

    expect(
      await screen.findByText("Photo in the shared folder")
    ).toBeInTheDocument();
  });

  it("does not ask for the staff owners list", async () => {
    const server = serve([action()]);

    asRequester();
    await table();

    expect(
      server.calls.some((call) => call.url.endsWith("/staff/owners"))
    ).toBe(false);
  });
});

describe("UI-28 a Ticket that takes no more Actions", () => {
  it.each(["RESOLVED", "CLOSED", "CANCELLED"])(
    "on a %s Ticket shows the message and the list and no write control",
    async (status) => {
      serve([action({ id: 1 })], {
        ticket: { ...TICKET, currentStatus: status },
      });

      asStaff();

      const list = await table();

      expect(await section()).toHaveTextContent(
        "Actions can't be added to a resolved, closed or cancelled ticket."
      );
      expect(screen.queryByRole("button", { name: "Add action" })).toBeNull();
      expect(
        within(list)
          .getAllByRole("button")
          .map((button) => button.textContent)
      ).toEqual(["View"]);
    }
  );

  it("reloads the Ticket and explains when the server refuses with TICKET_NOT_ACTIONABLE", async () => {
    const server = serve([], {
      onWrite: (_call, current) => {
        // The Ticket was resolved by someone else after this screen loaded.
        current.ticket = { ...TICKET, currentStatus: "RESOLVED", version: 2 };

        return error(
          "TICKET_NOT_ACTIONABLE",
          "This ticket no longer takes actions.",
          409
        );
      },
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await submit(user);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add action" })).toBeNull()
    );
    expect(await section()).toHaveTextContent(
      "Actions can't be added to a resolved, closed or cancelled ticket."
    );
    // The Ticket was read again: opening, then after the refusal.
    expect(
      server.calls.filter(
        (call) => call.method === "GET" && /\/api\/tickets\/42$/u.test(call.url)
      ).length
    ).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("form", { name: "Add action" })).toBeNull();
  });

  it("explains an edit of an Action someone else completed", async () => {
    serve([action({ id: 1 })], {
      onWrite: (_call, current) => {
        const [first] = current.actions;

        if (first) {
          Object.assign(first, {
            state: "DONE",
            result: "Done elsewhere",
            version: 2,
          });
        }

        return error("ACTION_NOT_EDITABLE", "Already completed.", 409);
      },
    });
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "Edit action #1" }));
    await screen.findByRole("form", { name: "Edit action #1" });
    await user.type(inForm().getByLabelText(/^Description/u), " more");
    await submit(user);

    expect(
      await screen.findByText("This action has already been completed.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Edit action #1" })).toBeNull();
    expect(
      within(await table()).queryByRole("button", { name: /Edit action/u })
    ).toBeNull();
  });
});

describe("UI-29 double submit", () => {
  it("sends one request for two rapid submits, and the control is disabled and busy", async () => {
    let release: (response: Response) => void = () => undefined;
    const server = serve([], {
      onWrite: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();

    asStaff();
    const form = await openAddForm(user);
    await typeDescription(user);

    // Two submits before the first request has answered. The button disables
    // itself, but the second submit can still arrive in the same tick, which is
    // why the guard is a ref and not only the disabled state.
    fireEvent.submit(form);
    fireEvent.submit(form);

    const busy = await screen.findByRole("button", { name: "Saving…" });

    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(writes(server)).toHaveLength(1);

    release(
      jsonResponse(
        action({ id: 9, description: "Swapped the patch cable" }),
        201
      )
    );

    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );
    expect(writes(server)).toHaveLength(1);
  });

  it("sends one request for a double click on Save", async () => {
    let release: (response: Response) => void = () => undefined;
    const server = serve([], {
      onWrite: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await user.dblClick(screen.getByRole("button", { name: "Save" }));

    expect(writes(server)).toHaveLength(1);

    release(jsonResponse(action({ id: 9 }), 201));
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );
  });
});

describe("UI-29 a form in flight takes no edits", () => {
  it("disables the create form's fields while the request is pending, so no edit can be lost", async () => {
    let release: (response: Response) => void = () => undefined;
    serve([], {
      onWrite: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await submit(user);
    await screen.findByRole("button", { name: "Saving…" });

    expect(inForm().getByLabelText(/^Description/u)).toBeDisabled();
    expect(inForm().getByLabelText(/^Result/u)).toBeDisabled();
    expect(inForm().getByLabelText(/^Date\/time/u)).toBeDisabled();

    release(jsonResponse(action({ id: 9 }), 201));
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );
  });

  it("enables the fields again, keeping the text, when the write is refused", async () => {
    const server = serve([], {
      onWrite: () => error("INTERNAL_ERROR", "Something went wrong.", 500),
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user);
    await submit(user);

    await screen.findByText("Something went wrong.");

    const description = inForm().getByLabelText(/^Description/u);

    expect(description).toBeEnabled();
    expect(description).toHaveValue("Swapped the patch cable");
    expect(writes(server)).toHaveLength(1);
  });

  it("disables the complete form's field while the request is pending", async () => {
    let release: (response: Response) => void = () => undefined;
    serve([action({ id: 1 })], {
      onWrite: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();

    asStaff();
    await user.click(
      await within(await table()).findByRole("button", {
        name: "Complete action #1",
      })
    );
    await user.type(inForm().getByLabelText(/^Result/u), "Fixed");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("button", { name: "Completing…" });

    expect(inForm().getByLabelText(/^Result/u)).toBeDisabled();

    release(jsonResponse(action({ id: 1, state: "DONE", result: "Fixed" })));
    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: /^Complete action/u })
      ).toBeNull()
    );
  });
});

describe("UI-29 a write that answers after another form opened", () => {
  it("does not close the newer form or discard its draft", async () => {
    let release: (response: Response) => void = () => undefined;
    const server = serve(
      [action({ id: 1 }), action({ id: 2, description: "Second" })],
      {
        onWrite: () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      }
    );
    const user = userEvent.setup();

    asStaff();

    const rows = within(await table())
      .getAllByRole("row")
      .slice(1);

    await user.click(
      within(rows[0] as HTMLElement).getByRole("button", {
        name: "Edit action #1",
      })
    );
    await user.type(inForm().getByLabelText(/^Description/u), " again");
    await submit(user);
    await screen.findByRole("button", { name: "Saving…" });

    // Another row's form opens while the first write is still out.
    await user.click(
      within(rows[1] as HTMLElement).getByRole("button", {
        name: "Complete action #2",
      })
    );
    await user.type(inForm().getByLabelText(/^Result/u), "half typed");

    release(
      jsonResponse(
        action({
          id: 1,
          description: "Replaced the faulty access point again",
          version: 2,
        })
      )
    );

    // onSaved has run once the Actions are read again after the save.
    await waitFor(() => expect(server.actionReads).toBeGreaterThan(1));

    const newer = screen.getByRole("form", { name: "Complete action #2" });

    expect(within(newer).getByLabelText(/^Result/u)).toHaveValue("half typed");
  });
});

describe("UI-30 a stale Action write", () => {
  const staleServer = (opts: { reloadFails?: boolean } = {}) => {
    let refuse = true;

    const server = serve([action({ id: 1, version: 1 })], {
      ...(opts.reloadFails ? { actionReadsFail: true } : {}),
      onWrite: (_call, current) => {
        if (refuse) {
          // Someone else saved first: the stored copy moves on.
          Object.assign(current.actions[0] ?? {}, {
            version: 3,
            description: "Changed by a colleague",
          });

          return error("STALE_UPDATE", "Changed since you opened it.", 409);
        }

        return undefined;
      },
    });

    return {
      server,
      accept: () => {
        refuse = false;
      },
    };
  };

  it("shows the message, loads the latest, keeps the typed text, and retries on the new version", async () => {
    const { server, accept } = staleServer();
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "Edit action #1" }));
    await screen.findByRole("form", { name: "Edit action #1" });

    const description = inForm().getByLabelText(/^Description/u);

    await user.clear(description);
    await user.type(description, "My careful wording");
    await submit(user);

    const alert = await screen.findByText(STALE_MESSAGE);

    expect(alert).toHaveAttribute("role", "alert");
    // Typed text survives; the list behind it shows what is stored now.
    expect(inForm().getByLabelText(/^Description/u)).toHaveValue(
      "My careful wording"
    );
    expect(await table()).toHaveTextContent("Changed by a colleague");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(
      screen.getByRole("form", { name: "Edit action #1" })
    ).toHaveAccessibleDescription(STALE_MESSAGE);

    accept();
    await submit(user);
    await waitFor(() => expect(writes(server)).toHaveLength(2));

    expect(writes(server)[0]?.body?.["version"]).toBe(1);
    expect(writes(server)[1]?.body?.["version"]).toBe(3);
    expect(writes(server)[1]?.body?.["description"]).toBe("My careful wording");
  });

  it("does not claim the latest version was loaded when the reload fails", async () => {
    const { server } = staleServer({ reloadFails: true });
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(screen.getByRole("button", { name: "Edit action #1" }));
    await screen.findByRole("form", { name: "Edit action #1" });
    await user.type(inForm().getByLabelText(/^Description/u), "!");
    await submit(user);

    expect(await screen.findByText(RELOAD_FAILED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(STALE_MESSAGE)).toBeNull();
    expect(inForm().getByLabelText(/^Description/u)).toHaveValue(
      "Replaced the faulty access point!"
    );
    expect(writes(server)).toHaveLength(1);
  });

  it("uses the same wording on the complete form", async () => {
    staleServer();
    const user = userEvent.setup();

    asStaff();
    await table();
    await user.click(
      screen.getByRole("button", { name: "Complete action #1" })
    );
    await screen.findByRole("form", { name: "Complete action #1" });
    await user.type(inForm().getByLabelText(/^Result/u), "Done it");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(STALE_MESSAGE)).toBeInTheDocument();
    expect(inForm().getByLabelText(/^Result/u)).toHaveValue("Done it");
  });
});

describe("UI-38 the request key across retries", () => {
  const keysOf = (server: Server) =>
    writes(server).map((call) => call.body?.["requestId"]);

  it("sends a UUID and resends the same one after a failed submit, an edit and a lost response", async () => {
    let attempt = 0;
    const server = serve([], {
      onWrite: () => {
        attempt += 1;

        if (attempt === 1) {
          return error("INTERNAL_ERROR", "Something went wrong.", 500);
        }

        if (attempt === 2) {
          // A response that never arrived: fetch rejects, the screen cannot
          // tell whether the first request was stored.
          return Promise.reject(new TypeError("Failed to fetch")) as never;
        }

        return undefined;
      },
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user, "First wording");
    await submit(user);

    expect(
      await screen.findByText("Something went wrong.")
    ).toBeInTheDocument();

    await user.type(inForm().getByLabelText(/^Description/u), " and more");
    await submit(user);

    await waitFor(() => expect(writes(server)).toHaveLength(2));
    await screen.findByText("Unable to connect to the TokTickIT API.");

    await submit(user);

    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );

    const keys = keysOf(server);

    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(UUID);
    expect(new Set(keys).size).toBe(1);
    // The edited description rode along under the same key.
    expect(writes(server)[2]?.body?.["description"]).toBe(
      "First wording and more"
    );
  });

  it("treats a 200 replay as success, with one row and no second create", async () => {
    const server = serve([], {
      onWrite: (_call, current) => {
        // The first attempt was stored; this answer is the replay of it.
        const stored = action({ id: 7, description: "Stored once" });

        current.actions.push(stored);

        return jsonResponse(stored, 200);
      },
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user, "Stored once");
    await submit(user);

    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );

    const rows = within(await table())
      .getAllByRole("row")
      .slice(1);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Stored once");
    expect(writes(server)).toHaveLength(1);
  });

  it("mints a new key after a save and for a fresh Add action", async () => {
    const server = serve([]);
    const user = userEvent.setup();

    asStaff();

    await openAddForm(user);
    await typeDescription(user, "First");
    await submit(user);
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );

    await openAddForm(user);
    await typeDescription(user, "Second");
    await submit(user);
    await waitFor(() => expect(writes(server)).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add action" })).toBeNull()
    );

    // Opened, abandoned, opened again without saving: still a new Action, so a new key.
    await openAddForm(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await openAddForm(user);
    await typeDescription(user, "Third");
    await submit(user);
    await waitFor(() => expect(writes(server)).toHaveLength(3));

    const keys = keysOf(server);

    expect(new Set(keys).size).toBe(3);
    for (const key of keys) {
      expect(key).toMatch(UUID);
    }
  });

  it("on REQUEST_ID_CONFLICT reloads the list, keeps the input, says so, and rotates the key", async () => {
    let attempt = 0;
    const server = serve([], {
      onWrite: () => {
        attempt += 1;

        return attempt === 1
          ? error("REQUEST_ID_CONFLICT", "That key was used already.", 409)
          : undefined;
      },
    });
    const user = userEvent.setup();

    asStaff();
    await openAddForm(user);
    await typeDescription(user, "My wording");
    await submit(user);

    expect(
      await screen.findByText(
        "An earlier attempt may already have been saved — check the list."
      )
    ).toBeInTheDocument();
    expect(inForm().getByLabelText(/^Description/u)).toHaveValue("My wording");
    expect(server.actionReads).toBeGreaterThanOrEqual(2);

    await submit(user);
    await waitFor(() => expect(writes(server)).toHaveLength(2));

    const [first, second] = keysOf(server);

    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(second).not.toBe(first);
  });
});
