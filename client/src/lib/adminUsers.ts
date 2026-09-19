import { ApiError, apiGet, apiPatch, apiPost } from "./api";

/**
 * The Administrator user endpoints (api-spec.md §9).
 *
 * Kept apart from `api.ts` because nothing else in the client touches them, and
 * the screen that does is the only place their shapes need to be known.
 */

export const ROLES = ["REQUESTER", "IT_STAFF", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface UserFields {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

/**
 * Checks the five fields the list promises, and nothing that could be a
 * credential. A response carrying more than it should is not narrowed away
 * silently — it is simply never read past these five.
 */
const isManagedUser = (value: unknown): value is ManagedUser =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>)["id"] === "number" &&
  typeof (value as Record<string, unknown>)["name"] === "string" &&
  typeof (value as Record<string, unknown>)["email"] === "string" &&
  isRole((value as Record<string, unknown>)["role"]) &&
  typeof (value as Record<string, unknown>)["isActive"] === "boolean";

const unexpected = (what: string) =>
  new ApiError(
    "UNEXPECTED_RESPONSE",
    `The TokTickIT API returned ${what} in an unexpected format.`,
    0
  );

const toUser = ({ id, name, email, role, isActive }: ManagedUser) => ({
  id,
  name,
  email,
  role,
  isActive,
});

export const fetchUsers = async (
  query: { search?: string; role?: Role },
  signal?: AbortSignal
): Promise<ManagedUser[]> => {
  const params = new URLSearchParams();

  if (query.search && query.search.trim() !== "") {
    params.set("search", query.search.trim());
  }

  if (query.role) {
    params.set("role", query.role);
  }

  const suffix = params.toString();
  const body = await apiGet(
    `/api/admin/users${suffix ? `?${suffix}` : ""}`,
    signal ? { signal } : {}
  );

  if (!(Array.isArray(body) && body.every(isManagedUser))) {
    throw unexpected("the user list");
  }

  return body.map(toUser);
};

export const createUser = async (
  fields: UserFields & { initialPassword: string }
): Promise<ManagedUser> => {
  const body = await apiPost("/api/admin/users", fields);

  if (!isManagedUser(body)) {
    throw unexpected("the new user");
  }

  return toUser(body);
};

export const updateUser = async (
  id: number,
  changes: Partial<UserFields>
): Promise<ManagedUser> => {
  const body = await apiPatch(`/api/admin/users/${id}`, changes);

  if (!isManagedUser(body)) {
    throw unexpected("the updated user");
  }

  return toUser(body);
};

export const setInitialPassword = async (
  id: number,
  initialPassword: string
): Promise<void> => {
  await apiPost(`/api/admin/users/${id}/password`, { initialPassword });
};
