import type { CookieOptions, Response } from "express";

import { SESSION_COOKIE } from "./session.js";

/**
 * How the session cookie is issued.
 *
 * `Secure` is derived from configuration, never from the incoming request.
 * Reading `request.protocol` looks equivalent and is not: behind a proxy that
 * terminates TLS, Express sees plain HTTP on the socket and the flag silently
 * comes off, so the session token travels in the clear. Making it configuration
 * also keeps an attacker-influenced header (`X-Forwarded-Proto`) out of a
 * decision about a cookie's security attributes.
 *
 * `SameSite=Lax` is the cross-site request forgery control (D-01). It holds
 * because no mutating endpoint in this API is a `GET`.
 */

/**
 * Defaults to on outside development, so forgetting the variable in a deployed
 * environment fails safe. Set `COOKIE_SECURE=false` only where there is no TLS
 * at all, which is a developer machine.
 */
const cookieSecure = (): boolean => {
  const configured = process.env["COOKIE_SECURE"];

  if (configured !== undefined) {
    return configured === "true";
  }

  return process.env["NODE_ENV"] === "production";
};

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: cookieSecure(),
});

/** Issues or replaces the session cookie. */
export const setSessionCookie = (
  res: Response,
  token: string,
  expiresAt: Date
): void => {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(), expires: expiresAt });
};

/**
 * Removes the session cookie.
 *
 * The attributes must match the ones it was set with, or the browser keeps the
 * original cookie alongside the cleared one and the next request still carries
 * a token — which then answers 401 from the deleted row, so the bug shows up
 * only as a puzzling extra round trip.
 */
export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, baseOptions());
};
