import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  jsonResponse,
  NO_COMMENTS,
  renderAt,
  TICKET,
} from "../lab-02/ticketDetailHarness";
import { authContext, STAFF_USER } from "../support/auth";

/**
 * UI-35 and UI-36 for the Ticket forms — the version a staff write sends, and
 * what the screen does with `409 STALE_UPDATE` (ui-spec.md section 8, AC-42) —
 * and, from Issue #75, the resolve dialog: UI-32, UI-33, UI-34, UI-37 and the
 * "keeps what the user typed" half of UI-36 (ui-spec.md section 7, AC-41).
 * Every control in the first half is a select or a button, which holds no typed
 * text to keep; the dialog's summary box does.
 */

// Two requests deep, as the other staff suites are: the ticket, then its comments.
configure({ asyncUtilTimeout: 5000 });

const STALE_MESSAGE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

const RELOAD_FAILED_MESSAGE =
  "This record was changed by someone else since you opened it, but the latest version could not be loaded. What you see may be out of date — reload the page before trying again.";

const OWNERS = [
  { id: 11, name: "Michael Brown" },
  { id: 16, name: "Wanida Thongchai" },
];

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const staleResponse = () =>
  jsonResponse(
    {
      error: {
        code: "STALE_UPDATE",
        message:
          "This ticket was changed by someone else since you opened it. Reload it and try again.",
      },
    },
    409
  );

/**
 * A server whose Ticket has moved on: the first read answers `opened`, every
 * later read answers `latest`, and a PATCH is refused as stale until
 * `refuseWrites` is turned off.
 */
const staleServer = (
  opened: object,
  latest: object,
  { reloadFails = false }: { reloadFails?: boolean } = {}
) => {
  const calls: Call[] = [];
  let reads = 0;
  let refuseWrites = true;

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      calls.push({ url, method, body });

      if (method === "PATCH") {
        return Promise.resolve(
          refuseWrites
            ? staleResponse()
            : jsonResponse({ ...latest, ...(body as object), version: 3 })
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

      reads += 1;

      if (reads > 1 && reloadFails) {
        return Promise.resolve(
          jsonResponse(
            { error: { code: "INTERNAL", message: "Something went wrong." } },
            500
          )
        );
      }

      return Promise.resolve(jsonResponse(reads === 1 ? opened : latest));
    })
  );

  return {
    calls,
    accept: () => {
      refuseWrites = false;
    },
  };
};

const asStaff = () =>
  renderAt("/tickets/42", authContext({ user: STAFF_USER }));

const patches = (calls: Call[]) =>
  calls.filter((call) => call.method === "PATCH");

const ticketReads = (calls: Call[]) =>
  calls.filter(
    (call) => call.method === "GET" && /\/api\/tickets\/42$/u.test(call.url)
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-35 a staff write sends the version it read", () => {
  it("sends the Ticket's version on a status change, and the newer one on the next", async () => {
    const calls: Call[] = [];
    let current: Record<string, unknown> = {
      ...TICKET,
      currentStatus: "NEW",
      version: 4,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const body =
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

        calls.push({ url, method, body });

        if (method === "PATCH") {
          const sent = body as { status: string; version: number };

          current = {
            ...current,
            currentStatus: sent.status,
            version: sent.version + 1,
          };

          return Promise.resolve(jsonResponse(current));
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

        return Promise.resolve(jsonResponse(current));
      })
    );

    asStaff();

    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /current status/iu }),
      "OPEN"
    );
    await waitFor(() => expect(patches(calls)).toHaveLength(1));

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /current status/iu }),
      "IN_PROGRESS"
    );
    await waitFor(() => expect(patches(calls)).toHaveLength(2));

    expect(patches(calls)[0]?.body).toStrictEqual({
      status: "OPEN",
      version: 4,
    });
    expect(patches(calls)[1]?.body).toStrictEqual({
      status: "IN_PROGRESS",
      version: 5,
    });
  });

  it("sends the version with a claim and with an IT Priority change", async () => {
    const { calls, accept } = staleServer(
      { ...TICKET, ticketOwner: null, version: 7 },
      { ...TICKET, ticketOwner: null, version: 7 }
    );

    accept();
    asStaff();

    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Claim" }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /it priority/iu }),
      "HIGH"
    );
    await waitFor(() => expect(patches(calls)).toHaveLength(2));

    expect(patches(calls)[0]?.body).toStrictEqual({
      ownerId: STAFF_USER.id,
      version: 7,
    });
    // The claim's response carried version 3, which is what the next write
    // names.
    expect(patches(calls)[1]?.body).toStrictEqual({
      itPriority: "HIGH",
      version: 3,
    });
  });
});

