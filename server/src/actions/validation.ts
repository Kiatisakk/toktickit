/**
 * Request validation for the Action Taken endpoints (BR-05 to BR-08, BR-14,
 * BR-19, BR-35).
 *
 * Pure functions with no HTTP and no database, so the bounds can be exercised
 * at their edges (UNIT-04, UNIT-07, UNIT-09). Everything that needs a stored
 * row — is the performer eligible, is the `followsUpId` on this Ticket — is
 * checked by the route, inside the transaction that writes.
 *
 * Bodies are strict (api-spec.md §1): a field an endpoint does not accept is
 * refused with the field named, never silently dropped, so a forged
 * `recordedById` or `state` is a `400` and not a no-op.
 */

export const DESCRIPTION_LIMIT = 2000;
export const RESULT_LIMIT = 2000;
export const FOLLOW_UP_NOTE_LIMIT = 1000;
export const ATTACHMENT_NOTES_LIMIT = 1000;
export const CANCEL_REASON_LIMIT = 500;

/** How far ahead of the server clock an action time may be (BR-14). */
export const FUTURE_TOLERANCE_MS = 60_000;

export type Details = Record<string, string>;

export type Parsed<T> =
  | { ok: true; value: T }
  | { ok: false; details: Details };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** An ISO 8601 instant that names its offset, so it means one moment. */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/* ------------------------------------------------------ single fields -- */

export const validateRequestId = (raw: unknown): Parsed<string> =>
  typeof raw === "string" && UUID_PATTERN.test(raw)
    ? { ok: true, value: raw.toLowerCase() }
    : {
        ok: false,
        details: { requestId: "Send the request key as a UUID." },
      };

/** BR-19: a positive integer, or `400 VALIDATION_FAILED` naming `version`. */
export const validateVersion = (raw: unknown): Parsed<number> =>
  isPositiveInteger(raw)
    ? { ok: true, value: raw }
    : {
        ok: false,
        details: { version: "Send the version you read, as a whole number." },
      };

type Field<T> = { ok: true; value: T } | { ok: false; why: string };

/** Text of 1 to `limit` characters after trimming. */
const requiredText =
  (label: string, limit: number) =>
  (raw: unknown): Field<string> => {
    if (typeof raw !== "string" || raw.trim() === "") {
      return { ok: false, why: `Enter ${label}.` };
    }

    const value = raw.trim();

    return value.length > limit
      ? { ok: false, why: `Keep ${label} to ${limit} characters or fewer.` }
      : { ok: true, value };
  };

/** Text that may be null; when given it is 1 to `limit` characters. */
const optionalText =
  (label: string, limit: number) =>
  (raw: unknown): Field<string | null> => {
    if (raw === null) {
      return { ok: true, value: null };
    }

    return requiredText(label, limit)(raw);
  };

const readDescription = requiredText("a description", DESCRIPTION_LIMIT);
const readResult = optionalText("the result", RESULT_LIMIT);
const readFollowUpNote = optionalText(
  "the follow-up note",
  FOLLOW_UP_NOTE_LIMIT
);

/** Attachment notes may be blank, which is stored as null. */
const readAttachmentNotes = (raw: unknown): Field<string | null> => {
  if (raw === null) {
    return { ok: true, value: null };
  }

  if (typeof raw !== "string") {
    return { ok: false, why: "Attachment notes must be text." };
  }

  const value = raw.trim();

  if (value.length > ATTACHMENT_NOTES_LIMIT) {
    return {
      ok: false,
      why: `Keep attachment notes to ${ATTACHMENT_NOTES_LIMIT} characters or fewer.`,
    };
  }

  return { ok: true, value: value === "" ? null : value };
};

const readFlag = (raw: unknown): Field<boolean> =>
  typeof raw === "boolean"
    ? { ok: true, value: raw }
    : { ok: false, why: "Send true or false." };

const readPerformer = (raw: unknown): Field<number> =>
  isPositiveInteger(raw)
    ? { ok: true, value: raw }
    : { ok: false, why: "Choose who performed the action." };

