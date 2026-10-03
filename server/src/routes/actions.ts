import type { Response } from "express";
import { Router } from "express";

import { isActionableStatus } from "../actions/domain.js";
import { ACTION_SHAPE, toActionResponse } from "../actions/shape.js";
import type { ActionResponse } from "../actions/shape.js";
import {
  mergeFollowUp,
  validateCancel,
  validateComplete,
  validateCreateAction,
  validateEditAction,
} from "../actions/validation.js";
import type { CreateActionInput } from "../actions/validation.js";
import { readableTicketsOf } from "../auth/scope.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { ErrorCodeValue } from "../http/errors.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import { requireRole } from "../middleware/role.js";
import { currentUser, requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import { lockTicket } from "../tickets/lock.js";

/**
 * Actions Taken (api-spec.md §4).
 *
 * Reading is open to every signed-in role, scoped like ticket detail: a
 * Requester sees every Action on their own Ticket and nothing on anyone
 * else's. Every write is IT Staff and Administrator only, and the role guard
 * runs before the body is read, so a Requester is refused `403` whatever they
 * sent (BR-11, AC-07).
 *
 * **Every write takes the Ticket row's lock first** (BR-16) and does all its
 * checking under it. That serialises Action writes on one Ticket with each
 * other — which is what makes "exactly one of two simultaneous completions
 * wins" (AC-25) and "ten simultaneous creates with one key leave one Action"
 * (AC-48) exact — and with the resolution gate (AC-27).
 *
 * There is no `DELETE` and no way out of Done or Cancelled (BR-04): a route
 * that does not exist cannot be reached by a missing guard.
 */
export const actionsRouter = Router();

const staffOnly = [...requireSignedIn, requireRole("IT_STAFF", "ADMIN")];

/** Long enough for ten requests queued behind one Ticket lock. */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * A refusal raised inside a transaction.
 *
 * Throwing is how an interactive transaction is rolled back, and every refusal
 * here is decided under the lock, so the unwinding is the point rather than a
 * workaround.
 */
class RefusalError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ErrorCodeValue,
    message: string,
    details?: Record<string, string>
  ) {
    super(message);
    this.name = "RefusalError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const ticketNotFound = (): RefusalError =>
  new RefusalError(
    404,
    ErrorCode.ticketNotFound,
    "That ticket could not be found."
  );

const actionNotFound = (): RefusalError =>
  new RefusalError(
    404,
    ErrorCode.actionNotFound,
    "That action could not be found."
  );

const staleUpdate = (): RefusalError =>
  new RefusalError(
    409,
    ErrorCode.staleUpdate,
    "Someone else changed this action. Reload it and try again."
  );

const notActionable = (): RefusalError =>
  new RefusalError(
    409,
    ErrorCode.ticketNotActionable,
    "This ticket no longer accepts actions."
  );

const notEditable = (): RefusalError =>
  new RefusalError(
    409,
    ErrorCode.actionNotEditable,
    "A done or cancelled action cannot be changed."
  );

const ineligible = (): RefusalError =>
  new RefusalError(
    400,
    ErrorCode.actionAssigneeIneligible,
    "Only active IT Staff and Administrators can perform an action."
  );

const invalid = (
  message: string,
  details: Record<string, string>
): RefusalError =>
  new RefusalError(400, ErrorCode.validationFailed, message, details);

const sendRefusal = (res: Response, refusal: RefusalError): void => {
  sendError(
    res,
    refusal.status,
    refusal.code,
    refusal.message,
    refusal.details
  );
};

/** Sends a refusal, or answers 500 for anything that is not one. */
const sendFailure = (res: Response, context: string, error: unknown): void => {
  if (error instanceof RefusalError) {
    sendRefusal(res, error);
    return;
  }

  sendInternalError(res, context, error);
};

/**
 * BR-07: active at the moment of the write, and IT Staff or Administrator.
 *
 * The performer's row is read `FOR SHARE`, so it stays as read until this
 * transaction ends. A deactivation or a role change is an `UPDATE` of that row
 * and waits for the lock; when it resumes the Action is already committed, and
 * the performer was eligible when it was. Read the other way round, a change
 * that committed first is what this read sees, because PostgreSQL re-evaluates
 * the condition against the committed row after waiting. Without the lock the
 * eligibility could change between this read and the commit, and an Action
 * would be stored against someone who was no longer eligible (review of PR 81).
 *
 * `FOR SHARE` rather than `FOR UPDATE`: two writes naming the same performer
 * on different Tickets need not queue behind each other, only behind a change
 * to the performer. Lock order is Ticket then User everywhere: the Ticket lock
 * is taken first in every Action write, and the user-edit endpoint locks only
 * User rows, never a Ticket, so no cycle can form.
 */
const requireEligiblePerformer = async (
  tx: Prisma.TransactionClient,
  userId: number
): Promise<void> => {
  const performers = await tx.$queryRaw<{ id: number }[]>`
    SELECT "id" FROM "User"
    WHERE "id" = ${userId}
      AND "isActive" = true
      AND "role"::text IN ('IT_STAFF', 'ADMIN')
    FOR SHARE`;

  if (performers.length === 0) {
    throw ineligible();
  }
};

/* ------------------------------------------------------------- reading -- */

actionsRouter.get(
  "/tickets/:id/actions",
  ...requireSignedIn,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    try {
      const ticketId = identifier(String(req.params.id));

      // Scoped inside the query, as ticket detail is (BR-31): another
      // Requester's Ticket matches nothing and is answered exactly as one that
      // does not exist.
      const ticket =
        ticketId === null
          ? null
          : await prisma.ticket.findFirst({
              where: { id: ticketId, ...readableTicketsOf(currentUser(res)) },
              select: { id: true },
            });

      if (!ticket) {
        sendRefusal(res, ticketNotFound());
        return;
      }

      const actions = await prisma.actionTaken.findMany({
        where: { ticketId: ticket.id },
        select: ACTION_SHAPE,
        // The id settles two Actions at the same instant (FR-03).
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
      });

      res.status(200).json({ data: actions.map(toActionResponse) });
    } catch (error) {
      sendInternalError(res, "Failed to list actions", error);
    }
  }
);

