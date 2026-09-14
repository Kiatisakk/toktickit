import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/session.js";
import { ErrorCode, sendError } from "../http/errors.js";
import { currentUser } from "./session.js";

type Role = SessionUser["role"];

/**
 * Refuses a signed-in user whose role is not one of `roles` (BR-17, BR-18).
 *
 * `403 FORBIDDEN`, never `404`: roles are not secret — the navigation already
 * says which destinations exist — so refusing on a role boundary discloses
 * nothing (D-06). The ownership boundary is the one that answers as absent.
 *
 * Mounted after `requireSession` and the password-change gate. The role is read
 * from the user row the session resolved on this request, not from anything
 * cached, so a demotion takes effect on the demoted user's next request (D-02).
 */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (_req, res, next) => {
    if (!roles.includes(currentUser(res).role)) {
      sendError(
        res,
        403,
        ErrorCode.forbidden,
        "You do not have permission to do that."
      );
      return;
    }

    next();
  };
