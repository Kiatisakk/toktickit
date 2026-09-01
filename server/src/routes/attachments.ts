import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { Router } from "express";
import type { RequestHandler } from "express";
import multer from "multer";

import {
  ACTIVE_LIMIT,
  contentDispositionFor,
  MAX_BYTES,
  storedNameFor,
  validateRemovalReason,
  validateUpload,
} from "../attachments/rules.js";
import {
  ATTACHMENT_SHAPE,
  toAttachmentResponse,
} from "../attachments/shape.js";
import {
  deleteAttachment,
  pathFor,
  writeAttachment,
} from "../attachments/storage.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import {
  requesterOf,
  requireRequesterContext,
} from "../middleware/requesterContext.js";
import { prisma } from "../prisma.js";

export const attachmentsRouter = Router();

/**
 * In memory, not straight to disk.
 *
 * The order in api-spec.md §5 is deliberate: validate the type, the extension
 * and the size *before* anything is written, so a rejected upload never creates
 * a file that has to be cleaned up. Multer's disk storage would write first and
 * leave us undoing it.
 *
 * The byte limit is set here as well as checked in `validateUpload`, because a
 * limit enforced only after the body has been read is not a limit — a hundred
 * megabytes would still have crossed the network and be sitting in memory.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

/**
 * How each upload rejection reaches the caller.
 *
 * A table rather than a chain of conditionals: the three cases are a fixed set
 * from §4.5, and reading "which status does an oversized file get?" off a table
 * is the point of having one.
 */
/**
 * Thrown inside the upload transaction when the ticket is already full.
 *
 * Throwing is what rolls the transaction back; the handler translates it into
 * the documented 409 rather than letting it surface as a 500.
 */
class AttachmentLimitError extends Error {
  constructor() {
    super("Attachment limit reached");
    this.name = "AttachmentLimitError";
  }
}

const UPLOAD_FAILURES = {
  FILE_TOO_LARGE: { status: 413, code: ErrorCode.fileTooLarge },
  UNSUPPORTED_FILE_TYPE: { status: 415, code: ErrorCode.unsupportedFileType },
  VALIDATION_FAILED: { status: 400, code: ErrorCode.validationFailed },
} as const;

/**
 * Runs the upload and turns multer's own failures into the documented envelope.
 *
 * Without this the byte limit throws a `MulterError` that reaches the generic
 * handler as a 500 — the request is refused, which is right, but the caller is
 * told the server broke rather than that their file is too big. A limit that
 * cannot be reported is not a rule, it is a crash.
 */
const acceptFile: RequestHandler = (req, res, next) => {
  // Multer's API is a callback taking (req, res, next). Wrapping it in a
  // promise would move the callback rather than remove it, and would lose
  // the `next` this middleware exists to call.
  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  upload.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        sendError(
          res,
          413,
          ErrorCode.fileTooLarge,
          "That file is larger than 5 MB. Attach a smaller file."
        );
        return;
      }

      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "The upload could not be read. Attach a single file and try again.",
        { file: "Attach one file." }
      );
      return;
    }

    next(error);
  });
};

const notFound = (
  res: Parameters<typeof sendError>[0],
  what: "ticket" | "attachment"
) =>
  what === "ticket"
    ? sendError(
        res,
        404,
        ErrorCode.ticketNotFound,
        "That ticket could not be found."
      )
    : sendError(
        res,
        404,
        ErrorCode.attachmentNotFound,
        "That attachment could not be found."
      );

/**
 * The one ownership question, asked in one place.
 *
 * Every attachment route resolves `attachment → ticket → requester`, and the
 * flat `/api/attachments/:id` path does not weaken that, because the check never
 * depended on the URL shape. Returning null for "absent" and for "someone
 * else's" together is what makes the two answer identically at the edge — the
 * caller cannot accidentally distinguish them because it is never told.
 */
const ownedTicket = async (ticketId: number, requesterId: number) =>
  await prisma.ticket.findFirst({
    where: { id: ticketId, requesterId },
    select: { id: true },
  });

const ownedAttachment = async (attachmentId: number, requesterId: number) =>
  await prisma.attachment.findFirst({
    where: { id: attachmentId, ticket: { requesterId } },
    select: {
      ...ATTACHMENT_SHAPE,
      storedFilename: true,
      ticketId: true,
    },
  });

/**
 * Resolves the ticket's ownership before the body is read.
 *
 * api-spec.md §5 puts ownership first and it was running fourth, after multer
 * had already buffered the whole file. A stranger's upload was answered by the
 * size limit or by the multipart parser rather than by the ownership rule, so
 * the status depended on the file rather than on the permission — and we read
 * five megabytes from somebody with no business sending them.
 */
