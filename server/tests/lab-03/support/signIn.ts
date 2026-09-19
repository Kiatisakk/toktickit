import request from "supertest";

import { app } from "../../../src/app.js";

/**
 * Signing in, the way every server test does it.
 *
 * D-15: tests authenticate through the real endpoint and hold the cookie. There
 * is no test-only bypass anywhere in the repository — a working authentication
 * bypass in shipped code is exactly what §4.3 calls a control that is feedback
 * rather than security, and the repository is read as part of the assessment.
 *
 * This file lives under `tests/lab-03/support/` rather than beside the suites
 * because the Vitest glob only collects files whose name ends in `.test.ts`;
 * a helper without that suffix is left alone.
 */

/** The `Set-Cookie` value a later request should send back. */
export type SessionCookie = string[];

export interface SignedIn {
  cookie: SessionCookie;
  body: unknown;
}

/**
 * Signs in and returns the cookie jar, failing loudly on a refusal.
 *
 * Throwing rather than returning an empty jar matters: a test that silently
 * proceeded unauthenticated would assert a 401 it was not trying to assert, and
 * would read as a passing authorization test.
 */
export const signIn = async (
  email: string,
  password: string
): Promise<SignedIn> => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(
      `Sign-in for ${email} answered ${response.status}, expected 200. Has the seed run?`
    );
  }

  const cookie = response.headers["set-cookie"] as unknown as
    | string[]
    | undefined;

  if (!cookie || cookie.length === 0) {
    throw new Error(`Sign-in for ${email} set no cookie.`);
  }

  return { cookie, body: response.body };
};

export interface SignedInUser {
  id: number;
  cookie: SessionCookie;
}

/** Signs in as a seeded account and returns who the server says that is. */
export const signInAs = async (account: {
  email: string;
  password: string;
}): Promise<SignedInUser> => {
  const { cookie, body } = await signIn(account.email, account.password);
  const id = (body as { user?: { id?: unknown } }).user?.id;

  if (typeof id !== "number") {
    throw new TypeError(`Sign-in for ${account.email} returned no user id.`);
  }

  return { id, cookie };
};

/**
 * Sessions keyed by user id, for the Lab 2 suites.
 *
 * Those suites were written around requester ids — `attach(ticket, ownerB)`,
 * `listing("", ownerB)` — and every assertion in them is phrased that way.
 * Holding a cookie per id lets identity setup move to sign-in while the
 * assertions stay exactly as they were (tests.md, MIG-07).
 *
 * `as` throws for an id nobody signed in as: silently sending no cookie would
 * turn every assertion into an assertion about a 401.
 */
export const sessionJar = () => {
  const jar = new Map<number, SessionCookie>();

  return {
    add: (session: SignedInUser): number => {
      jar.set(session.id, session.cookie);
      return session.id;
    },
    cookieOf: (id: number): SessionCookie => {
      const cookie = jar.get(id);

      if (!cookie) {
        throw new Error(`No session for user ${id}. Sign in as them first.`);
      }

      return cookie;
    },
  };
};