describe("UI-36 a stale write shows the message and reloads the Ticket", () => {
  it("shows the stale message beside the status control, reloads, and re-enables it", async () => {
    const { calls, accept } = staleServer(
      { ...TICKET, currentStatus: "NEW", version: 1 },
      { ...TICKET, currentStatus: "OPEN", version: 2 }
    );

    asStaff();

    const user = userEvent.setup();
    const control = await screen.findByRole("combobox", {
      name: /current status/iu,
    });

    await user.selectOptions(control, "CANCELLED");

    // The select carries the message as its own error and a separate alert
    // repeats it for a screen reader: either is the stale message.
    const alerts = await screen.findAllByRole("alert");

    expect(alerts.some((one) => one.textContent === STALE_MESSAGE)).toBe(true);

    // The latest Ticket was fetched and is what is on screen: it is Open now,
    // so the control offers In Progress, which it did not from New.
    await waitFor(() => expect(ticketReads(calls)).toHaveLength(2));
    expect(
      await screen.findByRole("option", { name: "In Progress" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /current status/iu })
    ).toBeEnabled();

    // And the retry carries the version that was just loaded.
    accept();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /current status/iu }),
      "IN_PROGRESS"
    );
    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    expect(patches(calls)[0]?.body).toMatchObject({ version: 1 });
    expect(patches(calls)[1]?.body).toMatchObject({
      status: "IN_PROGRESS",
      version: 2,
    });
  });

  it("says so, and does not claim fresh data, when the reload itself fails", async () => {
    const { calls } = staleServer(
      { ...TICKET, currentStatus: "NEW", version: 1 },
      { ...TICKET, currentStatus: "OPEN", version: 2 },
      { reloadFails: true }
    );

    asStaff();

    const user = userEvent.setup();
    const control = await screen.findByRole("combobox", {
      name: /current status/iu,
    });

    await user.selectOptions(control, "CANCELLED");

    await waitFor(() => expect(ticketReads(calls)).toHaveLength(2));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("alert")
          .some((one) => one.textContent === RELOAD_FAILED_MESSAGE)
      ).toBe(true);
    });

    // The wording that says the latest version was loaded must not remain.
    expect(screen.queryByText(STALE_MESSAGE)).toBeNull();
    expect(
      screen
        .getAllByRole("alert")
        .some((one) => one.textContent?.includes("We've loaded the latest"))
    ).toBe(false);
  });

  it("does the same for a claim and for IT Priority", async () => {
    const { calls } = staleServer(
      { ...TICKET, ticketOwner: null, itPriority: "LOW", version: 1 },
      { ...TICKET, ticketOwner: OWNERS[1], itPriority: "LOW", version: 2 }
    );

    asStaff();

    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Claim" }));

    // The Ticket was taken by someone else in the meantime: after the reload
    // it shows that owner, and the Claim button is gone.
    const alerts = await screen.findAllByRole("alert");

    expect(alerts.some((one) => one.textContent === STALE_MESSAGE)).toBe(true);
    expect(
      await screen.findByRole("combobox", { name: /ticket owner/iu })
    ).toHaveValue(String(OWNERS[1]?.id));
    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
    expect(ticketReads(calls)).toHaveLength(2);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /it priority/iu }),
      "HIGH"
    );

    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    await waitFor(() => expect(ticketReads(calls)).toHaveLength(3));
    expect(
      screen
        .getAllByRole("alert")
        .some((one) => one.textContent?.includes(STALE_MESSAGE))
    ).toBe(true);
  });

  it("does not use the stale wording for another refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve(
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

        return Promise.resolve(jsonResponse(TICKET));
      })
    );

    asStaff();

    await userEvent
      .setup()
      .selectOptions(
        await screen.findByRole("combobox", { name: /current status/iu }),
        "OPEN"
      );

    const alerts = await screen.findAllByRole("alert");

    expect(
      alerts.some(
        (one) =>
          one.textContent ===
          "That is not a permitted status change for this ticket."
      )
    ).toBe(true);
    expect(screen.queryByText(STALE_MESSAGE)).toBeNull();
  });
});

