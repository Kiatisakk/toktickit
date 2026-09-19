import type { NextFunction, Request, Response } from "express";

import { resolveSession, SESSION_COOKIE } from "../auth/session.js";
import type { LiveSession, SessionUser } from "../auth/session.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";

/**
 * Who a request is from, and whether they may proceed.
 *
 * Two separate guards, mounted in this order, because they answer two different
 * questions and AC-02 asserts the second one on its own (D-05):
 *
 *   requireSession                  — is there a live session? 401 if not.
 *   requirePasswordChangeSatisfied  — is a password change outstanding? 403 if so.
 *
 * The three endpoints a gated user may still reach — read the current user,
 * change the password, sign out — mount only the first.
 */

/** Sends the one refusal every "not signed in" reason shares (BR-13). */
const refuseUnauthenticated = (res: Response): void => {
  sendError(res, 401, ErrorCode.unauthenticated, "Sign in to continue.");
};

/**
 * Requires a live session.
 *
 * No session, an expired one, a deleted one, and one whose user has since been
 * deactivated are all the same `401` (AC-07, AC-08, AC-11). The reason is never
 * on the wire: telling a caller that a token *used to* be valid is telling them
 * the token was real.
 */
export const requireSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];

  if (typeof token !== "string" || token === "") {
    refuseUnauthenticated(res);
    return;
  }

  let session: LiveSession | null;

  // The try wraps only the call that can throw. Folding the branching below
  // into it would turn a mistake in this file into a 500 for the caller.
  try {
    session = await resolveSession(token);
  } catch (error) {
    sendInternalError(res, "Failed to resolve session", error);
    return;
  }

  if (!session) {
    refuseUnauthenticated(res);
    return;
  }

  res.locals["session"] = session;

  next();
};

/**
 * Reads the session the guard put on the response.
 *
 * Throws rather than returning undefined: reaching a handler without a session
 * means `requireSession` was not mounted, and returning undefined would let a
 * query run unscoped.
 */
export const currentSession = (res: Response): LiveSession => {
  const session = res.locals["session"] as LiveSession | undefined;

  if (!session) {
    throw new Error(
      "No session on the response. Mount requireSession on this route."
    );
  }

  return session;
};

export const currentUser = (res: Response): SessionUser =>
  currentSession(res).user;

/**
 * Refuses while a password change is outstanding (BR-02, FR-11, AC-02).
 *
 * Mounted after `requireSession`, so reaching it without a session is a wiring
 * mistake rather than an anonymous caller — hence the throw rather than a 401,
 * which would hide the mistake behind a plausible response.
 */
export const requirePasswordChangeSatisfied = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (currentUser(res).mustChangePassword) {
    sendError(
      res,
      403,
      ErrorCode.passwordChangeRequired,
      "Choose a new password before using the application."
    );
    return;
  }

  next();
};

/**
 * The guard every ordinary endpoint mounts: a live session, and no password
 * change outstanding.
 *
 * One name for the pair so a route cannot mount the first and forget the
 * second. Express accepts an array wherever it accepts a handler.
 */
export const requireSignedIn = [
  requireSession,
  requirePasswordChangeSatisfied,
] as const;
