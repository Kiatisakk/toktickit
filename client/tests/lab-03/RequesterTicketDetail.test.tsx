import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicComment } from "../../src/lib/api";
import {
  jsonResponse,
  NO_COMMENTS,
  renderAt,
  TICKET,
} from "../lab-02/ticketDetailHarness";
import { ADMIN_USER, authContext, STAFF_USER } from "../support/auth";

/**
 * What Lab 3 adds to the Requester's Ticket Detail (ui-spec.md §7, Issue #49):
 * Public Comments with a composer, and the "problem appears resolved"
 * indication. Covers UI-18 and UI-20.
 */

const FIRST: PublicComment = {
  id: 1,
  body: "It happened again this morning.",
  author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
  createdAt: "2026-09-15T08:00:00.000Z",
};

const REPLY: PublicComment = {
  id: 2,
  body: "Thanks — replacing the battery.",
  author: { id: 11, name: "Michael Brown", role: "IT_STAFF" },
  createdAt: "2026-09-15T09:30:00.000Z",
};

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/**
 * A small fake API for this screen, recording what was sent.
 *
 * `onPost` decides how the comment and indication endpoints answer, so each
 * test states the one behaviour it is about.
 */
const api = ({
  ticket = TICKET as typeof TICKET,
  comments = [] as PublicComment[],
  onPost = (_call: Call): Promise<Response> =>
    Promise.resolve(jsonResponse(null, 204)),
} = {}) => {
  const calls: Call[] = [];
  let current = ticket;

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { url, method, body };

    calls.push(call);

    if (method === "POST") {
      if (url.endsWith("/resolved-indication")) {
        return onPost(call).then((response) => {
          if (response.status === 204) {
            current = {
              ...current,
              resolvedIndicatedAt: "2026-09-16T10:05:00.000Z",
            };
          }
          return response;
        });
      }

      return onPost(call);
    }

    if (url.endsWith("/comments")) {
      return Promise.resolve(
        jsonResponse(comments.length ? { data: comments } : NO_COMMENTS)
      );
    }

    return Promise.resolve(jsonResponse(current));
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls };
};

const user = () => userEvent.setup();

// Everything here is two requests deep — the ticket, then its comments — and
// under the full parallel run the default one-second wait for the second was
// observed to run out while the same tests passed alone. Five seconds is a
// wait, not a retry: a test that should fail still fails, just later. Vitest
// isolates each file, so this setting reaches no other suite.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-18 no Internal Notes section", () => {
  it("renders no notes heading, control or placeholder anywhere on the Requester's screen", async () => {
    const { calls } = api({ comments: [FIRST, REPLY] });

    renderAt();

    await screen.findByText(FIRST.body);

    expect(screen.queryByText(/internal note/iu)).toBeNull();
    expect(screen.queryByRole("region", { name: /note/iu })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /note/iu })).toBeNull();
    // Not hidden either: nothing on the screen ever asks the notes endpoint.
    expect(calls.some((call) => call.url.includes("/notes"))).toBe(false);
  });
});

