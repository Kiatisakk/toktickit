import { Router } from "express";
import type { Response } from "express";

import { hashPassword } from "../auth/password.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import { requireRole } from "../middleware/role.js";
import {
  currentUser,
  requirePasswordChangeSatisfied,
  requireSession,
} from "../middleware/session.js";
import { prisma } from "../prisma.js";
import {
  parseUserQuery,
  validateInitialPassword,
  validateNewUser,
  validateUserChanges,
} from "../users/validation.js";

/**
 * Administrator user management (api-spec.md §9).
 *
 * Every route is Administrator only: `401` without a session, `403` for any
 * other role (AC-14). Nothing here ever returns a credential — every read and
 * every write selects `USER_SHAPE`, which has no hash in it (BR-06, SEC-12).
 */
export const adminUsersRouter = Router();

adminUsersRouter.use(
  "/admin",
  requireSession,
  requirePasswordChangeSatisfied,
  requireRole("ADMIN")
);

/** The one shape a user leaves this API in. */
const USER_SHAPE = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} as const;

/** Thrown inside a transaction to roll it back and answer with a refusal. */
class RefusalError extends Error {
  readonly status: number;
  readonly code: (typeof ErrorCode)[keyof typeof ErrorCode];
  readonly details: Record<string, string> | undefined;

