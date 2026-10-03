import { configure, screen, waitFor } from "@testing-library/react";
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
 * what the screen does with `409 STALE_UPDATE` (ui-spec.md section 8, AC-42).
 *
 * The resolve dialog's summary text is Issue #75's, so the "keeps what the user
 * typed" half of AC-42 is proved there; every control here is a select or a
 * button, which holds no typed text to keep.
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
