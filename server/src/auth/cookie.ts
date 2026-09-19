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
 * **On unless explicitly turned off.** An earlier version turned it on only when
 * `NODE_ENV` was `production`, which left it off in staging and anywhere the
 * variable was simply unset — the opposite of failing safe, and against
 * api-spec.md §1, which requires it everywhere but local development.
 *
 * Local development does not need the opt-out in a current browser: Chromium
 * and Firefox treat `http://localhost` as a secure context and accept a
 * `Secure` cookie on it. `COOKIE_SECURE=false` exists for the case where the
 * API is reached by a non-localhost address over plain HTTP, and it has to be
 * written down to take effect.
 */
const cookieSecure = (): boolean => process.env["COOKIE_SECURE"] !== "false";

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