  constructor(
    status: number,
    code: (typeof ErrorCode)[keyof typeof ErrorCode],
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

const userNotFound = () =>
  new RefusalError(
    404,
    ErrorCode.userNotFound,
    "That user could not be found."
  );

const emailTaken = () =>
  new RefusalError(
    409,
    ErrorCode.emailAlreadyExists,
    "Another account already uses that email address.",
    { email: "Another account already uses this email address." }
  );

/**
 * A unique-constraint violation, whichever way Prisma reports it.
 *
 * The pre-check below catches the ordinary case with a readable message; this
 * catches the race in which two requests claim one address between the check
 * and the write, and the index is what refuses the second.
 */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const answer = (res: Response, context: string, error: unknown): void => {
  if (error instanceof RefusalError) {
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (isUniqueViolation(error)) {
    const taken = emailTaken();

    sendError(res, taken.status, taken.code, taken.message, taken.details);
    return;
  }

  sendInternalError(res, context, error);
};

const refuseInvalid = (
  res: Response,
  message: string,
  details: Record<string, string>
): void => {
  sendError(res, 400, ErrorCode.validationFailed, message, details);
};

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
adminUsersRouter.get("/admin/users", async (req, res) => {
  const parsed = parseUserQuery(req.query as Record<string, unknown>);

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

  const { search, role } = parsed.value;

  try {
    const users = await prisma.user.findMany({
      where: {
        ...(role === undefined ? {} : { role }),
        ...(search === undefined
          ? {}
          : {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }),
      },
      // Not paginated (§8.5), so the order is the whole of the presentation.
      // The id breaks ties between two people of the same name.
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: USER_SHAPE,
    });

    res.status(200).json(users);
  } catch (error) {
    sendInternalError(res, "Failed to list users", error);
  }
});

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
adminUsersRouter.post("/admin/users", async (req, res) => {
  const input = validateNewUser(req.body);

  if (!input.ok) {
    refuseInvalid(res, "The user could not be created.", input.details);
    return;
  }

  const { initialPassword, ...fields } = input.value;

  try {
    // Hashed before the database is touched: scrypt is slow on purpose, and
    // nothing about the result depends on what the database holds.
    const passwordHash = await hashPassword(initialPassword);

    const existing = await prisma.user.findFirst({
      where: { email: { equals: fields.email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existing) {
      throw emailTaken();
    }

    const created = await prisma.user.create({
      // AC-29: a starting password is always one the user must replace.
      data: { ...fields, passwordHash, mustChangePassword: true },
      select: USER_SHAPE,
    });

    res.status(201).json(created);
  } catch (error) {
    answer(res, "Failed to create user", error);
  }
});

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
adminUsersRouter.patch("/admin/users/:id", async (req, res) => {
  const caller = currentUser(res);
  const changes = validateUserChanges(req.body);

  // Validation before existence and before every conflict, so a request that
  // is both malformed and conflicting is answered as malformed (api-spec §9).
  if (!changes.ok) {
    refuseInvalid(res, "The user could not be updated.", changes.details);
    return;
  }

  const id = identifier(req.params.id);

  if (id === null) {
    answer(res, "Failed to update user", userNotFound());
    return;
  }

  const { value } = changes;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      /*
       * BR-35, D-14, AC-33. The active Administrator rows are locked before
       * anything is read or decided.
       *
       * Two Administrators deactivating each other at once both reach this
       * line. The first takes the locks, sees two, deactivates one and
       * commits. The second was waiting on the same rows; when it resumes,
       * PostgreSQL re-evaluates `FOR UPDATE`'s condition against what the
       * first committed, so it now sees one — and refuses. Counting without
       * the lock, both would see two and both would proceed.
       *
       * Ordered by id so every transaction takes the locks in the same order;
       * two taking them in opposite orders could deadlock instead.
       */
      const activeAdmins = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "User"
        WHERE "role" = 'ADMIN' AND "isActive" = true
        ORDER BY "id"
        FOR UPDATE`;

      // Read after the lock, so the decision is about the committed state.
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true },
      });

      if (!target) {
        throw userNotFound();
      }

      // BR-34, AC-31. Deactivation only: FR-38 says nothing about your own
      // role, so self-demotion falls through to the last-Administrator check.
      if (value.isActive === false && target.id === caller.id) {
        throw new RefusalError(
          409,
          ErrorCode.cannotDeactivateSelf,
          "You cannot deactivate your own account."
        );
      }

      if (value.email !== undefined) {
        const holder = await tx.user.findFirst({
          where: {
            email: { equals: value.email, mode: "insensitive" },
            id: { not: target.id },
          },
          select: { id: true },
        });

        if (holder) {
          throw emailTaken();
        }
      }

      const stopsBeingActiveAdmin =
        target.role === "ADMIN" &&
        target.isActive &&
        ((value.role !== undefined && value.role !== "ADMIN") ||
          value.isActive === false);

      if (stopsBeingActiveAdmin) {
        const remaining = activeAdmins.filter(
          (admin) => admin.id !== target.id
        ).length;

        if (remaining === 0) {
          throw new RefusalError(
            409,
            ErrorCode.lastActiveAdmin,
            "This is the only active Administrator. Make someone else an active Administrator first."
          );
        }
      }

      return await tx.user.update({
        where: { id: target.id },
        data: value,
        select: USER_SHAPE,
      });
    });

    // A deactivation or a role change reaches the affected user on their next
    // request, because the session caches nothing about them (BR-15, D-02).
    res.status(200).json(updated);
  } catch (error) {
    answer(res, "Failed to update user", error);
  }
});

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
adminUsersRouter.post("/admin/users/:id/password", async (req, res) => {
  const password = validateInitialPassword(
    (req.body as { initialPassword?: unknown } | undefined)?.initialPassword
  );

  if (!password.ok) {
    refuseInvalid(res, "The password could not be set.", password.details);
    return;
  }

  const id = identifier(req.params.id);

  if (id === null) {
    answer(res, "Failed to set password", userNotFound());
    return;
  }

  try {
    const passwordHash = await hashPassword(password.value);

    // BR-37: the hash, the flag and the end of every session the user holds
    // commit together. A password replaced while an old session survived would
    // leave whoever held that session signed in without the new password.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });

      if (count === 0) {
        throw userNotFound();
      }

      await tx.session.deleteMany({ where: { userId: id } });
    });

    res.status(204).end();
  } catch (error) {
    answer(res, "Failed to set password", error);
  }
});