/* ------------------------------------------------------------ creating -- */

/**
 * Whether a stored Action says what a create request says (BR-35).
 *
 * Fields the request left out are compared at their defaults, so a retry that
 * drops a field is a different request, not a replay. The action time is the
 * one exception: its default is the server clock, which a retry cannot
 * reproduce, so it is compared only when it was sent.
 */
const sameRequest = (
  stored: ActionResponse,
  input: CreateActionInput,
  callerId: number
): boolean =>
  stored.description === input.description &&
  stored.result === input.result &&
  stored.followUpRequired === input.followUpRequired &&
  stored.followUpNote === input.followUpNote &&
  stored.attachmentNotes === input.attachmentNotes &&
  stored.followsUpId === input.followsUpId &&
  stored.performedBy.id === (input.performedById ?? callerId) &&
  (input.actionAt === null ||
    stored.actionAt.getTime() === input.actionAt.getTime());

/**
 * BR-10: an earlier Action on this Ticket that wants follow-up.
 *
 * "Earlier" is checked, not assumed from the id: the target may not be dated
 * after the new Action's effective time, so the list never shows a follow-up
 * before the Action it follows up. The same instant is allowed, because the
 * list breaks ties by id and the target, existing already, has the smaller one.
 */
const requireFollowable = async (
  tx: Prisma.TransactionClient,
  ticketId: number,
  followsUpId: number,
  actionAt: Date
): Promise<void> => {
  const target = await tx.actionTaken.findFirst({
    where: {
      id: followsUpId,
      ticketId,
      followUpRequired: true,
      state: { not: "CANCELLED" },
    },
    select: { actionAt: true },
  });

  if (!target) {
    throw invalid("The action could not be saved.", {
      followsUpId:
        "Choose an earlier action on this ticket that needs follow-up and is not cancelled.",
    });
  }

  if (target.actionAt.getTime() > actionAt.getTime()) {
    throw invalid("The action could not be saved.", {
      followsUpId:
        "Choose an action dated no later than this one: a follow-up cannot come before the action it follows up.",
    });
  }
};

/**
 * BR-10, on edit: moving an Action's time must keep it no earlier than the
 * Action it follows up, and no later than any Action that follows it up.
 */
