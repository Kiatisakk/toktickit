import type { NextFunction, Request, Response } from "express";

import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { prisma } from "../prisma.js";

export const REQUESTER_HEADER = "x-development-requester-id";

export interface RequesterContext {
  id: number;
  name: string;
  email: string;
}

/**
 * Resolves the current Development Requester from the request header.
 *
 * This is **not authentication**. The header is a plain integer that anyone can
 * set to anything, and that is the point: Lab 2 needs a way to say "act as this
 * person" before login exists, and §4.2 forbids treating the mechanism as
 * secure. BR-03 says the same thing in the specification, and BR-36 records
 * what replaces it — in Lab 3 the identity comes from an authenticated session
 * and nothing downstream of this middleware changes, because everything
 * downstream only ever sees the resolved requester.
 *
 * Every requester-scoped route mounts this, and it runs before anything else
 * so that an unusable context is rejected before a query is issued.
 */
export const requireRequesterContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const raw = req.header(REQUESTER_HEADER);

  if (raw === undefined || raw.trim() === "") {
    sendError(
      res,
      400,
      ErrorCode.requesterContextRequired,
      "Select a Development Requester before using this screen."
    );
    return;
  }

  // Number() would accept "1.5", " 1 " and "1e3"; this accepts digits only.
  if (!/^\d+$/u.test(raw.trim())) {
    sendError(
      res,
      400,
      ErrorCode.requesterContextInvalid,
      "The selected Development Requester is not valid."
    );
    return;
  }

  // Safe as a plain coercion: the guard above proved the string is digits only.
  const id = Number(raw.trim());

  // The try wraps only the call that can throw. Everything after it is our own
  // branching, and folding it inside would mean a mistake in this file
  // surfaced to the client as an internal error.
  let user: {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
  } | null;

  try {
    user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isActive: true },
    });
  } catch (error) {
    sendInternalError(res, "Failed to resolve requester context", error);
    return;
  }

  if (!user) {
    sendError(
      res,
      400,
      ErrorCode.requesterContextUnknown,
      "The selected Development Requester no longer exists. Choose another."
    );
    return;
  }

  // BR-07: an inactive requester can never become the current context, even
  // if its id is supplied directly. Hiding it from the dropdown is not the
  // control; this is.
  if (!user.isActive) {
    sendError(
      res,
      400,
      ErrorCode.requesterContextInactive,
      "The selected Development Requester is no longer active. Choose another."
    );
    return;
  }

  res.locals["requester"] = {
    id: user.id,
    name: user.name,
    email: user.email,
  } satisfies RequesterContext;

  next();
};

/**
 * Reads the context that `requireRequesterContext` put on the response.
 *
 * Throws rather than returning undefined: reaching a handler without a context
 * means the middleware was not mounted, which is a wiring mistake and should
 * fail loudly in development rather than silently widening a query to every
 * requester's data.
 */
export const requesterOf = (res: Response): RequesterContext => {
  const requester = res.locals["requester"] as RequesterContext | undefined;

  if (!requester) {
    throw new Error(
      "Requester context is missing. Mount requireRequesterContext on this route."
    );
  }

  return requester;
};
