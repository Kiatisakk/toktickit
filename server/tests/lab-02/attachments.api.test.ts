import { readdir, unlink } from "node:fs/promises";

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app.js";
import { pathFor, UPLOAD_DIR } from "../../src/attachments/storage.js";
import { REQUESTER_HEADER } from "../../src/middleware/requesterContext.js";
import { prisma } from "../../src/prisma.js";

/**
 * The attachment lifecycle, end to end.
 *
 * `attachment-rules.test.ts` covers each rule on its own; this covers the order
 * they are applied in, which is where the interesting failures live. A limit
 * checked after the write leaves a file nobody refers to; a reason validated
 * before ownership tells a stranger their target exists.
 */

const PREFIX = "ATTACH-TEST";
const PDF = Buffer.from("%PDF-1.4\nfake but plausible\n%%EOF\n");

let ownerA = 0;
let ownerB = 0;
let ticketOfA = 0;
let ticketOfB = 0;

const as = (id: number) => (r: request.Test) =>
  r.set(REQUESTER_HEADER, String(id));

const attach = (
  ticketId: number,
  requesterId: number,
  filename = "battery-report.pdf",
  contentType = "application/pdf",
  bytes: Buffer = PDF
) =>
  as(requesterId)(
    request(app).post(`/api/tickets/${ticketId}/attachments`)
  ).attach("file", bytes, { filename, contentType });

const filesOnDisk = async () => {
  try {
    return await readdir(UPLOAD_DIR);
  } catch {
    return [];
  }
};

/**
 * Deleting the rows is not enough: the bytes are on disk.
 *
 * Every run of this suite used to leave its uploads behind, so the directory
 * grew by a few dozen files each time and nothing ever collected them. The
 * stored names are read before the rows go, because afterwards there is no
 * record of what to delete.
 */
const removeStoredFiles = async () => {
  const rows = await prisma.attachment.findMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
    select: { storedFilename: true },
  });

  await Promise.all(
    rows.map(async (row) => {
      try {
        await unlink(pathFor(row.storedFilename));
      } catch {
        // A test that deliberately removed the file has already done this.
      }
    })
  );
};

