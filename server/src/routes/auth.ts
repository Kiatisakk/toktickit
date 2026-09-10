import { Router } from "express";

import { clearSessionCookie, setSessionCookie } from "../auth/cookie.js";
import {
  firstUnsatisfiedRule,
  hashPassword,
  verifyPassword,
} from "../auth/password.js";
import {
  closeSession,
  openSession,
  rotateSessionAndEndOthers,
  SESSION_COOKIE,
  type SessionUser,
} from "../auth/session.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { currentSession, requireSession } from "../middleware/session.js";
import { prisma } from "../prisma.js";

/**
 * Sign in, sign out, read the current user, change password.
 *
 * The session travels only in the cookie: no endpoint here returns a token, and
 * no endpoint anywhere reads an identity from a body, a query parameter or a
 * header (api-spec.md §1).
 */
export const authRouter = Router();

/**
 * A hash of a value nothing can supply, used when no account matches.
 *
 * Without it, an unknown address answers immediately while a known one pays for
 * a scrypt verification, and the difference is measurable from outside. BR-08
 * makes the two responses identical in content; this makes them comparable in
 * time as well.
 *
 * Computed on the first miss rather than at import, so starting the process
 * does not pay for a key derivation it may never need.
 */
let absentAccountHash: string | null = null;

const costOfAnAbsentAccount = async (password: string): Promise<false> => {
  absentAccountHash ??= await hashPassword(
    `absent-account-${Math.random().toString(36)}`
  );

  await verifyPassword(password, absentAccountHash);

  return false;
};

/** The identity shape every endpoint here returns. Never includes a hash. */
const identityOf = (user: SessionUser) => ({
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
  mustChangePassword: user.mustChangePassword,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asNonBlankString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

authRouter.post("/auth/login", async (req, res) => {
  const body = asRecord(req.body);
  const email = asNonBlankString(body["email"]);
  // Not trimmed: leading and trailing spaces are legitimate password
  // characters, and silently removing them would refuse a correct password.
  const password =
    typeof body["password"] === "string" && body["password"] !== ""
      ? body["password"]
      : null;

  const details: Record<string, string> = {};

  if (!email) {
    details["email"] = "Enter your email address.";
  }

  if (!password) {
    details["password"] = "Enter your password.";
  }

  if (!(email && password)) {
    sendError(
      res,
      400,
      ErrorCode.validationFailed,
      "Enter your email address and password.",
      details
    );
    return;
  }

  try {
    // Addresses are matched without regard to case: an email address's domain
    // is case-insensitive by definition, mail providers treat the local part
    // that way in practice, and a person typing their own address with a
    // capital would otherwise be told their credentials are wrong.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        passwordHash: true,
      },
    });

    // A row without a hash is an account the bootstrap step never reached. It
    // is not an account with no password — it is one that cannot be signed in
    // to at all, and treating it as either "no password required" or a distinct
    // failure would be worse than refusing it like any other bad credential.
    // Either way the caller pays for one key derivation, so the absent, the
    // unhashed and the wrong-password cases cost the same from outside.
    const verified = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await costOfAnAbsentAccount(password);

    if (!(user && verified)) {
      // BR-08, AC-05: an unknown address and a wrong password are one response,
      // byte for byte, so the form cannot be used to discover who has an account.
      sendError(
        res,
        401,
        ErrorCode.invalidCredentials,
        "That email address and password do not match an account."
      );
      return;
    }

    // BR-09, D-04: only now, with the password proven, is it safe to say why.
    // Someone who does not know the password cannot tell a deactivated account
    // from one that never existed; the account's owner gets an answer they can
    // act on.
    if (!user.isActive) {
      sendError(
        res,
        403,
        ErrorCode.accountInactive,
        "This account has been deactivated. Contact an administrator."
      );
      return;
    }

    // BR-12: this inserts a row and touches no other, so sessions already open
    // elsewhere continue.
    const session = await openSession(user.id);

    setSessionCookie(res, session.token, session.expiresAt);

    res.status(200).json(identityOf(user));
  } catch (error) {
    sendInternalError(res, "Failed to sign in", error);
  }
});

/**
 * Signing out is idempotent and always answers 204 (BR-13).
 *
 * Refusing a request that carries no session would disclose whether a token was
 * live, which is the one thing sign-out must not do. It therefore does not
 * mount `requireSession`.
 */
authRouter.post("/auth/logout", async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];

  try {
    if (typeof token === "string" && token !== "") {
      await closeSession(token);
    }

    clearSessionCookie(res);

    res.status(204).end();
  } catch (error) {
    sendInternalError(res, "Failed to sign out", error);
  }
});

/**
 * The only identity source the browser has (D-13).
 *
 * Reachable while a password change is outstanding, because the gated screen
 * needs to know who it is gating.
 */
authRouter.get("/auth/me", requireSession, (_req, res) => {
  res.status(200).json(identityOf(currentSession(res).user));
});

/**
 * Changing a password, including — and especially — the first one.
 *
 * Reachable while the gate is up, for the same reason.
 */
authRouter.post("/auth/password", requireSession, async (req, res) => {
  const { user } = currentSession(res);
  const body = asRecord(req.body);

  const currentPassword =
    typeof body["currentPassword"] === "string" ? body["currentPassword"] : "";
  const newPassword =
    typeof body["newPassword"] === "string" ? body["newPassword"] : "";

  if (currentPassword === "" || newPassword === "") {
    const details: Record<string, string> = {};

    if (currentPassword === "") {
      details["currentPassword"] = "Enter your current password.";
    }

    if (newPassword === "") {
      details["newPassword"] = "Enter a new password.";
    }

    sendError(
      res,
      400,
      ErrorCode.validationFailed,
      "Enter your current password and a new one.",
      details
    );
    return;
  }

  try {
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const verified = stored?.passwordHash
      ? await verifyPassword(currentPassword, stored.passwordHash)
      : false;

    if (!verified) {
      sendError(
        res,
        401,
        ErrorCode.invalidCredentials,
        "Your current password is not correct."
      );
      return;
    }

    // Checked before the rules, so someone re-entering the password they
    // already have is told that rather than being sent to fix a rule they are
    // not breaking.
    if (newPassword === currentPassword) {
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "Choose a password you are not already using.",
        { newPassword: "The new password must differ from the current one." }
      );
      return;
    }

    const unsatisfied = firstUnsatisfiedRule(newPassword);

    if (unsatisfied) {
      // The rule is named; the password is never echoed (BR-06).
      sendError(
        res,
        400,
        ErrorCode.validationFailed,
        "That password does not meet the requirements.",
        { newPassword: unsatisfied.message }
      );
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
      },
    });

    // BR-14, AC-09: every other session this user holds ends, and the session
    // in hand is replaced rather than kept — a password change is exactly when
    // a token that may have been observed should stop working.
    const rotated = await rotateSessionAndEndOthers(user.id);

    setSessionCookie(res, rotated.token, rotated.expiresAt);

    res.status(204).end();
  } catch (error) {
    sendInternalError(res, "Failed to change password", error);
  }
});