describe("Public Comments", () => {
  it("lists each comment oldest first with its author, role and time", async () => {
    api({ comments: [FIRST, REPLY] });

    renderAt();

    const list = await screen.findByRole("list", {
      name: /public comments, oldest first/iu,
    });
    const entries = within(list).getAllByRole("listitem");

    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(FIRST.body);
    expect(entries[0]).toHaveTextContent("Jennifer Anderson");
    expect(entries[0]).toHaveTextContent("Requester");
    expect(entries[1]).toHaveTextContent(REPLY.body);
    expect(entries[1]).toHaveTextContent("Michael Brown");
    expect(entries[1]).toHaveTextContent("IT Staff");
    expect(entries[1]?.querySelector("time")?.getAttribute("dateTime")).toBe(
      REPLY.createdAt
    );
    expect(screen.getByText("Visible to the Requester")).toBeInTheDocument();
  });

  it("says so when there are no comments yet", async () => {
    api();

    renderAt();

    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders markup in a comment as text (BR-31)", async () => {
    api({
      comments: [{ ...FIRST, body: "<img src=x onerror=alert(1)><b>bold</b>" }],
    });

    const { container } = renderAt();

    expect(
      await screen.findByText("<img src=x onerror=alert(1)><b>bold</b>")
    ).toBeInTheDocument();
    expect(
      container.querySelector(".tkt-comments img, .tkt-comments b")
    ).toBeNull();
  });

  it("refuses an empty or whitespace-only comment without sending it", async () => {
    const { calls } = api();

    renderAt();

    await screen.findByText("No comments yet.");

    await user().type(screen.getByLabelText(/add a comment/iu), "   ");
    await user().click(screen.getByRole("button", { name: "Post Comment" }));

    expect(
      await screen.findByText("Write something before posting.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/add a comment/iu)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });

  it("posts the text, shows the entry at the foot of the list, and clears the composer", async () => {
    const posted: PublicComment = {
      id: 3,
      body: "Still fine after a restart.",
      author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
      createdAt: "2026-09-16T10:00:00.000Z",
    };
    const { calls } = api({
      comments: [FIRST],
      onPost: () => Promise.resolve(jsonResponse(posted, 201)),
    });

    renderAt();

    await screen.findByText(FIRST.body);

    const composer = screen.getByLabelText(/add a comment/iu);

    await user().type(composer, "Still fine after a restart.");
    await user().click(screen.getByRole("button", { name: "Post Comment" }));

    const list = screen.getByRole("list", { name: /oldest first/iu });

    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    );
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent(
      posted.body
    );
    expect(composer).toHaveValue("");

    const post = calls.find((call) => call.method === "POST");

    expect(post?.url).toMatch(/\/api\/tickets\/42\/comments$/u);
    // The body and nothing else: no author, no time (BR-29).
    expect(post?.body).toStrictEqual({ body: "Still fine after a restart." });
  });

  it("is busy while posting, so a second click cannot send it twice", async () => {
    let finish: (response: Response) => void = () => undefined;
    const { calls } = api({
      onPost: () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });

    renderAt();

    await screen.findByText("No comments yet.");
    await user().type(screen.getByLabelText(/add a comment/iu), "Hello");
    await user().click(screen.getByRole("button", { name: "Post Comment" }));

    const busy = await screen.findByRole("button", { name: /posting/iu });

    expect(busy).toBeDisabled();
    await user().click(busy);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);

    finish(
      jsonResponse(
        {
          ...FIRST,
          id: 9,
          body: "Hello",
          createdAt: "2026-09-16T10:00:00.000Z",
        },
        201
      )
    );

    expect(
      await screen.findByRole("button", { name: "Post Comment" })
    ).toBeEnabled();
  });

  it("keeps the typed text when posting fails", async () => {
    api({
      onPost: () =>
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

    renderAt();

    await screen.findByText("No comments yet.");

    const composer = screen.getByLabelText(/add a comment/iu);

    await user().type(composer, "A paragraph I do not want to lose.");
    await user().click(screen.getByRole("button", { name: "Post Comment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong"
    );
    expect(composer).toHaveValue("A paragraph I do not want to lose.");
  });

  it("places a validation refusal from the server beside the field", async () => {
    api({
      onPost: () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "The comment could not be posted.",
                details: { body: "Keep it to 5000 characters or fewer." },
              },
            },
            400
          )
        ),
    });

    renderAt();

    await screen.findByText("No comments yet.");
    await user().type(screen.getByLabelText(/add a comment/iu), "x");
    await user().click(screen.getByRole("button", { name: "Post Comment" }));

    expect(
      await screen.findByText("Keep it to 5000 characters or fewer.")
    ).toBeInTheDocument();
  });

  it("offers Try again when the comments cannot be loaded, and the composer stays usable", async () => {
    let failing = true;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/comments")) {
          return Promise.resolve(
            failing
              ? jsonResponse(
                  {
                    error: {
                      code: "INTERNAL_ERROR",
                      message: "Comments are unavailable.",
                    },
                  },
                  500
                )
              : jsonResponse({ data: [FIRST] })
          );
        }

        return Promise.resolve(jsonResponse(TICKET));
      })
    );

    renderAt();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Comments are unavailable."
    );
    expect(screen.getByLabelText(/add a comment/iu)).toBeEnabled();

    failing = false;
    await user().click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(FIRST.body)).toBeInTheDocument();
  });
});

/**
 * Raised in review on PR #63. Both are a success the screen handled as if the
 * step before it had also gone well: a comment posted while the list had not
 * loaded, and an indication recorded when its time could not be read back.
 */
describe("review of PR #63", () => {
  const POSTED: PublicComment = {
    id: 5,
    body: "Posted before the list arrived.",
    author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
    createdAt: "2026-09-17T08:00:00.000Z",
  };

  it.each(["failed", "still loading"] as const)(
    "a comment posted while the list is %s is shown, not lost",
    async (situation) => {
      let reads = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn((url: string, init?: RequestInit) => {
          if (init?.method === "POST") {
            return Promise.resolve(jsonResponse(POSTED, 201));
          }

          if (!url.endsWith("/comments")) {
            return Promise.resolve(jsonResponse(TICKET));
          }

          reads += 1;

          if (reads > 1) {
            return Promise.resolve(jsonResponse({ data: [POSTED] }));
          }

          return situation === "failed"
            ? Promise.resolve(
                jsonResponse(
                  {
                    error: { code: "INTERNAL_ERROR", message: "No comments." },
                  },
                  500
                )
              )
            : new Promise<Response>(() => undefined);
        })
      );

      renderAt();

      const composer = await screen.findByLabelText(/add a comment/iu);

      if (situation === "failed") {
        await screen.findByText("No comments.");
      }

      await user().type(composer, POSTED.body);
      await user().click(screen.getByRole("button", { name: "Post Comment" }));

      const list = await screen.findByRole("list", { name: /oldest first/iu });

      expect(within(list).getByText(POSTED.body)).toBeInTheDocument();
      expect(composer).toHaveValue("");
    }
  );

  it("an indication whose time cannot be read back is confirmed without inventing one", async () => {
    let ticketReads = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve(jsonResponse(null, 204));
        }

        if (url.endsWith("/comments")) {
          return Promise.resolve(jsonResponse(NO_COMMENTS));
        }

        ticketReads += 1;

        return ticketReads === 1
          ? Promise.resolve(jsonResponse(TICKET))
          : Promise.resolve(
              jsonResponse(
                { error: { code: "INTERNAL_ERROR", message: "No." } },
                500
              )
            );
      })
    );

    renderAt();

    await screen.findByText("No comments yet.");
    await user().click(
      screen.getByRole("button", { name: "Problem appears resolved" })
    );
    await user().click(screen.getByRole("button", { name: "Yes, tell IT" }));

    const region = await screen.findByRole("region", {
      name: "Problem appears resolved",
    });

    await waitFor(() =>
      expect(region).toHaveTextContent(
        "You told IT the problem appears resolved."
      )
    );
    expect(region.querySelector("time")).toBeNull();
    expect(region).not.toHaveTextContent(/ on /u);
    expect(
      screen.queryByRole("button", { name: "Problem appears resolved" })
    ).toBeNull();
  });
});

