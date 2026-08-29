import { PRIORITIES } from "./domain.js";

/**
 * Validation for ticket creation.
 *
 * Kept apart from the route so the rules can be exercised without HTTP or a
 * database (UNIT-03), and so the limits live in one place rather than being
 * repeated in a handler and a test.
 *
 * Every field is trimmed before it is measured and before it is stored (BR-13,
 * BR-14). A summary of five spaces is not a five-character summary.
 */

export const LIMITS = {
  summary: { min: 5, max: 150 },
  description: { min: 10, max: 5000 },
} as const;

export { PRIORITIES } from "./domain.js";

export type RequestedPriority = (typeof PRIORITIES)[number];

export interface TicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export type ValidationResult =
  | { ok: true; value: TicketInput }
  | { ok: false; details: Record<string, string> };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

/**
 * Validates one text field and returns its trimmed value.
 *
 * Reports at most one message per field. A control can only show one, and
 * "between 5 and 150 characters" already says everything the three separate
 * failures would.
 */
const checkText = (
  raw: unknown,
  label: string,
  { min, max }: { min: number; max: number },
  details: Record<string, string>,
  field: string
): string => {
  if (typeof raw !== "string" || raw.trim() === "") {
    details[field] = `${label} is required.`;
    return "";
  }

  const trimmed = raw.trim();

  if (trimmed.length < min || trimmed.length > max) {
    details[field] = `${label} must be between ${min} and ${max} characters.`;
  }

  return trimmed;
};

const checkId = (
  raw: unknown,
  label: string,
  details: Record<string, string>,
  field: string
): number => {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw <= 0) {
    details[field] = `${label} is required.`;
    return 0;
  }

  return raw;
};

/**
 * Validates a ticket creation body.
 *
 * A `requesterId` in the body is not read at all. Ownership comes from the
 * validated request context and nothing a caller sends can change it (BR-11) —
 * the safest way to honour that is for this function to have no idea the field
 * exists.
 */
export const validateTicketInput = (body: unknown): ValidationResult => {
  const raw = asRecord(body);
  const details: Record<string, string> = {};

  const categoryId = checkId(
    raw["categoryId"],
    "Category",
    details,
    "categoryId"
  );
  const relatedSystemId = checkId(
    raw["relatedSystemId"],
    "Related system",
    details,
    "relatedSystemId"
  );
  const summary = checkText(
    raw["summary"],
    "Summary",
    LIMITS.summary,
    details,
    "summary"
  );
  const description = checkText(
    raw["description"],
    "Description",
    LIMITS.description,
    details,
    "description"
  );

  const priority = raw["requestedPriority"];
  const isPriority = PRIORITIES.includes(priority as RequestedPriority);

  if (!isPriority) {
    details["requestedPriority"] = "Requested priority is required.";
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: {
      categoryId,
      relatedSystemId,
      summary,
      description,
      requestedPriority: priority as RequestedPriority,
    },
  };
};
