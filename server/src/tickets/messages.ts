/**
 * The body of a Public Comment or an Internal Note (BR-30).
 *
 * One rule for both kinds of message, so that the two cannot drift apart — a
 * note held to a looser limit than the comment beside it would be a difference
 * nobody chose.
 *
 * Kept apart from the routes so it can be exercised without HTTP or a database
 * (UNIT-06).
 */

/** The longest body accepted, in characters after trimming. */
export const MESSAGE_LIMIT = 5000;

export type MessageBodyResult =
  | { ok: true; body: string }
  | { ok: false; details: { body: string } };

/**
 * Validates a request body and returns the trimmed text.
 *
 * Only `body` is read. An author or a timestamp in the request is not ignored
 * by a check somewhere — this function has no idea either field exists, and
 * the route takes both from the session and the clock (BR-29).
 *
 * The text is returned as written: markup stays the characters it is, and the
 * interface renders it as text (BR-31). Escaping it here would store a
 * different message from the one that was sent.
 */
export const validateMessageBody = (request: unknown): MessageBodyResult => {
  const raw =
    typeof request === "object" && request !== null
      ? (request as Record<string, unknown>)["body"]
      : undefined;

  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, details: { body: "Write something before posting." } };
  }

  const body = raw.trim();

  if (body.length > MESSAGE_LIMIT) {
    return {
      ok: false,
      details: { body: `Keep it to ${MESSAGE_LIMIT} characters or fewer.` },
    };
  }

  return { ok: true, body };
};