/* ----------------------------------------------- the resolve dialog (#75) -- */

interface ActionRow {
  id: number;
  state: "PLANNED" | "DONE" | "CANCELLED";
  followUpState: "NOT_REQUIRED" | "VOID" | "OPEN" | "CLOSED";
}

const DONE_ACTION: ActionRow = {
  id: 1,
  state: "DONE",
  followUpState: "NOT_REQUIRED",
};

const SUMMARY_TEXT = "Replaced the access point.";

const GATE_REFUSAL = {
  error: {
    code: "RESOLUTION_GATE_FAILED",
    message: "This ticket cannot be resolved yet.",
    details: {
      doneAction: "Record at least one completed action before resolving.",
      openFollowUp: "2 follow-ups are still open.",
      plannedActions:
        "Complete or cancel the 1 planned action before resolving.",
    },
  },
};

/**
 * A server for the resolve dialog. `actions` is read at the moment the dialog
 * asks, so a test can change it between two openings; `patchAnswer` decides
 * what a status change is answered.
 */
const dialogServer = (
  options: {
    actions?: () => ActionRow[];
    patchAnswer?: (body: Record<string, unknown>) => Response;
    ticket?: object;
  } = {}
) => {
  const calls: Call[] = [];
  let ticketReads = 0;
  const base = { ...TICKET, currentStatus: "IN_PROGRESS", version: 4 };

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      calls.push({ url, method, body });

      if (method === "PATCH") {
        return Promise.resolve(
          options.patchAnswer?.(body as Record<string, unknown>) ??
            jsonResponse({
              ...base,
              currentStatus: "RESOLVED",
              resolutionSummary: (body as { resolutionSummary: string })
                .resolutionSummary,
              version: 5,
            })
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
        return Promise.resolve(
          jsonResponse({ data: options.actions?.() ?? [DONE_ACTION] })
        );
      }

      ticketReads += 1;

      return Promise.resolve(jsonResponse(options.ticket ?? base));
    })
  );

  return { calls, reads: () => ticketReads };
};

const openResolveDialog = async () => {
  const user = userEvent.setup();

  await user.selectOptions(
    await screen.findByRole("combobox", { name: /current status/iu }),
    "RESOLVED"
  );

  const dialog = await screen.findByRole("dialog", {
    name: /resolve ticket tkt-2026-000042/iu,
  });

  return { user, dialog };
};

/** Each checklist line as text a person reads, hidden state included. */
const checklist = (dialog: HTMLElement) =>
  within(
    within(dialog).getByRole("list", { name: /conditions for resolving/iu })
  )
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");

describe("UI-32 the resolve dialog and its four-condition checklist", () => {
  it("opens instead of changing the status, with the summary box and the four conditions", async () => {
    const { calls } = dialogServer();

    asStaff();

    const { dialog } = await openResolveDialog();

    expect(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    ).toBeDisabled();
    expect(patches(calls)).toHaveLength(0);

    await waitFor(() => {
      expect(checklist(dialog)).toStrictEqual([
        "At least one completed action — met",
        "No open follow-ups — met",
        "No planned actions pending — met",
        "Resolution summary entered — not met",
      ]);
    });
  });

  it("shows each unmet condition in text, with the count and a link, from the loaded Actions", async () => {
    dialogServer({
      actions: () => [
        { id: 7, state: "PLANNED", followUpState: "NOT_REQUIRED" },
        { id: 8, state: "DONE", followUpState: "OPEN" },
        { id: 9, state: "DONE", followUpState: "OPEN" },
        { id: 10, state: "CANCELLED", followUpState: "VOID" },
      ],
    });

    asStaff();

    const { dialog } = await openResolveDialog();

    await waitFor(() => {
      expect(checklist(dialog)).toStrictEqual([
        "At least one completed action — met",
        "No open follow-ups — 2 open — not metView the first",
        "No planned actions pending — 1 planned — not metView the first",
        "Resolution summary entered — not met",
      ]);
    });

    const links = within(dialog).getAllByRole("link", {
      name: /view the first/iu,
    });

    expect(links.map((link) => link.getAttribute("href"))).toStrictEqual([
      "#action-8",
      "#action-7",
    ]);
  });

  it("marks the summary condition met as soon as something is typed, and counts the characters", async () => {
    dialogServer();

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      "Fixed"
    );

    expect(checklist(dialog)[3]).toBe("Resolution summary entered — met");
    expect(within(dialog).getByText("5 / 2000 characters")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    ).toBeEnabled();
  });

  it("keeps Confirm disabled for a summary of only whitespace", async () => {
    dialogServer();

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      "   "
    );

    expect(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    ).toBeDisabled();
    expect(checklist(dialog)[3]).toBe("Resolution summary entered — not met");
  });
});

