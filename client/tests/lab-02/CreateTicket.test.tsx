import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RequesterContext,
  type RequesterContextValue,
} from "../../src/context/requesterContextValue";
import { CreateTicket } from "../../src/routes/CreateTicket";

/**
 * UI-07 — reference data comes from the API rather than from a constant.
 * UI-08 — validation messages land beside the field they concern.
 * UI-09 — the submit control is disabled and busy while the request runs.
 * UI-10 — a failed submission keeps every value the user typed.
 *
 * `fetch` is stubbed: these assert what the screen does with an answer. Whether
 * the endpoint validates the same rules is API-05's job, one layer down.
 */

const CATEGORIES = [
  { id: 2, name: "Hardware" },
  { id: 4, name: "Network" },
];
const SYSTEMS = [
  { id: 7, name: "Corporate Laptop" },
  { id: 3, name: "VPN" },
];

const REQUESTER = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
};

const CONTEXT: RequesterContextValue = {
  status: "selected",
  requester: REQUESTER,
  generation: 0,
  select: () => undefined,
  clear: () => undefined,
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

/** Answers the two reference calls; POST is supplied per test. */
const referenceFetch = (onPost?: () => Promise<Response>) =>
  vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return onPost ? onPost() : Promise.resolve(jsonResponse({}, 500));
    }

    if (url.includes("/api/categories")) {
      return Promise.resolve(jsonResponse(CATEGORIES));
    }

    return Promise.resolve(jsonResponse(SYSTEMS));
  });

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RequesterContext.Provider value={CONTEXT}>
        <CreateTicket />
      </RequesterContext.Provider>
    </MemoryRouter>
  );

const fillValid = async () => {
  await userEvent.selectOptions(
    await screen.findByLabelText(/^category/i),
    "2"
  );
  await userEvent.selectOptions(screen.getByLabelText(/related system/i), "7");
  await userEvent.type(
    screen.getByLabelText(/^summary/i),
    "Laptop battery drains quickly"
  );
  await userEvent.type(
    screen.getByLabelText(/^description/i),
    "The battery drains much faster than usual even when idle."
  );
};

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: /create ticket/i }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reference data", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  // AC-08 — the options are database rows, not a constant in the source.
  it("loads categories and related systems from the API", async () => {
    renderScreen();

    expect(
      await screen.findByRole("option", { name: "Hardware" })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VPN" })).toBeInTheDocument();
  });

  it("disables the classification fields until they have loaded", () => {
    renderScreen();

    expect(screen.getByLabelText(/^category/i)).toBeDisabled();
  });

  it("shows a failure state when the reference data cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    renderScreen();

    expect(
      await screen.findByText("Could not load the form")
    ).toBeInTheDocument();
  });
});

describe("read-only context", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("shows the current requester without letting it be edited", async () => {
    renderScreen();

    const field = await screen.findByLabelText("Requester");

    expect(field).toHaveValue("Jennifer Anderson");
    expect(field).toHaveAttribute("readonly");
  });

  it("marks the system-generated fields as read-only", async () => {
    renderScreen();

    expect(await screen.findByLabelText("Ticket No.")).toHaveClass(
      "tkt-field--readonly"
    );
    expect(screen.getByLabelText("Ticket Date")).toHaveClass(
      "tkt-field--readonly"
    );
  });

  // The date belongs to the server's createdAt. Showing this browser's clock
  // would be a guess, and a wrong one across midnight or with any skew.
  it("does not guess the ticket date from the browser clock", async () => {
    renderScreen();

    const field = await screen.findByLabelText("Ticket Date");

    expect(field).toHaveValue("Set when you submit");
    expect(field).not.toHaveValue(new Date().toLocaleDateString());
  });
});

