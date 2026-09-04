import type { Response } from "express";

/**
 * One failure shape for the whole API.
 *
 * `code` is stable and machine-readable, `message` is safe to put on a screen,
 * and `details` — present only for field validation — is keyed by field name so
 * a form can place each message beside the control it concerns (§8.3).
 *
 * Nothing here ever carries a stack trace, a database message, a filesystem
 * path or a configuration value (BR-20). See docs/lab-02/api-spec.md §2.
 */

export const ErrorCode = {
  requesterContextRequired: "REQUESTER_CONTEXT_REQUIRED",
  requesterContextInvalid: "REQUESTER_CONTEXT_INVALID",
  requesterContextUnknown: "REQUESTER_CONTEXT_UNKNOWN",
  requesterContextInactive: "REQUESTER_CONTEXT_INACTIVE",
  validationFailed: "VALIDATION_FAILED",
  invalidQueryParameter: "INVALID_QUERY_PARAMETER",
  requestTooLarge: "REQUEST_TOO_LARGE",
  routeNotFound: "ROUTE_NOT_FOUND",
  ticketNotFound: "TICKET_NOT_FOUND",
  attachmentNotFound: "ATTACHMENT_NOT_FOUND",
  attachmentRemoved: "ATTACHMENT_REMOVED",
  attachmentLimitReached: "ATTACHMENT_LIMIT_REACHED",
  fileTooLarge: "FILE_TOO_LARGE",
  unsupportedFileType: "UNSUPPORTED_FILE_TYPE",
  internalError: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCodeValue;
    message: string;
    details?: Record<string, string>;
  };
}

export const sendError = (
  res: Response,
  status: number,
  code: ErrorCodeValue,
  message: string,
  details?: Record<string, string>
): void => {
  const body: ApiErrorBody = { error: { code, message } };

  if (details) {
    body.error.details = details;
  }

  res.status(status).json(body);
};

/**
 * The catch-all for anything unexpected.
 *
 * The real error is logged for whoever is running the server and never sent to
 * the client — a stack trace on a screen tells an attacker about the code and
 * tells the user nothing.
 */
export const sendInternalError = (
  res: Response,
  context: string,
  error: unknown
): void => {
  console.error(context, error);

  sendError(
    res,
    500,
    ErrorCode.internalError,
    "Something went wrong. Please try again."
  );
};