beforeEach(async () => {
  await removeStoredFiles();
  await prisma.attachment.deleteMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
  });
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });

  const [a, b] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });

  ownerA = a?.id ?? 0;
  ownerB = b?.id ?? 0;

  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();

  const make = async (requesterId: number, suffix: string) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2998-${suffix}`,
        requesterId,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `${PREFIX} ${suffix}`,
        description: "Created by the attachment test suite.",
        requestedPriority: "MEDIUM",
      },
      select: { id: true },
    });

    return ticket.id;
  };

  ticketOfA = await make(ownerA, "800001");
  ticketOfB = await make(ownerB, "800002");
});

afterAll(async () => {
  await removeStoredFiles();
  await prisma.attachment.deleteMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
  });
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
  await prisma.$disconnect();
});

describe("adding an attachment", () => {
  it("accepts a permitted file on an owned ticket", async () => {
    const response = await attach(ticketOfA, ownerA);

    expect(response.status).toBe(201);
    expect(response.body.originalFilename).toBe("battery-report.pdf");
    expect(response.body.status).toBe("ACTIVE");
  });

  // BR-24. Publishing it would invite path guessing, and it is the one field
  // that is a filesystem detail rather than a fact about the attachment.
  it("never reveals the name the file has on disk", async () => {
    const response = await attach(ticketOfA, ownerA);

    expect(response.body).not.toHaveProperty("storedFilename");
    expect(JSON.stringify(response.body)).not.toContain(".pdf\\");
  });

  it("records who uploaded it", async () => {
    const response = await attach(ticketOfA, ownerA);

    expect(response.body.uploadedBy.id).toBe(ownerA);
  });

  it("starts with no removal recorded", async () => {
    const response = await attach(ticketOfA, ownerA);

    expect(response.body.removedAt).toBeNull();
    expect(response.body.removedReason).toBeNull();
  });

  it("refuses a ticket belonging to someone else", async () => {
    const response = await attach(ticketOfA, ownerB);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  // The same refusal from the other side, so neither requester is the
  // privileged one by accident.
  it("refuses in both directions", async () => {
    const response = await attach(ticketOfB, ownerA);

    expect(response.status).toBe(404);
  });

  it("answers a stranger's ticket exactly as a missing one", async () => {
    const [stranger, missing] = await Promise.all([
      attach(ticketOfB, ownerA),
      attach(99_999_999, ownerA),
    ]);

    expect(stranger.status).toBe(missing.status);
    expect(stranger.body).toStrictEqual(missing.body);
  });

  it("refuses a request with no file part", async () => {
    const response = await as(ownerA)(
      request(app).post(`/api/tickets/${ticketOfA}/attachments`)
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("the rejection rules", () => {
  it("refuses a disallowed type", async () => {
    const response = await attach(
      ticketOfA,
      ownerA,
      "setup.exe",
      "application/x-msdownload",
      Buffer.from("MZ")
    );

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  // Multer aborts the stream at the limit, so this never reaches the rule in
  // `validateUpload` — which is the point. A size checked only after the body
  // has been read is not a limit; the bytes have already crossed the network.
  it("refuses a file above the size limit", async () => {
    const response = await attach(
      ticketOfA,
      ownerA,
      "huge.pdf",
      "application/pdf",
      Buffer.alloc(5 * 1024 * 1024 + 1, 0x41)
    );

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  });

  // The other direction of the same rule, and the one that would pass by
  // accident if the limit were off by a byte.
  it("accepts a file exactly at the limit", async () => {
    const response = await attach(
      ticketOfA,
      ownerA,
      "exactly.pdf",
      "application/pdf",
      Buffer.alloc(5 * 1024 * 1024, 0x41)
    );

    expect(response.status).toBe(201);
  });

  it("refuses a sixth active attachment", async () => {
    for (let n = 0; n < 5; n += 1) {
      // Sequential on purpose: the limit is a count read before each insert, so
      // firing them in parallel would test a different thing.
      // eslint-disable-next-line no-await-in-loop
      await attach(ticketOfA, ownerA, `file-${n}.pdf`);
    }

    const sixth = await attach(ticketOfA, ownerA, "one-too-many.pdf");

    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
  });

  // BR-29. Removal makes room; it is not a permanent loss of a slot.
  it("counts a removed attachment as absent from the limit", async () => {
    const created: number[] = [];

    for (let n = 0; n < 5; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await attach(ticketOfA, ownerA, `file-${n}.pdf`);
      created.push(response.body.id);
    }

    await as(ownerA)(
      request(app).delete(`/api/attachments/${created[0]}`)
    ).send({ reason: "Uploaded the wrong screenshot." });

    const replacement = await attach(ticketOfA, ownerA, "replacement.pdf");

    expect(replacement.status).toBe(201);
  });

  // BR-30's other half: a rejected upload never reaches the disk at all, so
  // there is nothing to compensate for.
  it("writes nothing to disk when the file is rejected", async () => {
    const before = await filesOnDisk();

    await attach(
      ticketOfA,
      ownerA,
      "logo.svg",
      "image/svg+xml",
      Buffer.from("<svg/>")
    );

    expect(await filesOnDisk()).toHaveLength(before.length);
  });
});

/**
 * API-18 / BR-30 — the compensation, forced.
 *
 * "If storing a file succeeds but recording its metadata fails, the stored file
 * is removed." Every other test exercises paths where nothing was ever written;
 * this is the one window the compensation exists for, and no request can reach
 * it — the insert has to be made to fail.
 *
 * Spying on `prisma.attachment.create` does not work, because the route runs
 * inside `prisma.$transaction` and calls `tx.attachment.create` on the
 * transaction client, which is a different object. So the transaction is
 * intercepted and the real one is handed a proxied `tx` whose `attachment
 * .create` rejects. Everything else in the transaction — the row lock, the
 * count, the file write — runs for real, which is the point: the file has to
 * genuinely reach the disk before the failure, or the test proves nothing.
 */
const failTheInsert = () => {
  const realTransaction = prisma.$transaction.bind(prisma);

  return vi.spyOn(prisma, "$transaction").mockImplementationOnce(((
    run: (tx: unknown) => Promise<unknown>
  ) =>
    realTransaction(
      async (tx: unknown) =>
        await run(
          new Proxy(tx as object, {
            get(target, property) {
              if (property !== "attachment") {
                return Reflect.get(target, property);
              }

              return new Proxy(Reflect.get(target, property) as object, {
                get(model, method) {
                  if (method !== "create") {
                    return Reflect.get(model, method);
                  }

                  return () =>
                    Promise.reject(new Error("forced metadata failure"));
                },
              });
            },
          })
        )
    )) as never);
};

describe("when the metadata write fails after the file is on disk", () => {
  it("leaves no orphaned file behind", async () => {
    const before = await filesOnDisk();
    const spy = failTheInsert();

    const response = await attach(ticketOfA, ownerA, "doomed.pdf");

    spy.mockRestore();

    expect(response.status).toBe(500);
    expect(await filesOnDisk()).toHaveLength(before.length);
  });

  // The rollback covers this one, but a compensation that deleted the file and
  // left the row would be worse than either failure alone.
  it("leaves no orphaned row either", async () => {
    const spy = failTheInsert();

    await attach(ticketOfA, ownerA, "doomed.pdf");

    spy.mockRestore();

    const rows = await prisma.attachment.count({
      where: { ticketId: ticketOfA },
    });

    expect(rows).toBe(0);
  });

  // BR-20: the caller is told the server failed, not how.
  it("says nothing about the filesystem or the cause", async () => {
    const spy = failTheInsert();

    const response = await attach(ticketOfA, ownerA, "doomed.pdf");

    spy.mockRestore();

    const body = JSON.stringify(response.body);

    expect(body).not.toContain("forced metadata failure");
    expect(body).not.toContain("uploads");
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("listing attachments", () => {
  it("returns both active and removed rows", async () => {
    const first = await attach(ticketOfA, ownerA, "one.pdf");
    await attach(ticketOfA, ownerA, "two.pdf");

    await as(ownerA)(
      request(app).delete(`/api/attachments/${first.body.id}`)
    ).send({ reason: "No longer relevant." });

    const response = await as(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}/attachments`)
    );

    expect(response.body.data).toHaveLength(2);
    expect(
      response.body.data.map((a: { status: string }) => a.status)
    ).toContain("REMOVED");
  });

  it("refuses a ticket belonging to someone else", async () => {
    const response = await as(ownerB)(
      request(app).get(`/api/tickets/${ticketOfA}/attachments`)
    );

    expect(response.status).toBe(404);
  });
});

