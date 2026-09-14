import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../prisma.js";

/**
 * Session tokens and the session table.
 *
 * The token is opaque — it carries no claims, no user id, and no expiry, so
 * nothing about it can be read or forged; the row is the whole of the truth
 * (D-01). What is stored is the token's SHA-256 hash, so a disclosed database
 * yields nothing a caller could present (BR-10).
 *
 * SHA-256 rather than scrypt here, deliberately. A password is low-entropy and
 * guessable, so its hash must be slow. A 256-bit random token is not guessable,
 * so a fast hash costs nothing in resistance and keeps the lookup on every
 * single request cheap.
 */

/** The cookie the browser holds. Named in api-spec.md §1. */
export const SESSION_COOKIE = "toktickit.session";

/** BR-11, A-02: eight hours from creation, never renewed by activity. */
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

const TOKEN_BYTES = 32;

/**
 * Draws a new session token.
 *
 * base64url so it survives a cookie value without escaping. 32 bytes is 256
 * bits of entropy, which is past the point where the birthday bound on the
 * unique index matters.
 */
export const newSessionToken = (): string =>
  randomBytes(TOKEN_BYTES).toString("base64url");

/** The stored form of a token. Never reversible to the token itself. */
export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

/**
 * Opens a session for a user and returns the token to put in the cookie.
 *
 * The token is returned here and nowhere else: after this call the only copy
 * outside the browser is a hash, so a session cannot be recovered from the
 * database by anyone, including us.
 *
 * Signing in does not disturb sessions already open (BR-12) — this inserts a
 * row and touches no other.
 */
export const openSession = async (userId: number): Promise<IssuedSession> => {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await prisma.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
};

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMIN";
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface LiveSession {
  sessionId: string;
  user: SessionUser;
}

/**
 * Resolves a token to a live session, or null.
 *
 * Null covers every reason equally — no such token, expired, deleted, or a user
 * who has since been deactivated — because the caller answers all of them with
 * the same `401` (BR-13). Distinguishing them here would only invite a handler
 * to distinguish them on the wire.
 *
 * The user is read on every request rather than cached on the session row
 * (BR-15, D-02): a deactivation or a role change takes effect on the user's
 * next request, not at their next sign-in.
 */
export const resolveSession = async (
  token: string
): Promise<LiveSession | null> => {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    // Expiry is enforced by reading the row, not by a sweep. A cleanup job may
    // delete expired rows later; nothing depends on it having run.
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  return { sessionId: session.id, user: session.user };
};

/**
 * Ends one session.
 *
 * Deleting a row that is not there is not an error: signing out is idempotent,
 * and refusing would disclose whether a token was live (api-spec.md §4).
 */
export const closeSession = async (token: string): Promise<void> => {
  await prisma.session.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
};

/**
 * Stores a new password, ends every session the user holds, and issues one
 * replacement for the caller (BR-14, AC-09).
 *
 * **All three writes are one transaction.** An earlier version committed the
 * password first and rotated the sessions afterwards, so a failure between the
 * two left the new password active while every old token — including any that
 * had been observed — still worked. A password change is exactly the moment an
 * old token must stop working, so either all of it happens or none of it does.
 *
 * The hash is computed by the caller, before this is called: scrypt is
 * deliberately slow, and holding a transaction open across it would serialise
 * sign-ins behind password changes for no benefit.
 */
export const replacePasswordAndSessions = async (
  userId: number,
  passwordHash: string
): Promise<IssuedSession> => {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.session.create({
      data: { tokenHash: hashSessionToken(token), userId, expiresAt },
    }),
  ]);

  return { token, expiresAt };
};