describe("validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("reports every empty required field at once", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByText("Category is required.")).toBeInTheDocument();
  });

  // §8.3 — beside the control, not collected into one summary at the top.
  it("puts each message inside its own field group", async () => {
    const { container } = renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    const groups = [...container.querySelectorAll(".tkt-field-group")];
    const withSummaryError = groups.find((group) =>
      group.textContent?.includes("Summary is required.")
    );

    expect(withSummaryError?.querySelector("label")).toHaveTextContent(
      "Summary"
    );
  });

  it("rejects a summary below the minimum length", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.type(screen.getByLabelText(/^summary/i), "abc");
    await submit();

    expect(
      screen.getByText(/Summary must be between 5 and 150 characters/)
    ).toBeInTheDocument();
  });

  it("treats a whitespace-only summary as empty", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.type(screen.getByLabelText(/^summary/i), "        ");
    await submit();

    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
  });

  // ui-spec.md §8. Without it a keyboard user is told there are errors and left
  // wherever the cursor happened to be, with no way to reach the first one but
  // to tab from the top.
  it("moves focus to the first invalid control", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    await waitFor(() => {
      expect(screen.getByLabelText(/^category/i)).toHaveFocus();
    });
  });

  it("never calls the API when the form is invalid", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await submit();

    expect(fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("when the form cannot be completed", () => {
  // A control that looks live and silently does nothing is worse than one that
  // is visibly unavailable: the user clicks, nothing happens, and there is
  // nothing to read.
  it("disables submit when the reference data failed to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    renderScreen();

    await screen.findByText("Could not load the form");
    expect(
      screen.getByRole("button", { name: /create ticket/i })
    ).toBeDisabled();
  });

  // An empty list is a successful response with nothing to choose from. Left
  // as "loaded" it renders a blank dropdown and no explanation.
  it("explains an empty reference list rather than rendering blank selects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    expect(
      await screen.findByText("Nothing to file a ticket against")
    ).toBeInTheDocument();
  });

  /**
   * The control stays on the page and is disabled, rather than disappearing.
   *
   * Removing it changed the form's shape while the reference data settled — two
   * reflows on the way in, and Category landing on a different row from the one
   * Figure 1 puts it on. Disabled says the same thing without moving anything
   * the reader has already started reading.
   */
  it("keeps the classification controls in place, disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    await screen.findByText("Nothing to file a ticket against");
    expect(screen.getByLabelText(/^category/i)).toBeDisabled();
  });

  // "Loading…" on a list that failed to load is a promise the screen is not
  // keeping.
  it("says the control is unavailable rather than still loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    await screen.findByText("Nothing to file a ticket against");
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("disables submit when there is nothing to file against", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([]))
    );

    renderScreen();

    await screen.findByText("Nothing to file a ticket against");
    expect(
      screen.getByRole("button", { name: /create ticket/i })
    ).toBeDisabled();
  });
});

describe("submitting", () => {
  // BR-17 — the disabled busy button is the whole duplicate-submission control.
  it("disables the submit control while the request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(() => new Promise<Response>(() => undefined))
    );

    renderScreen();
    await fillValid();
    await submit();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });
  });

  // The mechanism is that there is nothing left to click: the control renames
  // itself and disables, so a second submit cannot be issued at all. Asserting
  // "clicked twice, sent once" would be asserting something weaker.
  it("leaves no enabled submit control to click a second time", async () => {
    const post = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", referenceFetch(post));

    renderScreen();
    await fillValid();
    await submit();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^create ticket$/i })
      ).toBeNull();
    });

    const busy = screen.getByRole("button", { name: /creating/i });
    await userEvent.click(busy);

    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("success", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(async () =>
        jsonResponse(
          {
            id: 42,
            ticketNumber: "TKT-2026-000042",
            summary: "Laptop battery drains quickly",
            currentStatus: "NEW",
            createdAt: "2026-08-29T09:14:22.481Z",
          },
          201
        )
      )
    );
  });

  it("shows the ticket number the backend issued", async () => {
    renderScreen();
    await fillValid();
    await submit();

    // Twice on purpose: once in the confirmation sentence and once in the
    // read-back list, so it is legible whichever the eye lands on first.
    expect(await screen.findAllByText(/TKT-2026-000042/)).toHaveLength(2);
  });

  it("gives the success screen its own heading", async () => {
    renderScreen();
    await fillValid();
    await submit();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ticket created" })
    ).toBeInTheDocument();
  });

  it("offers both next actions", async () => {
    renderScreen();
    await fillValid();
    await submit();

    expect(
      await screen.findByRole("button", { name: "View Ticket" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create another" })
    ).toBeInTheDocument();
  });

  it("clears the form when another ticket is started", async () => {
    renderScreen();
    await fillValid();
    await submit();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create another" })
    );

    expect(await screen.findByLabelText(/^summary/i)).toHaveValue("");
  });

  it("never invents a ticket number of its own", async () => {
    renderScreen();
    await fillValid();
    await submit();

    await screen.findAllByText(/TKT-2026-000042/);
    // Anything else on screen matching the pattern would mean the client is
    // guessing at a value only the server may assign (BR-01).
    const shown = document.body.textContent?.match(/TKT-\d{4}-\d{6}/gu) ?? [];
    expect(new Set(shown)).toEqual(new Set(["TKT-2026-000042"]));
  });
});