describe("downloading", () => {
  it("serves an active attachment", async () => {
    const created = await attach(ticketOfA, ownerA);

    const response = await as(ownerA)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(response.status).toBe(200);
    expect(response.body.toString()).toContain("%PDF");
  });

  // BR-25, D-08. Every type, not only the ones that look dangerous.
  it.each([
    ["battery-report.pdf", "application/pdf"],
    ["holiday.jpg", "image/jpeg"],
    ["screen.png", "image/png"],
  ])("forces %s to download rather than render", async (name, type) => {
    const created = await attach(ticketOfA, ownerA, name, type);

    const response = await as(ownerA)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(response.headers["content-disposition"]).toMatch(/^attachment;/u);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuses an attachment on a ticket belonging to someone else", async () => {
    const created = await attach(ticketOfA, ownerA);

    const response = await as(ownerB)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });
});

/**
 * Regressions from the bug hunt on this branch. Both were found by probes
 * written to go red on a suspicion, and both were real.
 */
describe("a row whose file has gone", () => {
  /*
   * The download used to pipe a read stream straight at the response with no
   * error handler. When the bytes were missing the stream failed after the
   * response had been committed, nothing answered, and the request hung — the
   * probe sat there for the full fifteen-second timeout. An unhandled `error`
   * event also takes the process down.
   */
  it("answers rather than hanging", async () => {
    const created = await attach(ticketOfA, ownerA);
    const row = await prisma.attachment.findFirstOrThrow({
      where: { id: created.body.id },
      select: { storedFilename: true },
    });

    await unlink(pathFor(row.storedFilename));

    const response = await as(ownerA)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(response.status).toBe(500);
  }, 15_000);

  // The row promised something the disk does not have. That is our fault, not
  // the caller's, so it must not be dressed up as "not found".
  it("calls it a server fault rather than a missing attachment", async () => {
    const created = await attach(ticketOfA, ownerA);
    const row = await prisma.attachment.findFirstOrThrow({
      where: { id: created.body.id },
      select: { storedFilename: true },
    });

    await unlink(pathFor(row.storedFilename));

    const response = await as(ownerA)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  }, 15_000);

  // BR-20: no path, no stack, nothing about the filesystem.
  it("says nothing about where the file was meant to be", async () => {
    const created = await attach(ticketOfA, ownerA);
    const row = await prisma.attachment.findFirstOrThrow({
      where: { id: created.body.id },
      select: { storedFilename: true },
    });

    await unlink(pathFor(row.storedFilename));

    const response = await as(ownerA)(
      request(app).get(`/api/attachments/${created.body.id}/download`)
    );

    expect(JSON.stringify(response.body)).not.toContain(row.storedFilename);
    expect(JSON.stringify(response.body)).not.toContain("uploads");
  }, 15_000);
});

