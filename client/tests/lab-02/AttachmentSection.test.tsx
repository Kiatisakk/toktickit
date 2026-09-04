import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ATTACHMENT,
  TICKET,
  jsonResponse,
  renderAt,
  respond,
} from "./ticketDetailHarness";

/**
 * The attachment section of the Requester Ticket Detail screen (§12 names this
 * file).
 *
 * A removed attachment keeps its metadata and its reason while losing its
 * Download — that is the visible half of soft removal, and the half a Requester
 * can check. The rest of these are the row states the API has no way to
 * describe, because a file being sent and a file the server refused both lack
 * the one thing an attachment record has: an id.
 *
 * The screen that hosts this section is covered in
 * `RequesterTicketDetail.test.tsx`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
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

    // §6 lists filename, *type*, size, upload time. The type was the one
    // missing, raised in review of PR #29.
    expect(meta?.textContent).toContain("PDF");
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

/**
 * The three row states `ui-spec.md` §6 defines that this component shipped
 * without, plus the field the active row was missing.
 *
 * All four came from the peer review of PR #29, and all four are our own
 * specification going unimplemented — the same pattern as PR #27. Worth noting
 * why these three were the ones skipped: none of them is represented in the API
 * response, so nothing in the data model reminds you they exist.
 */
describe("the row states the API cannot describe", () => {
  const held = () => {
    let release: ((value: Response) => void) | undefined;

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }

      return Promise.resolve(jsonResponse(TICKET));
    });

    vi.stubGlobal("fetch", fetchMock);

    return () => release;
  };

  const choose = async () =>
    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      new File(["%PDF"], "battery-report.pdf", { type: "application/pdf" })
    );

  it("shows an uploading row carrying the file's own name", async () => {
    held();

    renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await choose();

    expect(await screen.findByText("battery-report.pdf")).toBeInTheDocument();
  });

  it("marks that row uploading rather than active", async () => {
    held();

    const { container } = renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await choose();

    await waitFor(() => {
      expect(
        container.querySelector(".tkt-attachment--uploading")
      ).not.toBeNull();
    });
  });

  // §6: Remove is hidden while a row is uploading. There is nothing on the
  // server yet to remove.
  it("offers no Remove on a row that does not exist yet", async () => {
    held();

    renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await choose();

    await screen.findByText("battery-report.pdf");
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("shows progress rather than a silent pause", async () => {
    held();

    renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await choose();

    expect(
      await screen.findByRole("progressbar", {
        name: /Uploading battery-report\.pdf/u,
      })
    ).toBeInTheDocument();
  });

  // Queried by id rather than by label: while an upload is in flight the label
  // reads "Uploading…" and so does the progress bar's own name, so a text match
  // finds two elements.
  it("disables the add control while one is in flight", async () => {
    held();

    const { container } = renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await choose();

    await waitFor(() => {
      expect(container.querySelector("#tkt-attachment-file")).toBeDisabled();
    });
  });
});

describe("a file the server refused", () => {
  const refuse = () => {
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
  };

  const upload = async () => {
    renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      new File(["%PDF"], "huge.pdf", { type: "application/pdf" })
    );
  };

  // A generic alert above the list does not say *which* file was refused, which
  // is the only question a person has after choosing one.
  it("names the file that was refused", async () => {
    refuse();

    await upload();

    expect(await screen.findByText("huge.pdf")).toBeInTheDocument();
  });

  it("puts the reason on the row rather than above the list", async () => {
    refuse();

    const { container } = renderAt();

    await screen.findByText("No files have been attached to this ticket.");
    await userEvent.upload(
      screen.getByLabelText(/Add Attachment/u),
      new File(["%PDF"], "huge.pdf", { type: "application/pdf" })
    );

    const row = await waitFor(() => {
      const found = container.querySelector(".tkt-attachment--invalid");

      expect(found).not.toBeNull();

      return found as HTMLElement;
    });

    expect(within(row).getByText(/larger than 5 MB/u)).toBeInTheDocument();
  });

  it("can be dismissed, so the list is not stuck with it", async () => {
    refuse();

    await upload();

    await screen.findByText("huge.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("huge.pdf")).toBeNull();
  });
});

describe("a download that fails", () => {
  const failDownload = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/download")) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }

        return Promise.resolve(
          jsonResponse({ ...TICKET, attachments: [ATTACHMENT] })
        );
      })
    );

  it("marks the row unavailable rather than failing silently", async () => {
    failDownload();

    const { container } = renderAt();

    await screen.findByText("battery-report.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(container.querySelector(".tkt-attachment--error")).not.toBeNull();
    });
  });

  it("offers a retry on the row itself", async () => {
    failDownload();

    renderAt();

    await screen.findByText("battery-report.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(
      await screen.findByRole("button", { name: "Retry download" })
    ).toBeInTheDocument();
  });

  // The metadata is still true — it is the download that failed — so the row
  // keeps it.
  it("keeps the attachment's metadata visible", async () => {
    failDownload();

    renderAt();

    await screen.findByText("battery-report.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    await screen.findByRole("button", { name: "Retry download" });
    expect(screen.getByText("battery-report.pdf")).toBeInTheDocument();
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

describe("a file the server refuses after it is sent", () => {
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