const readFollowsUp = (raw: unknown): Field<number | null> => {
  if (raw === null) {
    return { ok: true, value: null };
  }

  return isPositiveInteger(raw)
    ? { ok: true, value: raw }
    : { ok: false, why: "Choose an earlier action, or leave it empty." };
};

const readActionAt =
  (now: Date) =>
  (raw: unknown): Field<Date> => {
    if (typeof raw !== "string" || !INSTANT_PATTERN.test(raw)) {
      return {
        ok: false,
        why: "Enter the date and time as an ISO 8601 instant, such as 2026-10-05T03:15:00Z.",
      };
    }

    const value = new Date(raw);

    if (Number.isNaN(value.getTime())) {
      return { ok: false, why: "That is not a real date and time." };
    }

    return value.getTime() > now.getTime() + FUTURE_TOLERANCE_MS
      ? { ok: false, why: "The action time cannot be in the future." }
      : { ok: true, value };
  };

/* --------------------------------------------------------- the bodies -- */

/**
 * Reads the named fields of a body with one reader each, collecting every
 * refusal rather than stopping at the first, and refusing any other key.
 */
const readFields = (
  body: Record<string, unknown>,
  readers: Record<string, (raw: unknown) => Field<unknown>>
): { values: Record<string, unknown>; details: Details } => {
  const values: Record<string, unknown> = {};
  const details: Details = {};

  for (const key of Object.keys(body)) {
    const read = readers[key];

    if (!read) {
      details[key] = "This field is not accepted here.";
      continue;
    }

    const field = read(body[key]);

    if (field.ok) {
      values[key] = field.value;
    } else {
      details[key] = field.why;
    }
  }

  return { values, details };
};

const notAnObject: Details = { body: "Send a JSON object." };

const NOTE_REQUIRED = "Enter the follow-up note.";
const NOTE_NOT_ALLOWED = "Only an action that needs follow-up has a note.";

export interface CreateActionInput {
  requestId: string;
  description: string;
  /** Null when the client left it out: the server clock is used. */
  actionAt: Date | null;
  result: string | null;
  /** Null when left out: the caller performed it. */
  performedById: number | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  followsUpId: number | null;
}

/** `POST /api/tickets/:id/actions` (api-spec.md §4). */
export const validateCreateAction = (
  body: unknown,
  now: Date
): Parsed<CreateActionInput> => {
  if (!isPlainObject(body)) {
    return { ok: false, details: notAnObject };
  }

  const { values, details } = readFields(body, {
    requestId: (raw) => {
      const parsed = validateRequestId(raw);

      return parsed.ok
        ? parsed
        : { ok: false, why: parsed.details["requestId"] ?? "" };
    },
    description: readDescription,
    actionAt: readActionAt(now),
    result: readResult,
    performedById: readPerformer,
    followUpRequired: readFlag,
    followUpNote: readFollowUpNote,
    attachmentNotes: readAttachmentNotes,
    followsUpId: readFollowsUp,
  });

  // Absent is as much a failure as malformed for these two.
  if (!("requestId" in body)) {
    details["requestId"] = "Send the request key as a UUID.";
  }

  if (!("description" in body)) {
    details["description"] = "Enter a description.";
  }

  const followUpRequired =
    (values["followUpRequired"] as boolean | undefined) ?? false;
  const followUpNote =
    (values["followUpNote"] as string | null | undefined) ?? null;

  if (!("followUpNote" in details)) {
    if (followUpRequired && followUpNote === null) {
      details["followUpNote"] = NOTE_REQUIRED;
    } else if (!followUpRequired && followUpNote !== null) {
      details["followUpNote"] = NOTE_NOT_ALLOWED;
    }
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: {
      requestId: values["requestId"] as string,
      description: values["description"] as string,
      actionAt: (values["actionAt"] as Date | undefined) ?? null,
      result: (values["result"] as string | null | undefined) ?? null,
      performedById: (values["performedById"] as number | undefined) ?? null,
      followUpRequired,
      followUpNote,
      attachmentNotes:
        (values["attachmentNotes"] as string | null | undefined) ?? null,
      followsUpId: (values["followsUpId"] as number | null | undefined) ?? null,
    },
  };
};