describe("a failed submission", () => {
  const failingPost = async () => {
    throw new TypeError("Failed to fetch");
  };

  // BR-19 and Part 6, item 5. Retyping a long description because a connection
  // dropped is the failure people actually remember.
  it("keeps every value the user typed", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/^summary/i)).toHaveValue(
      "Laptop battery drains quickly"
    );
    expect(screen.getByLabelText(/^description/i)).toHaveValue(
      "The battery drains much faster than usual even when idle."
    );
    expect(screen.getByLabelText(/^category/i)).toHaveValue("2");
  });

  it("says what happened without showing the exception", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/could not|unable/i);
    expect(alert).not.toHaveTextContent("TypeError");
  });

  it("re-enables the submit control so it can be tried again", async () => {
    vi.stubGlobal("fetch", referenceFetch(failingPost));

    renderScreen();
    await fillValid();
    await submit();

    await screen.findByRole("alert");

    expect(
      screen.getByRole("button", { name: /create ticket/i })
    ).toBeEnabled();
  });

  // The server is authoritative, so a field-level rejection it reports has to
  // reach the field even when the client thought the value was fine.
  it("shows field messages the server reported", async () => {
    vi.stubGlobal(
      "fetch",
      referenceFetch(async () =>
        jsonResponse(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "The ticket could not be created.",
              details: {
                summary: "Summary is already used by another ticket.",
              },
            },
          },
          400
        )
      )
    );

    renderScreen();
    await fillValid();
    await submit();

    expect(
      await screen.findByText("Summary is already used by another ticket.")
    ).toBeInTheDocument();
  });
});

/**
 * STYLE-11 — the ticket fields Figure 1 shows.
 *
 * §8.2 leaves the arrangement to us and offers Figure 1 as the example; §8.8
 * makes the illustrations binding. Current Status and IT Priority were the two
 * fields the figure has and this form did not, and both are known before
 * submission — BR-02 fixes the status at New, and §4.2 says nobody triages in
 * Lab 2. Leaving them out hid settled answers rather than withholding undecided
 * ones, which is the same argument as D-04.
 */
describe("the field set", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it.each(["Ticket No.", "Ticket Date", "Requester", "Current Status"])(
    "shows %s read-only, so it is not something to fill in",
    async (label) => {
      renderScreen();

      expect(await screen.findByLabelText(label)).toHaveAttribute("readonly");
    }
  );

  /**
   * Figure 1 carries these three; a create form cannot. All are set by work
   * §4.2 excludes from Lab 2, so here they would be permanently empty boxes on
   * a form whose job is to collect input. They belong to Ticket Detail (§8.5).
   */
  it.each(["IT Priority", "Ticket Owner", "Resolution Summary"])(
    "leaves %s to the detail screen",
    async (label) => {
      renderScreen();

      await screen.findByLabelText(/^summary/i);
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  );

  it("says a new ticket begins at New rather than leaving it blank", async () => {
    renderScreen();

    expect(await screen.findByLabelText("Current Status")).toHaveValue("New");
  });

  it("lays the ticket fields out four across, as the figure does", () => {
    const { container } = renderScreen();

    expect(container.querySelectorAll(".tkt-grid--4").length).toBeGreaterThan(
      0
    );
  });
});

