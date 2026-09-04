/**
 * The attachment vocabulary shared between the two screens that pick a file:
 * Ticket Detail's `AttachmentSection` and Create Ticket's picker (Issue #40).
 *
 * Every number here mirrors `server/src/attachments/rules.ts` — type
 * allow-list, byte limit, count limit — because a rule a person only meets as
 * a rejection is one they had no way to satisfy (BR-21 to BR-23). The server
 * stays authoritative regardless: this is the courtesy, not the control. It
 * cannot import the server's module directly (client and server are separate
 * npm workspaces with no shared package), so the numbers are restated here.
 * Restating them in two files risked drifting quietly; restating them in
 * three did not seem like an improvement, so this module exists as the one
 * client-side copy and both screens import it rather than each keeping their
 * own.
 */

/** BR-23. */
export const ACTIVE_LIMIT = 5;

/** BR-22. Five megabytes, stated in bytes so the arithmetic is visible. */
export const MAX_BYTES = 5 * 1024 * 1024;

/** BR-21. Each type maps to the extensions it is allowed to arrive under. */
export const PERMITTED_EXTENSIONS = new Map<string, readonly string[]>([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["application/pdf", [".pdf"]],
]);

/** The `accept` attribute both pickers pass to their file input. */
export const ACCEPT = [...PERMITTED_EXTENSIONS.keys()].join(",");

/** How the four permitted types are named on screen. */
export const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

export const typeLabel = (mimeType: string): string =>
  TYPE_LABELS[mimeType] ?? mimeType;

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export type AttachmentValidation = { ok: true } | { ok: false; reason: string };

/**
 * Checks a file the same way `validateUpload` does on the server, before a
 * single byte leaves the browser.
 *
 * Type and extension must agree, for the same reason the server insists on
 * it: a browser derives `file.type` from the extension, so a renamed
 * executable arrives claiming to be a PDF, and requiring the two to agree
 * closes the case where only one was changed. The messages are the server's
 * own wording — a file rejected here and a file rejected after a round trip
 * should read as the same rule, not as two different opinions about it.
 */
export const validateAttachment = (file: File): AttachmentValidation => {
  const extensions = PERMITTED_EXTENSIONS.get(file.type);

  if (!extensions) {
    return {
      ok: false,
      reason:
        "That file type is not accepted. Attach a JPG, PNG, WEBP or PDF file.",
    };
  }

  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";

  if (!extensions.includes(extension)) {
    return {
      ok: false,
      reason:
        "The file's name does not match its type. Attach a JPG, PNG, WEBP or PDF file.",
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      reason: "That file is larger than 5 MB. Attach a smaller file.",
    };
  }

  // Not a rule anyone wrote down, but an empty file is a failed pick rather
  // than an attachment, and sending one to the server helps nobody.
  if (file.size <= 0) {
    return {
      ok: false,
      reason: "That file is empty. Attach a file with contents.",
    };
  }

  return { ok: true };
};

/**
 * A row with no server-side identity: one being sent, or one that was
 * refused before it was.
 *
 * The API has nothing to say about either — an upload in flight has no id,
 * and a rejected file has no row at all — so on Ticket Detail they live
 * beside the real attachment list rather than inside it. They carry the
 * filename the person actually chose, which is the one thing they want to
 * see.
 */
export type PendingRow =
  | { kind: "uploading"; filename: string; sizeBytes: number }
  | { kind: "invalid"; filename: string; reason: string };
