import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password rules and password hashing.
 *
 * Hashing is the platform's `scrypt` (D-03): memory-hard, in the standard
 * library, and with no native build step to fail on a developer machine. The
 * plaintext never leaves this module — nothing here logs it, returns it, or
 * puts it in an error message (BR-06).
 */

// promisify picks the three-argument overload, which drops the cost
// parameters. The assertion restores the four-argument signature; the
// alternative is hand-rolling a Promise around a callback, which this codebase
// avoids everywhere else.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

/** BR-07. The upper bound is a denial-of-service guard, not a usability one. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * scrypt cost parameters.
 *
 * N = 16384, r = 8, p = 1 is the widely published interactive-login setting and
 * needs 128 * N * r = 16 MB per hash. `maxmem` is raised to 32 MB explicitly:
 * Node's default is exactly 32 MB, so the call sits on the boundary, and a
 * default that moves would turn every sign-in into a 500.
 */
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** The prefix that identifies this encoding, so a future change can be told apart. */
const ENCODING_ID = "scrypt";
const ENCODED_FIELD_COUNT = 6;

// Top-level so they are compiled once rather than per keystroke on a form that
// re-validates as the user types.
const HAS_UPPERCASE = /\p{Lu}/u;
const HAS_LOWERCASE = /\p{Ll}/u;
const HAS_DIGIT = /\d/u;
// "Special" is defined as anything that is not a letter, a digit or a mark.
// Enumerating punctuation instead would quietly refuse a password containing a
// character the list forgot, and the user would have no way to know which.
const HAS_SPECIAL = /[^\p{L}\p{N}\p{M}]/u;

/** The rules, in the order the interface lists them (ui-spec.md). */
export const PASSWORD_RULES = [
  {
    id: "length",
    label: `Between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    satisfiedBy: (password: string): boolean =>
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one upper-case letter",
    satisfiedBy: (password: string): boolean => HAS_UPPERCASE.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lower-case letter",
    satisfiedBy: (password: string): boolean => HAS_LOWERCASE.test(password),
  },
  {
    id: "digit",
    label: "At least one digit",
    satisfiedBy: (password: string): boolean => HAS_DIGIT.test(password),
  },
  {
    id: "special",
    label: "At least one special character",
    satisfiedBy: (password: string): boolean => HAS_SPECIAL.test(password),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

/**
 * Names the first rule the password fails, or null when it satisfies them all.
 *
 * The message names the rule rather than echoing any part of the password
 * (api-spec.md §4). Returning the first failure rather than all of them keeps
 * the API's `details.newPassword` a single string, which is the shape the error
 * envelope defines; the interface shows the full checklist as the user types,
 * so nothing is hidden by that choice.
 */
export const firstUnsatisfiedRule = (
  password: string
): { id: PasswordRuleId; message: string } | null => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.satisfiedBy(password)) {
      return { id: rule.id, message: rule.label };
    }
  }

  return null;
};

/**
 * Hashes a password for storage.
 *
 * The salt is random per password, and the parameters are stored alongside the
 * hash so that raising the cost later does not invalidate existing rows.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);

  const derived = await scryptAsync(password, salt, KEY_BYTES, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return [
    ENCODING_ID,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
};

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing for a stored value this module did not
 * write. A malformed row is a corrupt record, and the caller's only correct
 * response either way is to refuse the sign-in.
 *
 * The comparison is `timingSafeEqual`, so the answer takes the same time
 * whether the first byte differs or only the last one does.
 */
export const verifyPassword = async (
  password: string,
  stored: string
): Promise<boolean> => {
  const parts = stored.split("$");

  if (parts.length !== ENCODED_FIELD_COUNT || parts[0] !== ENCODING_ID) {
    return false;
  }

  const [, costRaw, blockSizeRaw, parallelismRaw, saltRaw, expectedRaw] = parts;

  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelism = Number(parallelismRaw);

  if (
    !(
      Number.isSafeInteger(cost) &&
      Number.isSafeInteger(blockSize) &&
      Number.isSafeInteger(parallelism)
    )
  ) {
    return false;
  }

  const expected = Buffer.from(expectedRaw ?? "", "base64");

  if (expected.length === 0) {
    return false;
  }

  let derived: Buffer;

  try {
    derived = await scryptAsync(
      password,
      Buffer.from(saltRaw ?? "", "base64"),
      expected.length,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
        maxmem: SCRYPT_MAX_MEMORY,
      }
    );
  } catch {
    // Parameters this build of Node will not accept — a row written by a
    // different configuration. Refuse rather than crash the sign-in route.
    return false;
  }

  return timingSafeEqual(derived, expected);
};