describe("UI-32 the dialog is a real modal", () => {
  it("moves focus in, traps Tab, closes on Escape and returns focus to the control", async () => {
    const { calls } = dialogServer();

    asStaff();

    const status = await screen.findByRole("combobox", {
      name: /current status/iu,
    });
    const user = userEvent.setup();

    status.focus();
    await user.selectOptions(status, "RESOLVED");

    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();

    // Confirm is disabled, so Cancel is the last stop; Tab from it comes back
    // to the first (the summary box), and Shift+Tab from there goes to Cancel.
    const summary = within(dialog).getByRole("textbox", {
      name: /resolution summary/iu,
    });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });

    cancel.focus();
    await user.tab();
    expect(summary).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(status).toHaveFocus();
    expect(patches(calls)).toHaveLength(0);
  });

  it("Cancel closes it and applies nothing", async () => {
    const { calls } = dialogServer();

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      "Half written"
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patches(calls)).toHaveLength(0);
    expect(screen.getByText("Now In Progress.")).toBeInTheDocument();
  });
});

describe("UI-33 a gate refusal updates the checklist", () => {
  it("replaces the checklist with the server's list, each message beside its condition, and leaves the status alone", async () => {
    // The loaded Actions say every action condition is met; the server
    // disagrees, and the server wins.
    dialogServer({
      patchAnswer: () => jsonResponse(GATE_REFUSAL, 400),
    });

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      SUMMARY_TEXT
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => {
      expect(checklist(dialog)[0]).toContain("not met");
    });

    const lines = checklist(dialog);

    expect(lines[0]).toContain(GATE_REFUSAL.error.details.doneAction);
    expect(lines[1]).toContain(GATE_REFUSAL.error.details.openFollowUp);
    expect(lines[2]).toContain(GATE_REFUSAL.error.details.plannedActions);
    // The summary was not named, so it stays met.
    expect(lines[3]).toBe("Resolution summary entered — met");

    expect(
      within(dialog)
        .getAllByRole("alert")
        .some((one) => one.textContent === GATE_REFUSAL.error.message)
    ).toBe(true);

    // The dialog stays open with the text, and the Ticket is unchanged.
    expect(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu })
    ).toHaveValue(SUMMARY_TEXT);
    expect(screen.getByText("Now In Progress.")).toBeInTheDocument();
  });
});