/**
 * UI-06 / BR-09 — a draft written as one Requester is never submitted as
 * another.
 *
 * The rule already held through the routing: Change Requester navigates away
 * and the component unmounts, taking the draft with it. That is the routing
 * doing it rather than the rule being enforced, and it stops being true the
 * moment anything switches identity without leaving the page. These assert the
 * guard, not the navigation.
 */
describe("switching Requester mid-draft", () => {
  const renderWith = (context: RequesterContextValue) =>
    render(
      <MemoryRouter>
        <RequesterContext.Provider value={context}>
          <CreateTicket />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("discards what was typed", async () => {
    const { rerender } = renderWith(CONTEXT);

    await screen.findByLabelText(/^Summary/u);
    await userEvent.type(
      screen.getByLabelText(/^Summary/u),
      "Half-written under the first requester"
    );

    rerender(
      <MemoryRouter>
        <RequesterContext.Provider
          value={{
            ...CONTEXT,
            generation: CONTEXT.generation + 1,
            requester: {
              id: 2,
              name: "Somchai Wattana",
              email: "somchai.wattana@example.ac.th",
            },
          }}
        >
          <CreateTicket />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^Summary/u)).toHaveValue("");
    });
  });

  // Re-selecting the same person is still a new context, which is why the
  // guard watches `generation` rather than the requester's id.
  it("discards it even when the same person is chosen again", async () => {
    const { rerender } = renderWith(CONTEXT);

    await screen.findByLabelText(/^Summary/u);
    await userEvent.type(screen.getByLabelText(/^Summary/u), "Still a draft");

    rerender(
      <MemoryRouter>
        <RequesterContext.Provider
          value={{ ...CONTEXT, generation: CONTEXT.generation + 1 }}
        >
          <CreateTicket />
        </RequesterContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^Summary/u)).toHaveValue("");
    });
  });

  it("leaves an untouched form alone on first render", async () => {
    renderWith(CONTEXT);

    const summary = await screen.findByLabelText(/^Summary/u);

    await userEvent.type(summary, "Typed once, nothing switched");

    expect(summary).toHaveValue("Typed once, nothing switched");
  });
});

/**
 * UI-28 to UI-31 — the Create Ticket attachment picker (Issue #40, FR-17).
 *
 * `POST /api/tickets` stays JSON-only (`api-spec.md` §3): these tests assert
 * that a chosen file is held on screen rather than sent immediately, and is
 * only uploaded — through the same `POST /api/tickets/:id/attachments`
 * endpoint AttachmentSection uses — once the ticket itself exists. Whether the
 * server enforces the same type/size/count rules is UNIT-07 and API-14's job;
 * these assert what the screen does before and around that call.
 */