const resolveOwnedTicket = async (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2]
): Promise<void> => {
  const requester = requesterOf(res);
  const ticketId = identifier(req.params["id"]);

  if (ticketId === null) {
    notFound(res, "ticket");
    return;
  }

  try {
    const ticket = await ownedTicket(ticketId, requester.id);

    if (!ticket) {
      notFound(res, "ticket");
      return;
    }

    // Returned rather than merely called, so the transfer of control is
    // visible at the call site.
    return next();
  } catch (error) {
    sendInternalError(res, "Failed to resolve ticket ownership", error);
  }
};

/**
 * A synchronous wrapper, which is what the async-handler rule asks for: the
 * work is async, the middleware Express sees is not, and every rejection is
 * already handled inside rather than escaping as an unhandled promise.
 */
const requireOwnedTicket: RequestHandler = (req, res, next) => {
  void resolveOwnedTicket(req, res, next);
};

/** Metadata for one owned ticket, active and removed, newest first. */
attachmentsRouter.get(
  "/tickets/:id/attachments",
  requireRequesterContext,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const requester = requesterOf(res);
    const ticketId = identifier(req.params.id);

    if (ticketId === null) {
      notFound(res, "ticket");
      return;
    }

    try {
      const ticket = await ownedTicket(ticketId, requester.id);

      if (!ticket) {
        notFound(res, "ticket");
        return;
      }

      const attachments = await prisma.attachment.findMany({
        where: { ticketId },
        select: ATTACHMENT_SHAPE,
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      });

      res.status(200).json({ data: attachments.map(toAttachmentResponse) });
    } catch (error) {
      sendInternalError(res, "Failed to list attachments", error);
    }
  }
);

/**
 * Adds one file to an owned ticket.
 *
 * The order is the contract, and it is what makes BR-30 hold: ownership, then
 * the active count, then the file's own rules, then the write, then the row —
 * and if the row fails, the file is removed. Everything that can be decided
 * without touching the disk is decided before the disk is touched, so the
 * compensating delete covers one narrow window rather than every rejection.
 */
attachmentsRouter.post(
  "/tickets/:id/attachments",
  requireRequesterContext,
  requireOwnedTicket,
  acceptFile,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const requester = requesterOf(res);
    const ticketId = identifier(req.params.id);

    if (ticketId === null) {
      notFound(res, "ticket");
      return;
    }

    const { file } = req;

    if (!file) {
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "No file was attached to the request.",
        { file: "Choose a file to attach." }
      );
      return;
    }

    try {
      const checked = validateUpload(file);

      if (!checked.ok) {
        const failure = UPLOAD_FAILURES[checked.code];

        sendError(res, failure.status, failure.code, checked.message);
        return;
      }

      const storedFilename = storedNameFor(file.originalname);

      try {
        /*
         * The count and the insert now happen under a lock on the ticket row.
         *
         * As a read followed by a write they were two statements with nothing
         * holding them together: two uploads that both saw four were both
         * allowed through, and BR-23's "at most five" became "usually five".
         * A probe with six concurrent uploads never caught it, which is why it
         * shipped unfixed and unclaimed — the peer review caught it by reading.
         *
         * `FOR UPDATE` on the ticket serialises uploads per ticket and nothing
         * wider: two people attaching to two different tickets never wait for
         * each other.
         */
        const created = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;

          // BR-29: removed rows do not count, which is what makes removal a way
          // to make room rather than a permanent loss of a slot.
          const active = await tx.attachment.count({
            where: { ticketId, removedAt: null },
          });

          if (active >= ACTIVE_LIMIT) {
            throw new AttachmentLimitError();
          }

          // The bytes are written inside the transaction so that a rollback and
          // the compensating delete are reached by the same path. Written
          // before it, a limit rejection would leave the file behind.
          await writeAttachment(storedFilename, file.buffer);

          return await tx.attachment.create({
            data: {
              ticketId,
              originalFilename: file.originalname,
              storedFilename,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              uploadedById: requester.id,
            },
            select: ATTACHMENT_SHAPE,
          });
        });

        res.status(201).json(toAttachmentResponse(created));
      } catch (error) {
        /*
         * BR-30, widened. Cleanup used to cover only a failed metadata insert;
         * a write that failed part-way through left the bytes it had managed
         * behind, and nothing referred to them. Every failure after the name is
         * generated now runs the same compensation.
         */
        await deleteAttachment(storedFilename);

        if (error instanceof AttachmentLimitError) {
          sendError(
            res,
            409,
            ErrorCode.attachmentLimitReached,
            `A ticket may have at most ${ACTIVE_LIMIT} active attachments. Remove one before adding another.`
          );
          return;
        }

        throw error;
      }
    } catch (error) {
      sendInternalError(res, "Failed to store attachment", error);
    }
  }
);

