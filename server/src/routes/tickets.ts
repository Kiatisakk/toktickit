import { Router } from "express";

import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import {
  requesterOf,
  requireRequesterContext,
} from "../middleware/requesterContext.js";
import { prisma } from "../prisma.js";
import { claimTicketNumber } from "../tickets/ticketNumber.js";
import { validateTicketInput } from "../tickets/validation.js";

export const ticketsRouter = Router();

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
    // Reference data is checked before the transaction opens, so a bad
    // category is a validation failure rather than a foreign-key error that
    // would surface as a 500. Active, not merely present: a retired category
    // still exists so the tickets already on it are not orphaned, but nothing
    // new should be filed against it.
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({
        where: { id: input.value.categoryId, isActive: true },
        select: { id: true },
      }),
      prisma.relatedSystem.findFirst({
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
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "The ticket could not be created.",
        details
      );
      return;
    }

    const ticket = await prisma.$transaction(async (tx) => {
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
          // Ownership comes from the validated context. Anything the body
          // said about who this belongs to was never read (BR-11).
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
    sendInternalError(res, "Failed to create ticket", error);
  }
});