describe("the attachment picker", () => {
  const CREATED = {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    summary: "Laptop battery drains quickly",
    currentStatus: "NEW",
    createdAt: "2026-08-29T09:14:22.481Z",
  };

  const attachmentMeta = (id: number, filename: string) => ({
    id,
    originalFilename: filename,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    uploadedAt: "2026-08-29T09:14:22.481Z",
    uploadedBy: { id: 1, name: "Jennifer Anderson" },
    status: "ACTIVE",
    removedAt: null,
    removedReason: null,
    removedBy: null,
  });

  /**
   * Distinguishes the three POST destinations a submit can reach: ticket
   * creation, and one call per queued attachment. `onUpload` receives the
   * 1-based call number so a test can fail the second file without failing
   * the first.
   */
  const withSubmitFlow = (options: {
    onUpload?: (call: number) => Response;
  }) => {
    let uploadCall = 0;

    return vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/attachments")) {
        uploadCall += 1;

        if (options.onUpload) {
          return Promise.resolve(options.onUpload(uploadCall));
        }

        return Promise.resolve(
          jsonResponse(
            attachmentMeta(uploadCall, `file-${uploadCall}.pdf`),
            201
          )
        );
      }

      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(CREATED, 201));
      }

      if (url.includes("/api/categories")) {
        return Promise.resolve(jsonResponse(CATEGORIES));
      }

      return Promise.resolve(jsonResponse(SYSTEMS));
    });
  };

  const pdf = (name: string, bytes = 1024) =>
    new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

  beforeEach(() => {
    vi.stubGlobal("fetch", referenceFetch());
  });

  it("sits after Description and before the form actions", async () => {
    const { container } = renderScreen();

    await screen.findByRole("option", { name: "Hardware" });

    const card = container.querySelector("form.tkt-card");
    const children = [...(card?.children ?? [])];
    const gridIndex = children.findIndex((el) =>
      el.classList.contains("tkt-grid")
    );
    const attachmentsIndex = children.findIndex(
      (el) => el.querySelector("#tkt-create-attachment-file") !== null
    );
    const actionsIndex = children.findIndex(
      (el) =>
        el.classList.contains("tkt-actions") &&
        el.querySelector('button[type="submit"]') !== null
    );

    expect(gridIndex).toBeGreaterThanOrEqual(0);
    expect(attachmentsIndex).toBeGreaterThan(gridIndex);
    expect(actionsIndex).toBeGreaterThan(attachmentsIndex);
  });

  // UI-28: a chosen valid file is queued rather than sent.
  it("queues a valid file instead of uploading it immediately", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      pdf("evidence.pdf")
    );

    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 selected/u)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/attachments"),
      expect.anything()
    );
  });

  it("lets a queued file be removed before submitting", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      pdf("evidence.pdf")
    );
    await screen.findByText("evidence.pdf");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("evidence.pdf")).toBeNull();
  });

  // UI-29: a file that fails client-side validation is named, explained, and
  // never sent — the extension does not match the (permitted) declared type,
  // which is the one rejection reachable through the control: `accept`
  // filters the MIME type itself before the browser ever offers this one.
  it("rejects a file whose name does not match its type, and never sends it", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    const mismatched = new File(["not really a pdf"], "notes.txt", {
      type: "application/pdf",
    });

    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      mismatched
    );

    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText(/does not match its type/u)).toBeInTheDocument();
    // Never queued, so it plays no part in the 5-file count.
    expect(screen.getByText(/0 of 5 selected/u)).toBeInTheDocument();

    // And it stays unsent even when the form itself goes through: the
    // submit loop only sends `queued` rows, and this one never became one.
    const spy = vi.fn(withSubmitFlow({}));
    vi.stubGlobal("fetch", spy);
    await fillValid();
    await submit();

    await screen.findAllByText(/TKT-2026-000042/u);
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("/attachments"),
      expect.anything()
    );
  });

  it("can dismiss a rejected file, clearing it from the list", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Hardware" });

    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      new File(["x"], "notes.txt", { type: "application/pdf" })
    );
    await screen.findByText("notes.txt");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("notes.txt")).toBeNull();
  });

  // UI-30: the 5-file, 5 MB and type boundaries, mirrored from
  // `server/src/attachments/rules.ts` exactly rather than approximated.
  describe("the boundaries", () => {
    it("accepts a file at exactly the 5 MB limit", async () => {
      renderScreen();
      await screen.findByRole("option", { name: "Hardware" });

      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("exactly-five-mb.pdf", 5 * 1024 * 1024)
      );

      expect(
        await screen.findByText("exactly-five-mb.pdf")
      ).toBeInTheDocument();
      expect(screen.getByText(/1 of 5 selected/u)).toBeInTheDocument();
    });

    it("rejects a file one byte over the 5 MB limit", async () => {
      renderScreen();
      await screen.findByRole("option", { name: "Hardware" });

      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("just-over.pdf", 5 * 1024 * 1024 + 1)
      );

      expect(await screen.findByText("just-over.pdf")).toBeInTheDocument();
      expect(screen.getByText(/larger than 5 MB/u)).toBeInTheDocument();
    });

    it("disables the control once five files are queued", async () => {
      renderScreen();
      await screen.findByRole("option", { name: "Hardware" });

      // Sequential on purpose: each pick must land before the next is
      // chosen, or the count read between them is stale.
      for (const index of [0, 1, 2, 3, 4]) {
        await userEvent.upload(
          screen.getByLabelText(/Add Attachment/u),
          pdf(`file-${index}.pdf`)
        );
      }

      // Full, so the hint switches to the same "remove one first" wording
      // AttachmentSection uses rather than continuing to count up to it.
      expect(
        await screen.findByText(/Remove one before adding another\./u)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Add Attachment/u)).toBeDisabled();
    });

    it("limits the picker to the permitted types via accept", () => {
      renderScreen();

      expect(screen.getByLabelText(/Add Attachment/u)).toHaveAttribute(
        "accept",
        "image/jpeg,image/png,image/webp,application/pdf"
      );
    });
  });

  // UI-31 / D-17: the ticket is real even when an attachment failed to join
  // it, so the success screen says so and points at the ticket rather than
  // hiding the failure or pretending the whole submission failed.
  describe("a partial attachment failure (D-17)", () => {
    it("still shows the ticket as created", async () => {
      vi.stubGlobal(
        "fetch",
        withSubmitFlow({
          onUpload: () =>
            jsonResponse(
              {
                error: {
                  code: "FILE_TOO_LARGE",
                  message:
                    "That file is larger than 5 MB. Attach a smaller file.",
                },
              },
              413
            ),
        })
      );

      renderScreen();
      await fillValid();
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("evidence.pdf")
      );
      await submit();

      expect(await screen.findAllByText(/TKT-2026-000042/u)).not.toHaveLength(
        0
      );
    });

    it("names the file that failed to attach and why", async () => {
      vi.stubGlobal(
        "fetch",
        withSubmitFlow({
          onUpload: () =>
            jsonResponse(
              {
                error: {
                  code: "FILE_TOO_LARGE",
                  message:
                    "That file is larger than 5 MB. Attach a smaller file.",
                },
              },
              413
            ),
        })
      );

      renderScreen();
      await fillValid();
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("evidence.pdf")
      );
      await submit();

      const alert = await screen.findByRole("alert");

      expect(alert).toHaveTextContent("evidence.pdf");
      expect(alert).toHaveTextContent(/larger than 5 MB/u);
    });

    it("still offers View Ticket, so the failure can be retried there", async () => {
      vi.stubGlobal(
        "fetch",
        withSubmitFlow({
          onUpload: () =>
            jsonResponse(
              { error: { code: "FILE_TOO_LARGE", message: "Too large." } },
              413
            ),
        })
      );

      renderScreen();
      await fillValid();
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("evidence.pdf")
      );
      await submit();

      expect(
        await screen.findByRole("button", { name: "View Ticket" })
      ).toBeEnabled();
    });

    it("reports each file that failed when more than one did", async () => {
      vi.stubGlobal(
        "fetch",
        withSubmitFlow({
          onUpload: (call) =>
            call === 1
              ? jsonResponse(attachmentMeta(1, "first.pdf"), 201)
              : jsonResponse(
                  { error: { code: "FILE_TOO_LARGE", message: "Too large." } },
                  413
                ),
        })
      );

      renderScreen();
      await fillValid();
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("first.pdf")
      );
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("second.pdf")
      );
      await submit();

      const alert = await screen.findByRole("alert");

      expect(alert).toHaveTextContent("second.pdf");
      expect(alert).not.toHaveTextContent("first.pdf");
    });

    it("says nothing failed when every attachment uploads cleanly", async () => {
      vi.stubGlobal("fetch", withSubmitFlow({}));

      renderScreen();
      await fillValid();
      await userEvent.upload(
        screen.getByLabelText(/Add Attachment/u),
        pdf("evidence.pdf")
      );
      await submit();

      await screen.findAllByText(/TKT-2026-000042/u);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
