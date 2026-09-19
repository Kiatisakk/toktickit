import { ApiError, apiGet, apiPost } from "./api";

/**
 * The authentication calls.
 *
 * Every one of them relies on the session cookie, which travels because
 * `send` sets `credentials: "include"` — see the note there. Nothing in this
 * module reads or writes a token: the browser holds it, and it is `HttpOnly`,
 * so this code could not read it even if it wanted to.
 */

export type Role = "REQUESTER" | "IT_STAFF" | "ADMIN";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Identity {
  user: AuthenticatedUser;
  mustChangePassword: boolean;
}

const ROLES: Role[] = ["REQUESTER", "IT_STAFF", "ADMIN"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Narrows a response body to an identity, or throws.
 *
 * The body is untrusted input. Casting it would let a malformed payload travel
 * to every screen wearing a type it does not have — most visibly as a header
 * rendering `undefined` where a name belongs.
 */
export const toIdentity = (body: unknown): Identity => {
  if (!isRecord(body) || !isRecord(body["user"])) {
    throw new ApiError(
      "MALFORMED_RESPONSE",
      "The API returned an unexpected response.",
      0
    );
  }

  const user = body["user"];
  const role = user["role"];

  if (
    typeof user["id"] !== "number" ||
    typeof user["name"] !== "string" ||
    typeof user["email"] !== "string" ||
    typeof role !== "string" ||
    !ROLES.includes(role as Role)
  ) {
    throw new ApiError(
      "MALFORMED_RESPONSE",
      "The API returned an unexpected response.",
      0
    );
  }

  return {
    user: {
      id: user["id"],
      name: user["name"],
      email: user["email"],
      role: role as Role,
    },
    mustChangePassword: body["mustChangePassword"] === true,
  };
};

export const login = async (
  email: string,
  password: string
): Promise<Identity> =>
  toIdentity(await apiPost("/api/auth/login", { email, password }));

/**
 * Reads who is signed in.
 *
 * This is the only identity source in the browser (D-13): nothing is kept in
 * `localStorage`, so there is no stored state that can disagree with the
 * server's. Lab 2 needed an explicit guard against exactly that.
 */
export const currentIdentity = async (
  signal?: AbortSignal
): Promise<Identity> =>
  toIdentity(await apiGet("/api/auth/me", signal ? { signal } : {}));

export const logout = async (): Promise<void> => {
  await apiPost("/api/auth/logout", {});
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await apiPost("/api/auth/password", { currentPassword, newPassword });
};