/**
 * Streams one active owned attachment.
 *
 * `Content-Disposition: attachment` for every type including images (BR-25,
 * D-08). Serving uploaded content inline from the application's own origin is
 * how an upload becomes script execution; forcing the download removes the
 * question rather than answering it per type.
 */
attachmentsRouter.get(
  "/attachments/:id/download",
  requireRequesterContext,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const requester = requesterOf(res);
    const id = identifier(req.params.id);

    if (id === null) {
      notFound(res, "attachment");
      return;
    }

    try {
      const attachment = await ownedAttachment(id, requester.id);

      if (!attachment) {
        notFound(res, "attachment");
        return;
      }

      // BR-28. The metadata stays visible; the bytes do not. A direct hit on
      // this URL after removal is exactly the case Part 8 asks to see fail.
      if (attachment.removedAt !== null) {
        sendError(
          res,
          404,
          ErrorCode.attachmentRemoved,
          "That attachment has been removed."
        );
        return;
      }

      /*
       * The file is confirmed present before a single header is written.
       *
       * Piping first and hoping meant a row whose bytes had gone left the
       * request hanging for ever: the stream emits `error` after the response
       * has already been committed, nothing answers, and on an unhandled
       * `error` event Node takes the process down. A probe reproduced the hang
       * in fifteen seconds.
       *
       * A missing file is our fault, not the caller's — the row promised
       * something the disk does not have — so it is a 500, not a 404.
       */
      try {
        await stat(pathFor(attachment.storedFilename));
      } catch {
        sendInternalError(
          res,
          "Attachment file missing from storage",
          new Error(`Attachment ${attachment.id} has no file on disk.`)
        );
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader(
        "Content-Disposition",
        contentDispositionFor(attachment.originalFilename)
      );
      res.setHeader("Content-Length", String(attachment.sizeBytes));
      // Belt and braces: a browser that ignores the disposition must still not
      // be allowed to guess a type of its own from the bytes.
      res.setHeader("X-Content-Type-Options", "nosniff");

      const stream = createReadStream(pathFor(attachment.storedFilename));

      // The check above closes the window that matters, but a read can still
      // fail mid-flight. Headers are already out by then, so there is no
      // status left to send — ending the response is the only honest move,
      // and it is still better than an unhandled `error` event.
      stream.on("error", () => {
        res.destroy();
      });

      stream.pipe(res);
    } catch (error) {
      sendInternalError(res, "Failed to download attachment", error);
    }
  }
);

/**
 * Soft removal (BR-26). The row survives; the file becomes unreachable.
 *
 * `DELETE` is right even though nothing is deleted: the contract says what the
 * caller intends, not how the server stores it. If this ever became a hard
 * delete, no caller would change.
 */
attachmentsRouter.delete(
  "/attachments/:id",
  requireRequesterContext,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const requester = requesterOf(res);
    const id = identifier(req.params.id);

    if (id === null) {
      notFound(res, "attachment");
      return;
    }

    const reason = validateRemovalReason(
      (req.body as { reason?: unknown } | undefined)?.reason
    );

    try {
      const attachment = await ownedAttachment(id, requester.id);

      // Ownership is resolved before the reason is complained about. Telling a
      // stranger their reason is too short would confirm the attachment exists.
      if (!attachment) {
        notFound(res, "attachment");
        return;
      }

      if (attachment.removedAt !== null) {
        sendError(
          res,
          404,
          ErrorCode.attachmentRemoved,
          "That attachment has already been removed."
        );
        return;
      }

      if (!reason.ok) {
        sendError(res, 400, ErrorCode.validationFailed, reason.message, {
          reason: reason.message,
        });
        return;
      }

      /*
       * The write carries the same condition the read above checked.
       *
       * Read then write, as two statements, let two removals of one attachment
       * both pass the check and both succeed: the second overwrote the first's
       * time, reason and remover, and answered 200 as though it had done the
       * removing. BR-26 exists to keep the record of what was removed and why,
       * and that is precisely what was being overwritten.
       *
       * `updateMany` with `removedAt: null` makes the database settle it. A
       * count of zero means somebody else got there first.
       */
      const { count } = await prisma.attachment.updateMany({
        where: { id, removedAt: null },
        data: {
          removedAt: new Date(),
          removedReason: reason.value,
          removedById: requester.id,
        },
      });

      if (count === 0) {
        sendError(
          res,
          404,
          ErrorCode.attachmentRemoved,
          "That attachment has already been removed."
        );
        return;
      }

      const removed = await prisma.attachment.findUniqueOrThrow({
        where: { id },
        select: ATTACHMENT_SHAPE,
      });

      res.status(200).json(toAttachmentResponse(removed));
    } catch (error) {
      sendInternalError(res, "Failed to remove attachment", error);
    }
  }
);