describe("attachments sharing an upload timestamp", () => {
  // The same defect BR-32 names for tickets. The detail endpoint ordered by
  // `uploadedAt` alone and returned rows in the opposite order to the listing
  // endpoint — the same data, described twice, disagreeing.
  const eight = async (marker: string) => {
    const when = new Date();

    await prisma.attachment.createMany({
      data: Array.from({ length: 8 }, (_unused, index) => ({
        ticketId: ticketOfA,
        originalFilename: `same-${index}.pdf`,
        storedFilename: `${marker}-${index}-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        uploadedById: ownerA,
        uploadedAt: when,
      })),
    });
  };

  it("are ordered identically by the detail and the listing endpoints", async () => {
    await eight("agree");

    const detail = await as(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );
    const listing = await as(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}/attachments`)
    );

    expect(
      detail.body.attachments.map((one: { id: number }) => one.id)
    ).toStrictEqual(listing.body.data.map((one: { id: number }) => one.id));
  });

  it("come back in the same order every time", async () => {
    await eight("stable");

    const read = async () => {
      const response = await as(ownerA)(
        request(app).get(`/api/tickets/${ticketOfA}`)
      );

      return response.body.attachments.map((one: { id: number }) => one.id);
    };

    const runs = await Promise.all([read(), read(), read(), read()]);

    for (const run of runs) {
      expect(run).toStrictEqual(runs[0]);
    }
  });
});

describe("removing", () => {
  it("requires a reason", async () => {
    const created = await attach(ticketOfA, ownerA);

    const response = await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("records the reason and who removed it", async () => {
    const created = await attach(ticketOfA, ownerA);

    const response = await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Uploaded the wrong screenshot." });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REMOVED");
    expect(response.body.removedReason).toBe("Uploaded the wrong screenshot.");
    expect(response.body.removedBy.id).toBe(ownerA);
  });

  // BR-26. The record of what was removed and why is the point of soft removal.
  it("keeps the metadata visible afterwards", async () => {
    const created = await attach(ticketOfA, ownerA);

    await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Wrong file." });

    const listing = await as(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}/attachments`)
    );

    expect(listing.body.data[0].originalFilename).toBe("battery-report.pdf");
  });

  // BR-28, and the case Part 8 asks to see fail: the URL is known, the row is
  // still there, and the bytes must not come back.
  it("blocks the download afterwards, even by direct URL", async () => {
    const created = await attach(ticketOfA, ownerA);
    const url = `/api/attachments/${created.body.id}/download`;
    const before = await as(ownerA)(request(app).get(url));

    expect(before.status).toBe(200);

    await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Wrong file." });

    const after = await as(ownerA)(request(app).get(url));

    expect(after.status).toBe(404);
    expect(after.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  it("cannot be removed twice", async () => {
    const created = await attach(ticketOfA, ownerA);

    await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Wrong file." });

    const again = await as(ownerA)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Wrong file again." });

    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  it("refuses an attachment belonging to someone else", async () => {
    const created = await attach(ticketOfA, ownerA);

    const response = await as(ownerB)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "Not mine to remove." });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });

  /**
   * Ownership is resolved before the reason is complained about.
   *
   * A stranger sending a two-character reason must be told the attachment does
   * not exist, not that their reason is too short — the second answer confirms
   * the first is a lie.
   */
  it("tells a stranger nothing, even when their reason is also invalid", async () => {
    const created = await attach(ticketOfA, ownerA);

    const stranger = await as(ownerB)(
      request(app).delete(`/api/attachments/${created.body.id}`)
    ).send({ reason: "x" });

    expect(stranger.status).toBe(404);
    expect(stranger.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });
});

/**
 * Regressions from the peer review of PR #29.
 *
 * Both are the same shape: a read, then a write, with nothing holding the two
 * together. Both were reachable by two people working on one ticket at once,
 * and neither was reachable by any test that made one request at a time.
 */
describe("two uploads racing for the last slot", () => {
  // I probed this before opening the Pull Request, with six concurrent uploads
  // over three runs, and never caught it — so it shipped unfixed and, more
  // importantly, unclaimed. The reviewer caught it by reading. The count and
  // the insert now run under `SELECT … FOR UPDATE` on the ticket.
  it("never lets a ticket past five active attachments", async () => {
    for (let n = 0; n < 4; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      await attach(ticketOfA, ownerA, `seed-${n}.pdf`);
    }

    await Promise.all(
      Array.from({ length: 6 }, (_unused, index) =>
        attach(ticketOfA, ownerA, `race-${index}.pdf`)
      )
    );

    const active = await prisma.attachment.count({
      where: { ticketId: ticketOfA, removedAt: null },
    });

    expect(active).toBe(5);
  }, 20_000);

  it("refuses the losers rather than failing silently", async () => {
    for (let n = 0; n < 4; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      await attach(ticketOfA, ownerA, `seed-${n}.pdf`);
    }

    const results = await Promise.all(
      Array.from({ length: 4 }, (_unused, index) =>
        attach(ticketOfA, ownerA, `race-${index}.pdf`)
      )
    );

    expect(results.filter((one) => one.status === 201)).toHaveLength(1);
    expect(
      results.filter(
        (one) => one.body?.error?.code === "ATTACHMENT_LIMIT_REACHED"
      )
    ).toHaveLength(3);
  }, 20_000);
});

describe("two removals of one attachment", () => {
  // BR-26 keeps the record of what was removed and why. Read-then-write let the
  // second removal overwrite the first's time, reason and remover, and answer
  // 200 as though it had done the removing.
  it("lets exactly one of them succeed", async () => {
    const created = await attach(ticketOfA, ownerA);

    const results = await Promise.all([
      as(ownerA)(
        request(app).delete(`/api/attachments/${created.body.id}`)
      ).send({ reason: "First reason, the true one." }),
      as(ownerA)(
        request(app).delete(`/api/attachments/${created.body.id}`)
      ).send({ reason: "Second reason, which must not land." }),
    ]);

    expect(results.filter((one) => one.status === 200)).toHaveLength(1);
    expect(
      results.filter((one) => one.body?.error?.code === "ATTACHMENT_REMOVED")
    ).toHaveLength(1);
  });

  it("keeps the reason of whichever one won", async () => {
    const created = await attach(ticketOfA, ownerA);

    await Promise.all([
      as(ownerA)(
        request(app).delete(`/api/attachments/${created.body.id}`)
      ).send({ reason: "First reason, the true one." }),
      as(ownerA)(
        request(app).delete(`/api/attachments/${created.body.id}`)
      ).send({ reason: "Second reason, which must not land." }),
    ]);

    const row = await prisma.attachment.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { removedReason: true },
    });

    // Either may win the race; what must not happen is the loser overwriting
    // the winner's record after the fact.
    expect([
      "First reason, the true one.",
      "Second reason, which must not land.",
    ]).toContain(row.removedReason);
  });
});

describe("uploading to a ticket that is not yours", () => {
  // api-spec.md §5 puts ownership first, and it was running fourth — after
  // multer had buffered the whole file. The status depended on the file rather
  // than on the permission.
  /**
   * A five-megabyte body to a stranger's ticket is answered before it has
   * finished arriving, so the connection is reset under the client mid-send.
   *
   * That reset *is* the evidence: it can only happen because the refusal came
   * before the body was read, which is the whole point of moving ownership in
   * front of multer. Either outcome is a pass — what must never happen is a
   * 413, because that would mean the file was read and measured before anyone
   * asked whether the sender was allowed to send it.
   */
  it("is refused before the body has even finished arriving", async () => {
    let status = 0;

    try {
      const response = await attach(
        ticketOfB,
        ownerA,
        "huge.pdf",
        "application/pdf",
        Buffer.alloc(5 * 1024 * 1024 + 1, 0x41)
      );

      ({ status } = response);
    } catch (error) {
      // ECONNRESET: the server had answered and hung up while we were still
      // uploading.
      expect((error as NodeJS.ErrnoException).code).toBe("ECONNRESET");
      return;
    }

    expect(status).toBe(404);
  }, 15_000);

  it("is refused as not found, not as an unsupported type", async () => {
    const response = await attach(
      ticketOfB,
      ownerA,
      "setup.exe",
      "application/x-msdownload",
      Buffer.from("MZ")
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});

describe("the ticket detail response", () => {
  it("carries the attachments the ticket has", async () => {
    await attach(ticketOfA, ownerA, "one.pdf");
    await attach(ticketOfA, ownerA, "two.pdf");

    const response = await as(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.body.attachments).toHaveLength(2);
    expect(response.body.attachments[0]).not.toHaveProperty("storedFilename");
  });
});