describe("UI-34 a met gate resolves and refreshes the Ticket", () => {
  it("sends the summary and the version, closes, and shows the new status and summary", async () => {
    const { calls } = dialogServer();

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      SUMMARY_TEXT
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toStrictEqual({
      status: "RESOLVED",
      version: 4,
      resolutionSummary: SUMMARY_TEXT,
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Now Resolved.")).toBeInTheDocument();
    expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
  });

  it("every other status change is still one request with no summary", async () => {
    const { calls } = dialogServer();

    asStaff();

    await userEvent
      .setup()
      .selectOptions(
        await screen.findByRole("combobox", { name: /current status/iu }),
        "WAITING_FOR_REQUESTER"
      );

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toStrictEqual({
      status: "WAITING_FOR_REQUESTER",
      version: 4,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("UI-36 a stale resolve keeps the summary text", () => {
  it("shows the stale message in the dialog, reloads the Ticket, keeps what was typed and retries with the new version", async () => {
    let refuse = true;
    const { calls, reads } = dialogServer({
      patchAnswer: (body) =>
        refuse
          ? staleResponse()
          : jsonResponse({
              ...TICKET,
              currentStatus: "RESOLVED",
              resolutionSummary: body["resolutionSummary"],
              version: 6,
            }),
    });

    asStaff();

    const { user, dialog } = await openResolveDialog();
    const box = within(dialog).getByRole("textbox", {
      name: /resolution summary/iu,
    });

    await user.type(box, SUMMARY_TEXT);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => {
      expect(
        within(dialog)
          .getAllByRole("alert")
          .some((one) => one.textContent === STALE_MESSAGE)
      ).toBe(true);
    });

    // Reloaded behind the dialog, which stays open with the text.
    expect(reads()).toBe(2);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(box).toHaveValue(SUMMARY_TEXT);

    refuse = false;
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    expect(patches(calls)[1]?.body).toMatchObject({
      resolutionSummary: SUMMARY_TEXT,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says so, and does not claim fresh data, when the reload fails", async () => {
    let ticketReads = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve(staleResponse());
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
          return Promise.resolve(jsonResponse({ data: [DONE_ACTION] }));
        }

        ticketReads += 1;

        return Promise.resolve(
          ticketReads === 1
            ? jsonResponse({ ...TICKET, currentStatus: "IN_PROGRESS" })
            : jsonResponse(
                {
                  error: { code: "INTERNAL", message: "Something went wrong." },
                },
                500
              )
        );
      })
    );

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      SUMMARY_TEXT
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => {
      expect(
        within(dialog)
          .getAllByRole("alert")
          .some((one) => one.textContent === RELOAD_FAILED_MESSAGE)
      ).toBe(true);
    });
    expect(within(dialog).queryByText(STALE_MESSAGE)).toBeNull();
  });
});

describe("UI-37 the planned-action condition", () => {
  it("shows 'No planned actions pending' as not met with the count and a link, and a server refusal sets the same state", async () => {
    dialogServer({
      actions: () => [
        { id: 3, state: "PLANNED", followUpState: "NOT_REQUIRED" },
        DONE_ACTION,
      ],
      patchAnswer: () =>
        jsonResponse(
          {
            error: {
              code: "RESOLUTION_GATE_FAILED",
              message: "This ticket cannot be resolved yet.",
              details: {
                plannedActions:
                  "Complete or cancel the 1 planned action before resolving.",
              },
            },
          },
          400
        ),
    });

    asStaff();

    const { user, dialog } = await openResolveDialog();

    await waitFor(() => {
      expect(checklist(dialog)[2]).toBe(
        "No planned actions pending — 1 planned — not metView the first"
      );
    });
    expect(
      within(dialog).getByRole("link", { name: /view the first/iu })
    ).toHaveAttribute("href", "#action-3");

    await user.type(
      within(dialog).getByRole("textbox", { name: /resolution summary/iu }),
      SUMMARY_TEXT
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => {
      expect(checklist(dialog)[2]).toContain(
        "Complete or cancel the 1 planned action before resolving."
      );
    });
    // The server named only the planned actions: the others read met.
    expect(checklist(dialog)[0]).toContain("— met");
    expect(checklist(dialog)[1]).toContain("— met");
  });

  it("clears once the Action is completed or cancelled: the dialog reads the Actions each time it opens", async () => {
    let actions: ActionRow[] = [
      { id: 3, state: "PLANNED", followUpState: "NOT_REQUIRED" },
      DONE_ACTION,
    ];

    dialogServer({ actions: () => actions });

    asStaff();

    const first = await openResolveDialog();

    await waitFor(() => {
      expect(checklist(first.dialog)[2]).toContain("1 planned");
    });

    await first.user.click(
      within(first.dialog).getByRole("button", { name: "Cancel" })
    );

    // The planned action was completed in the meantime.
    actions = [
      { ...DONE_ACTION },
      { id: 3, state: "DONE", followUpState: "NOT_REQUIRED" },
    ];

    const second = await openResolveDialog();

    await waitFor(() => {
      expect(checklist(second.dialog)[2]).toBe(
        "No planned actions pending — met"
      );
    });
  });
});
