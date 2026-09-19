import { firstUnsatisfiedRule } from "../auth/password.js";

/**
 * Validation for the Administrator user endpoints (api-spec.md §9).
 *
 * Pure: no HTTP, no database. The conflict rules — a duplicate address, the
 * caller's own account, the last Administrator — need the database and live in
 * the router; everything that can be decided from the body alone is here, and
 * it runs first, so a request that is both malformed and conflicting is
 * answered as malformed.
 */

export const ROLES = ["REQUESTER", "IT_STAFF", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Limits the contract leaves open (D-18).
 *
 * 254 is the longest address SMTP can carry. 100 characters of name is well past
 * any name the seed or the handout uses, and bounded because an unbounded field
 * is a field someone will fill with a megabyte.
 */
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

/**
 * One `@`, something either side, a dot in the domain, no whitespace.
 *
 * Deliberately loose. A stricter pattern refuses real addresses; the only proof
 * an address works is delivering to it, which §10 excludes.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const USER_FIELDS = new Set(["name", "email", "role", "isActive"]);

export interface UserFields {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; details: Record<string, string> };

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Addresses are stored lower-case (D-18).
 *
 * Sign-in already matches without regard to case (D-17), so two accounts whose
 * addresses differ only by case could never both be signed in to. Storing one
 * form lets the unique index enforce BR-33 as sign-in understands it, rather
 * than as a byte comparison does.
 */
export const normaliseEmail = (email: string): string =>
  email.trim().toLowerCase();

const REQUIRED: Record<keyof UserFields, string> = {
  name: "Enter a name.",
  email: "Enter an email address.",
  role: "Choose a role.",
  isActive: "Choose whether the account is active.",
};

/** Checks each supplied field; `required` lists the ones that must be present. */
const checkFields = (
  body: Record<string, unknown>,
  required: readonly (keyof UserFields)[]
): Validated<Partial<UserFields>> => {
  const details: Record<string, string> = {};
  const value: Partial<UserFields> = {};

  const has = (field: keyof UserFields) => body[field] !== undefined;

  for (const field of required) {
    if (!has(field)) {
      details[field] = REQUIRED[field];
    }
  }

  if (has("name")) {
    const name = typeof body["name"] === "string" ? body["name"].trim() : "";

    if (name === "") {
      details["name"] = "Enter a name.";
    } else if (name.length > NAME_MAX_LENGTH) {
      details["name"] = `A name is at most ${NAME_MAX_LENGTH} characters.`;
    } else {
      value.name = name;
    }
  }

  if (has("email")) {
    const email =
      typeof body["email"] === "string" ? normaliseEmail(body["email"]) : "";

    if (!EMAIL_PATTERN.test(email)) {
      details["email"] = "Enter a valid email address.";
    } else if (email.length > EMAIL_MAX_LENGTH) {
      details["email"] =
        `An email address is at most ${EMAIL_MAX_LENGTH} characters.`;
    } else {
      value.email = email;
    }
  }

  if (has("role")) {
    // §8.5 of the handout names invalid role values as something to prevent,
    // and BR-16 means exactly one: an array is refused like any other non-role.
    if (isRole(body["role"])) {
      value.role = body["role"];
    } else {
      details["role"] = "Choose Requester, IT Staff or Administrator.";
    }
  }

  if (has("isActive")) {
    if (typeof body["isActive"] === "boolean") {
      value.isActive = body["isActive"];
    } else {
      details["isActive"] = "Active must be true or false.";
    }
  }

  return Object.keys(details).length > 0
    ? { ok: false, details }
    : { ok: true, value };
};

/**
 * A starting password, held to BR-07 — the same rules the user will face when
 * they replace it. Issuing one the rules would later refuse is a trap.
 */
export const validateInitialPassword = (raw: unknown): Validated<string> => {
  if (typeof raw !== "string" || raw === "") {
    return {
      ok: false,
      details: { initialPassword: "Enter a starting password." },
    };
  }

  const unsatisfied = firstUnsatisfiedRule(raw);

  return unsatisfied
    ? { ok: false, details: { initialPassword: unsatisfied.message } }
    : { ok: true, value: raw };
};

/** `POST /api/admin/users`. */
export const validateNewUser = (
  raw: unknown
): Validated<UserFields & { initialPassword: string }> => {
  const body = asRecord(raw) ?? {};
  const checked = checkFields(body, ["name", "email", "role", "isActive"]);
  const password = validateInitialPassword(body["initialPassword"]);

  if (!(checked.ok && password.ok)) {
    return {
      ok: false,
      details: {
        ...(checked.ok ? {} : checked.details),
        ...(password.ok ? {} : password.details),
      },
    };
  }

  return {
    ok: true,
    // Every field was required, so every field is present.
    value: {
      ...(checked.value as UserFields),
      initialPassword: password.value,
    },
  };
};

/** `PATCH /api/admin/users/:id` — any non-empty subset of the four fields. */
export const validateUserChanges = (
  raw: unknown
): Validated<Partial<UserFields>> => {
  const body = asRecord(raw);

  if (!body || Object.keys(body).length === 0) {
    return {
      ok: false,
      details: { body: "Change at least one of name, email, role or active." },
    };
  }

  const unknown = Object.keys(body).filter((key) => !USER_FIELDS.has(key));

  if (unknown.length > 0) {
    return {
      ok: false,
      details: Object.fromEntries(
        unknown.map((key) => [key, "This field cannot be changed here."])
      ),
    };
  }

  return checkFields(body, []);
};

/** `GET /api/admin/users` query. */
export const parseUserQuery = (
  query: Record<string, unknown>
): Validated<{ search?: string; role?: Role }> => {
  const details: Record<string, string> = {};
  const value: { search?: string; role?: Role } = {};

  for (const key of Object.keys(query)) {
    if (key !== "search" && key !== "role") {
      details[key] = "This parameter is not recognised.";
    }
  }

  const { search, role } = query;

  // A repeated parameter arrives as an array; it is refused, not guessed at.
  if (search !== undefined) {
    if (typeof search !== "string") {
      details["search"] = "Search must be a single value.";
    } else if (search.trim() !== "") {
      value.search = search.trim();
    }
  }

  if (role !== undefined && role !== "") {
    if (isRole(role)) {
      value.role = role;
    } else {
      details["role"] = "Role must be REQUESTER, IT_STAFF or ADMIN.";
    }
  }

  return Object.keys(details).length > 0
    ? { ok: false, details }
    : { ok: true, value };
};