/** The fields a `PATCH` may change; each is present only if it was sent. */
export interface ActionChanges {
  actionAt?: Date;
  description?: string;
  result?: string | null;
  performedById?: number;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

export interface EditActionInput {
  version: number;
  changes: ActionChanges;
}

const EDITABLE = [
  "actionAt",
  "description",
  "result",
  "performedById",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
] as const;

/** `PATCH /api/actions/:id`. Same bounds as creation (api-spec.md §4). */
export const validateEditAction = (
  body: unknown,
  now: Date
): Parsed<EditActionInput> => {
  if (!isPlainObject(body)) {
    return { ok: false, details: notAnObject };
  }

  const { version: rawVersion, ...rest } = body;
  const version = validateVersion(rawVersion);

  const { values, details } = readFields(rest, {
    actionAt: readActionAt(now),
    description: readDescription,
    result: readResult,
    performedById: readPerformer,
    followUpRequired: readFlag,
    followUpNote: readFollowUpNote,
    attachmentNotes: readAttachmentNotes,
  });

  if (!version.ok) {
    Object.assign(details, version.details);
  }

  if (
    Object.keys(details).length === 0 &&
    !EDITABLE.some((key) => key in values)
  ) {
    details["body"] = "Change at least one field.";
  }

  if (Object.keys(details).length > 0 || !version.ok) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: { version: version.value, changes: values as ActionChanges },
  };
};

/**
 * Follow-Up Required and Follow-Up Note after an edit (BR-08).
 *
 * Clearing the flag without mentioning the note clears the note with it,
 * because the alternative — refusing until the client also sends `null` —
 * makes every client remember a rule the server already knows. Sending a
 * non-null note while the flag is, or becomes, false is still refused.
 */
export const mergeFollowUp = (
  stored: { required: boolean; note: string | null },
  change: { required?: boolean; note?: string | null }
):
  | { ok: true; required: boolean; note: string | null }
  | { ok: false; details: Details } => {
  const required = change.required ?? stored.required;

  const keptNote = required ? stored.note : null;
  const note = change.note === undefined ? keptNote : change.note;

  if (required && note === null) {
    return { ok: false, details: { followUpNote: NOTE_REQUIRED } };
  }

  if (!required && note !== null) {
    return { ok: false, details: { followUpNote: NOTE_NOT_ALLOWED } };
  }

  return { ok: true, required, note };
};

export interface CompleteInput {
  version: number;
  /** Replaces the stored result when given. */
  result: string | null;
}

/** `POST /api/actions/:id/complete`. */
export const validateComplete = (body: unknown): Parsed<CompleteInput> => {
  if (!isPlainObject(body)) {
    return { ok: false, details: notAnObject };
  }

  const { version: rawVersion, ...rest } = body;
  const version = validateVersion(rawVersion);
  const { values, details } = readFields(rest, {
    result: requiredText("the result", RESULT_LIMIT),
  });

  if (!version.ok) {
    Object.assign(details, version.details);
  }

  if (Object.keys(details).length > 0 || !version.ok) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: {
      version: version.value,
      result: (values["result"] as string | undefined) ?? null,
    },
  };
};

export interface CancelInput {
  version: number;
  cancelReason: string;
}

/** `POST /api/actions/:id/cancel`. */
export const validateCancel = (body: unknown): Parsed<CancelInput> => {
  if (!isPlainObject(body)) {
    return { ok: false, details: notAnObject };
  }

  const { version: rawVersion, ...rest } = body;
  const version = validateVersion(rawVersion);
  const { values, details } = readFields(rest, {
    cancelReason: requiredText("a reason", CANCEL_REASON_LIMIT),
  });

  if (!version.ok) {
    Object.assign(details, version.details);
  }

  if (!("cancelReason" in body)) {
    details["cancelReason"] = "Enter a reason for cancelling.";
  }

  if (Object.keys(details).length > 0 || !version.ok) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: {
      version: version.value,
      cancelReason: values["cancelReason"] as string,
    },
  };
};
