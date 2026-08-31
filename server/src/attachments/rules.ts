import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * The attachment rules from §4.5, as a module.
 *
 * Pure: no database, no request, no filesystem. Every one of these is a rule a
 * person could state in a sentence, and keeping them here means each can be
 * exercised without constructing a multipart upload — which is the difference
 * between a rule that is tested once and a rule that is tested properly.
 *
 * The route's job is to call these in the right order and translate the result
 * into a status code. Nothing here knows what a status code is.
 */

/** BR-21. Each type maps to the extensions it is allowed to arrive under. */
export const PERMITTED = new Map<string, readonly string[]>([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["application/pdf", [".pdf"]],
]);

/** BR-22. Five megabytes, stated in bytes so the arithmetic is visible. */
export const MAX_BYTES = 5 * 1024 * 1024;

/** BR-23. Counted over rows whose `removedAt` is null. */
export const ACTIVE_LIMIT = 5;

const MIN_REASON = 3;
const MAX_REASON = 500;

export type UploadFailureCode = "UNSUPPORTED_FILE_TYPE" | "FILE_TOO_LARGE";

export type Validated<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: UploadFailureCode | "VALIDATION_FAILED";
      message: string;
    };

interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Checks a file before a single byte is written.
 *
 * Type and extension must agree. Neither is trustworthy on its own — a browser
 * derives Content-Type from the extension, so a renamed executable arrives
 * claiming to be a PDF — but requiring the two to agree costs nothing and closes
 * the case where only one was changed.
 */
export const validateUpload = (file: IncomingFile): Validated<IncomingFile> => {
  const extensions = PERMITTED.get(file.mimetype);

  if (!extensions) {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE_TYPE",
      message:
        "That file type is not accepted. Attach a JPG, PNG, WEBP or PDF file.",
    };
  }

  if (!extensions.includes(path.extname(file.originalname).toLowerCase())) {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE_TYPE",
      message:
        "The file's name does not match its type. Attach a JPG, PNG, WEBP or PDF file.",
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "That file is larger than 5 MB. Attach a smaller file.",
    };
  }

  // Not a rule anyone wrote down, but an empty file is a failed pick rather
  // than an attachment, and storing one helps nobody.
  if (file.size <= 0) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "That file is empty. Attach a file with contents.",
    };
  }

  return { ok: true, value: file };
};

/**
 * The name the file takes on disk (BR-24).
 *
 * A generated identifier plus the extension, and nothing of what was uploaded.
 * The uploaded name is displayed and stored as metadata; it never becomes part
 * of a path, so it can never contain one. `path.extname` on `../../etc/passwd`
 * returns nothing useful, and the fallback below keeps even that out.
 */
export const storedNameFor = (originalFilename: string): string => {
  const extension = path.extname(originalFilename).toLowerCase();
  const safe = /^\.[a-z0-9]{1,8}$/u.test(extension) ? extension : "";

  return `${randomUUID()}${safe}`;
};

/**
 * The download header (BR-25, D-08).
 *
 * `attachment` unconditionally, for images as much as for PDFs: serving
 * uploaded content inline from our own origin is how an upload becomes script
 * execution, and the choice not to have that conversation per type is the whole
 * point.
 *
 * Quotes and control characters are stripped, because a filename is user input
 * and this is a header — left alone, an uploader writes their own.
 */
export const contentDispositionFor = (originalFilename: string): string => {
  const stripped = originalFilename
    // The character that closes the quoted string early, and the one that
    // escapes it.
    .replaceAll(/["\\]/gu, "")
    // Control characters, CR and LF among them. A newline here is header
    // injection: everything past it is read as a header of its own.
    .replaceAll(/\p{Cc}/gu, "")
    .trim();

  const safe = stripped || "attachment";

  /*
   * Two parameters, per RFC 6266.
   *
   * A header is Latin-1. "รายงานแบตเตอรี่.pdf" written into `filename=`
   * alone reaches the browser mangled and saves under a corrupted name, which
   * matters here rather more than usually: this is a Thai university, and a
   * requester attaching evidence is likely to name it in Thai.
   *
   * `filename` keeps an ASCII fallback for anything that reads only that;
   * `filename*` carries the real name, percent-encoded, and every current
   * browser prefers it.
   */
  const ascii = safe.replaceAll(/[^\u0020-\u007E]/gu, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

/** BR-27. Required, 3–500 characters once trimmed. */
export const validateRemovalReason = (raw?: unknown): Validated<string> => {
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "A reason for removing the attachment is required.",
    };
  }

  const reason = raw.trim();

  if (reason.length < MIN_REASON || reason.length > MAX_REASON) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: `The reason must be between ${MIN_REASON} and ${MAX_REASON} characters.`,
    };
  }

  return { ok: true, value: reason };
};