const requireChronologyKept = async (
  tx: Prisma.TransactionClient,
  action: ActionRow,
  actionAt: Date
): Promise<void> => {
  const target =
    action.followsUpId === null
      ? null
      : await tx.actionTaken.findUnique({
          where: { id: action.followsUpId },
          select: { actionAt: true },
        });

  if (target && target.actionAt.getTime() > actionAt.getTime()) {
    throw invalid("The action could not be saved.", {
      actionAt:
        "This action follows up an earlier one, so it cannot be dated before it.",
    });
  }

  const earlierFollower = await tx.actionTaken.findFirst({
    where: { followsUpId: action.id, actionAt: { lt: actionAt } },
    select: { id: true },
  });

  if (earlierFollower) {
    throw invalid("The action could not be saved.", {
      actionAt:
        "Another action follows this one up and is dated earlier than this time.",
    });
  }
};

actionsRouter.post(
  "/tickets/:id/actions",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const user = currentUser(res);
    const input = validateCreateAction(req.body, new Date());

    if (!input.ok) {
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "The action could not be saved.",
        input.details
      );
      return;
    }

    try {
      const ticketId = identifier(String(req.params.id));

      if (ticketId === null) {
        throw ticketNotFound();
      }

      const { value } = input;

      const outcome = await prisma.$transaction(async (tx) => {
        const ticket = await lockTicket(tx, ticketId);

        if (!ticket) {
          throw ticketNotFound();
        }

        // The key is looked up under the lock, so two simultaneous requests
        // with one key cannot both find nothing (BR-35). A replay is answered
        // before the actionable check: the first request did succeed, and the
        // retry exists because its answer was lost.
        const existing = await tx.actionTaken.findUnique({
          where: {
            ticketId_requestId: { ticketId, requestId: value.requestId },
          },
          select: ACTION_SHAPE,
        });

        if (existing) {
          const stored = toActionResponse(existing);

          if (!sameRequest(stored, value, user.id)) {
            throw new RefusalError(
              409,
              ErrorCode.requestIdConflict,
              "That request key was already used for a different action."
            );
          }

          return { status: 200, action: stored };
        }

        if (!isActionableStatus(ticket.currentStatus)) {
          throw notActionable();
        }

        const performedById = value.performedById ?? user.id;
        const actionAt = value.actionAt ?? new Date();

        await requireEligiblePerformer(tx, performedById);

        if (value.followsUpId !== null) {
          await requireFollowable(tx, ticketId, value.followsUpId, actionAt);
        }

        // The recorder is the session and the state is Planned. Neither is
        // read from the request (BR-07, AC-03).
        const created = await tx.actionTaken.create({
          data: {
            ticketId,
            recordedById: user.id,
            performedById,
            actionAt,
            description: value.description,
            result: value.result,
            followUpRequired: value.followUpRequired,
            followUpNote: value.followUpNote,
            attachmentNotes: value.attachmentNotes,
            requestId: value.requestId,
            followsUpId: value.followsUpId,
          },
          select: ACTION_SHAPE,
        });

        return { status: 201, action: toActionResponse(created) };
      }, TRANSACTION_OPTIONS);

      res.status(outcome.status).json(outcome.action);
    } catch (error) {
      sendFailure(res, "Failed to create an action", error);
    }
  }
);

/* ------------------------------------------------------------- changing -- */

type ActionRow = Prisma.ActionTakenGetPayload<{ select: typeof ACTION_SHAPE }>;

/**
 * Runs one write to an existing Action under the Ticket lock, and applies the
 * checks every such write shares in the order BR-20 fixes: existence, version,
 * the Action's state, then the Ticket's.
 *
 * The Action is read once outside the transaction only to learn which Ticket to
 * lock, and again under the lock, which is the reading the checks use.
 */
const changeAction = async (
  res: Response,
  context: string,
  rawId: unknown,
  version: number,
  apply: (
    tx: Prisma.TransactionClient,
    action: ActionRow
  ) => Promise<Prisma.ActionTakenUncheckedUpdateManyInput>
): Promise<void> => {
  try {
    const id = identifier(String(rawId));
    const located =
      id === null
        ? null
        : await prisma.actionTaken.findUnique({
            where: { id },
            select: { ticketId: true },
          });

    if (id === null || !located) {
      throw actionNotFound();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await lockTicket(tx, located.ticketId);
      const action = await tx.actionTaken.findUnique({
        where: { id },
        select: ACTION_SHAPE,
      });

      if (!ticket || !action) {
        throw actionNotFound();
      }

      if (action.version !== version) {
        throw staleUpdate();
      }

      if (action.state !== "PLANNED") {
        throw notEditable();
      }

      if (!isActionableStatus(ticket.currentStatus)) {
        throw notActionable();
      }

      const data = await apply(tx, action);

      // The version is in the condition as well as the earlier check: the lock
      // makes the two agree, and the condition is what would still refuse a
      // write if someone later took a path that did not lock (BR-19).
      const written = await tx.actionTaken.updateMany({
        where: { id, version, state: "PLANNED" },
        data: { ...data, version: { increment: 1 } },
      });

      if (written.count === 0) {
        throw staleUpdate();
      }

      return tx.actionTaken.findUniqueOrThrow({
        where: { id },
        select: ACTION_SHAPE,
      });
    }, TRANSACTION_OPTIONS);

    res.status(200).json(toActionResponse(updated));
  } catch (error) {
    sendFailure(res, context, error);
  }
};