describe("UI-20 the resolved indication", () => {
  const button = () =>
    screen.getByRole("button", { name: "Problem appears resolved" });

  it("is a secondary button that asks for confirmation before it fires", async () => {
    const { calls } = api();

    renderAt();

    await screen.findByText("No comments yet.");

    expect(button()).toHaveClass("tkt-btn--secondary");

    await user().click(button());

    const confirm = screen.getByRole("group", {
      name: /confirm the problem appears resolved/iu,
    });

    expect(confirm).toHaveTextContent("status does not change");
    expect(
      calls.some((call) => call.url.endsWith("/resolved-indication"))
    ).toBe(false);

    await user().click(within(confirm).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: /confirm/iu })).toBeNull();
    expect(button()).toBeInTheDocument();
    expect(
      calls.some((call) => call.url.endsWith("/resolved-indication"))
    ).toBe(false);
  });

  it("once confirmed, is replaced by a statement of when, read back from the server", async () => {
    const { calls } = api();

    renderAt();

    await screen.findByText("No comments yet.");
    await user().click(button());
    await user().click(screen.getByRole("button", { name: "Yes, tell IT" }));

    const region = await screen.findByRole("region", {
      name: "Problem appears resolved",
    });

    await waitFor(() =>
      expect(region).toHaveTextContent(
        "You told IT the problem appears resolved on"
      )
    );
    expect(region.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-09-16T10:05:00.000Z"
    );
    expect(
      screen.queryByRole("button", { name: "Problem appears resolved" })
    ).toBeNull();
    expect(
      calls.filter((call) => call.url.endsWith("/resolved-indication"))
    ).toHaveLength(1);
    // A fact, not a status: no status badge claims Resolved.
    expect(screen.queryByText("Resolved")).toBeNull();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("shows the statement, not the button, on a ticket already indicated", async () => {
    api({
      ticket: { ...TICKET, resolvedIndicatedAt: "2026-09-14T07:00:00.000Z" },
    });

    renderAt();

    const region = await screen.findByRole("region", {
      name: "Problem appears resolved",
    });

    expect(region).toHaveTextContent("You told IT");
    expect(
      screen.queryByRole("button", { name: "Problem appears resolved" })
    ).toBeNull();
  });

  it("keeps the confirmation open and says why when recording fails", async () => {
    api({
      onPost: () =>
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

    renderAt();

    await screen.findByText("No comments yet.");
    await user().click(button());
    await user().click(screen.getByRole("button", { name: "Yes, tell IT" }));

    const confirm = screen.getByRole("group", { name: /confirm/iu });

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Something went wrong"
    );
    expect(
      within(confirm).getByRole("button", { name: "Yes, tell IT" })
    ).toBeEnabled();
  });

  it.each([
    ["IT Staff", STAFF_USER],
    ["an Administrator", ADMIN_USER],
  ])(
    "is never offered to %s, who the server refuses",
    async (_who, signedIn) => {
      api({
        ticket: {
          ...TICKET,
          requester: { id: signedIn.id, name: signedIn.name },
        },
      });

      renderAt("/tickets/42", authContext({ user: signedIn }));

      await screen.findByText("No comments yet.");

      expect(
        screen.queryByRole("button", { name: "Problem appears resolved" })
      ).toBeNull();
    }
  );

  it("tells staff when the requester indicated it", async () => {
    api({
      ticket: { ...TICKET, resolvedIndicatedAt: "2026-09-14T07:00:00.000Z" },
    });

    renderAt("/tickets/42", authContext({ user: STAFF_USER }));

    const region = await screen.findByRole("region", {
      name: "Problem appears resolved",
    });

    expect(region).toHaveTextContent("The requester told IT");
  });
});
