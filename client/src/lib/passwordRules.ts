/**
 * BR-07's password rules, restated for the browser.
 *
 * Every rule here mirrors `server/src/auth/password.ts`, for the same reason
 * `attachments.ts` mirrors the attachment limits: a rule a person only meets as
 * a rejection is one they had no way to satisfy. The server stays authoritative
 * — it re-checks every rule on every request, and BR-17 is explicit that what
 * happens in the interface is feedback rather than a boundary.
 *
 * The client and the server are separate npm workspaces with no shared package,
 * so the rules cannot be imported. They are restated once, here, rather than
 * inside the screen that uses them.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Top-level so they are compiled once rather than on every keystroke of a form
// that re-checks the whole list as the user types.
const HAS_UPPERCASE = /\p{Lu}/u;
const HAS_LOWERCASE = /\p{Ll}/u;
const HAS_DIGIT = /\d/u;
const HAS_SPECIAL = /[^\p{L}\p{N}\p{M}]/u;

export interface PasswordRule {
  id: string;
  label: string;
  satisfiedBy: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    satisfiedBy: (password) =>
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one upper-case letter",
    satisfiedBy: (password) => HAS_UPPERCASE.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lower-case letter",
    satisfiedBy: (password) => HAS_LOWERCASE.test(password),
  },
  {
    id: "digit",
    label: "At least one digit",
    satisfiedBy: (password) => HAS_DIGIT.test(password),
  },
  {
    id: "special",
    label: "At least one special character",
    satisfiedBy: (password) => HAS_SPECIAL.test(password),
  },
];

export const meetsEveryRule = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.satisfiedBy(password));
