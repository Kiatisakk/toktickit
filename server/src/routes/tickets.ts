import { Router } from "express";

import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import {
  requesterOf,
  requireRequesterContext,
} from "../middleware/requesterContext.js";
import { prisma } from "../prisma.js";
import { claimTicketNumber } from "../tickets/ticketNumber.js";
import { parseTicketQuery } from "../tickets/ticketQuery.js";
import { validateTicketInput } from "../tickets/validation.js";

export const ticketsRouter = Router();

/**
 * What a row in the list carries.
 *
 * Deliberately without `description`: the list shows a summary, and sending a
 * five-thousand-character body for every row of every page to render one line
 * of it is a cost with no reader.
 */
const LIST_SHAPE = {
  id: true,
  ticketNumber: true,
  summary: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  ticketOwner: { select: { id: true, name: true } },
} as const;

/** Everything a client is given about one ticket. */
const TICKET_SHAPE = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  resolutionSummary: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  ticketOwner: { select: { id: true, name: true } },
} as const;

/**
 * Raised inside the creation transaction when a referenced row is missing or
 * retired.
 *
 * Throwing rolls the transaction back and lets the handler answer 400 with the
 * offending field, rather than letting a foreign-key violation surface as a 500
 * that tells the user nothing.
 */
class UnavailableReferenceError extends Error {
  readonly details: Record<string, string>;

  constructor(details: Record<string, string>) {
    super("A referenced row is unavailable.");
    this.name = "UnavailableReferenceError";
    this.details = details;
  }
}

// The rule guards against an async handler rejecting where Express cannot see
// it. Nothing here can: every await sits inside the try below, and the two
// statements outside it are synchronous. Express 5 also forwards rejections
// from async handlers, but this holds without relying on that.
// oxlint-disable-next-line oxc/no-async-endpoint-handlers
ticketsRouter.post("/tickets", requireRequesterContext, async (req, res) => {
  const requester = requesterOf(res);
  const input = validateTicketInput(req.body);

  if (!input.ok) {
    sendError(
      res,
      400,
      ErrorCode.validationFailed,
      "The ticket could not be created.",
      input.details
    );
    return;
  }

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      // Read inside the transaction rather than before it. A pre-check outside
      // leaves a window: the row can be retired between the check passing and
      // the insert running, and the ticket would then be filed against
      // reference data that is no longer offered. Reading here puts the check
      // and the insert under one snapshot.
      //
      // Active rather than merely present: a retired category still exists so
      // the tickets already on it are not orphaned, but nothing new may be
      // filed against it.
      const [category, relatedSystem] = await Promise.all([
        tx.category.findFirst({
          where: { id: input.value.categoryId, isActive: true },
          select: { id: true },
        }),
        tx.relatedSystem.findFirst({
          where: { id: input.value.relatedSystemId, isActive: true },
          select: { id: true },
        }),
      ]);

      const details: Record<string, string> = {};

      if (!category) {
        details["categoryId"] = "Choose a category from the list.";
      }

      if (!relatedSystem) {
        details["relatedSystemId"] = "Choose a related system from the list.";
      }

      if (Object.keys(details).length > 0) {
        throw new UnavailableReferenceError(details);
      }

      // The number is claimed inside the same transaction that inserts the
      // ticket. Claiming it outside would burn a number whenever the insert
      // failed, leaving gaps that look like deleted tickets.
      const ticketNumber = await claimTicketNumber(
        tx,
        new Date().getFullYear()
      );

      return await tx.ticket.create({
        data: {
          ticketNumber,
          // Ownership comes from the validated context. Anything the body said
          // about who this belongs to was never read (BR-11).
          requesterId: requester.id,
          categoryId: input.value.categoryId,
          relatedSystemId: input.value.relatedSystemId,
          summary: input.value.summary,
          description: input.value.description,
          requestedPriority: input.value.requestedPriority,
          // currentStatus defaults to NEW, itPriority, ticketOwner and
          // resolutionSummary stay null. Lab 2 has nothing that can set them.
        },
        select: TICKET_SHAPE,
      });
    });

    res.status(201).json({ ...ticket, attachments: [] });
  } catch (error) {
    if (error instanceof UnavailableReferenceError) {
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "The ticket could not be created.",
        error.details
      );
      return;
    }

    sendInternalError(res, "Failed to create ticket", error);
  }
});

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
ticketsRouter.get("/tickets", requireRequesterContext, async (req, res) => {
  const requester = requesterOf(res);
  const parsed = parseTicketQuery(req.query as Record<string, unknown>);

  if (!parsed.ok) {
    sendError(
      res,
      400,
      ErrorCode.invalidQueryParameter,
      "One or more query parameters are not valid.",
      parsed.details
    );
    return;
  }

  const query = parsed.value;

  try {
    // Ownership is a `where` clause, not a filter applied afterwards. Fetching
    // and then discarding would page over other people's rows and report their
    // count.
    const where = {
      requesterId: requester.id,
      ...(query.categoryId === undefined
        ? {}
        : { categoryId: query.categoryId }),
      ...(query.requestedPriority === undefined
        ? {}
        : { requestedPriority: query.requestedPriority }),
      ...(query.itPriority === undefined
        ? {}
        : { itPriority: query.itPriority }),
      ...(query.status === undefined ? {} : { currentStatus: query.status }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              {
                ticketNumber: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                summary: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }),
    };

    // One snapshot for both reads. Run separately they see different states,
    // so a ticket created between them makes totalItems disagree with the rows
    // actually returned — the metadata would claim a page that is not there.
    // Repeatable read rather than the default: under read committed each
    // statement takes its own snapshot even inside one transaction, which is
    // the very thing being avoided.
    const [totalItems, data] = await prisma.$transaction(
      [
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
          where,
          // The immutable id is always the last key. Without it two tickets
          // sharing a createdAt have no defined order between them, so the
          // same row can appear on two pages or on none (BR-32).
          orderBy: [{ [query.sort]: query.order }, { id: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: LIST_SHAPE,
        }),
      ],
      { isolationLevel: "RepeatableRead" }
    );

    res.status(200).json({
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    });
  } catch (error) {
    sendInternalError(res, "Failed to list tickets", error);
  }
});