const badBody = (
  res: Response,
  message: string,
  details: Record<string, string>
): void => {
  sendError(res, 400, ErrorCode.validationFailed, message, details);
};

/** BR-10: an Action another Action follows up keeps needing follow-up. */
const requireStillFollowedUp = async (
  tx: Prisma.TransactionClient,
  action: ActionRow
): Promise<void> => {
  const followers = await tx.actionTaken.count({
    where: { followsUpId: action.id },
  });

  if (followers > 0) {
    throw invalid("The action could not be saved.", {
      followUpRequired:
        "Another action follows this one up, so it still needs follow-up.",
    });
  }
};

actionsRouter.patch(
  "/actions/:id",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = validateEditAction(req.body, new Date());

    if (!input.ok) {
      badBody(res, "The action could not be saved.", input.details);
      return;
    }

    const { version, changes } = input.value;

    await changeAction(
      res,
      "Failed to edit an action",
      req.params.id,
      version,
      async (tx, action) => {
        if (changes.performedById !== undefined) {
          await requireEligiblePerformer(tx, changes.performedById);
        }

        const data: Prisma.ActionTakenUncheckedUpdateManyInput = {};

        if (changes.actionAt !== undefined) {
          await requireChronologyKept(tx, action, changes.actionAt);
          data.actionAt = changes.actionAt;
        }

        if (changes.description !== undefined) {
          data.description = changes.description;
        }

        if (changes.result !== undefined) {
          data.result = changes.result;
        }

        if (changes.attachmentNotes !== undefined) {
          data.attachmentNotes = changes.attachmentNotes;
        }

        if (changes.performedById !== undefined) {
          data.performedById = changes.performedById;
        }

        const touchesFollowUp =
          changes.followUpRequired !== undefined ||
          changes.followUpNote !== undefined;

        if (touchesFollowUp) {
          const merged = mergeFollowUp(
            { required: action.followUpRequired, note: action.followUpNote },
            { required: changes.followUpRequired, note: changes.followUpNote }
          );

          if (!merged.ok) {
            throw invalid("The action could not be saved.", merged.details);
          }

          if (action.followUpRequired && !merged.required) {
            await requireStillFollowedUp(tx, action);
          }

          data.followUpRequired = merged.required;
          data.followUpNote = merged.note;
        }

        return data;
      }
    );
  }
);

actionsRouter.post(
  "/actions/:id/complete",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = validateComplete(req.body);

    if (!input.ok) {
      badBody(res, "The action could not be completed.", input.details);
      return;
    }

    const { version, result } = input.value;

    await changeAction(
      res,
      "Failed to complete an action",
      req.params.id,
      version,
      // oxlint-disable-next-line require-await
      async (_tx, action) => {
        // BR-06: a result is needed, stored already or sent now, and a sent
        // one replaces the stored one.
        const finalResult = result ?? action.result;

        if (finalResult === null || finalResult.trim() === "") {
          throw invalid("The action could not be completed.", {
            result: "Enter the result before completing the action.",
          });
        }

        return { state: "DONE", result: finalResult };
      }
    );
  }
);

actionsRouter.post(
  "/actions/:id/cancel",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = validateCancel(req.body);

    if (!input.ok) {
      badBody(res, "The action could not be cancelled.", input.details);
      return;
    }

    const { version, cancelReason } = input.value;

    await changeAction(
      res,
      "Failed to cancel an action",
      req.params.id,
      version,
      // oxlint-disable-next-line require-await
      async () => ({ state: "CANCELLED", cancelReason })
    );
  }
);
