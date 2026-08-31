import { useRef, useState } from "react";

import {
  ApiError,
  type AttachmentMetadata,
  downloadAttachment,
  removeAttachment,
  uploadAttachment,
} from "../lib/api";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextArea } from "./TextArea";

/**
 * The attachment lifecycle on one ticket (`ui-spec.md` §6).
 *
 * Every rule the server enforces is stated here *before* a file is chosen —
 * types, size, count — because a rule a person only meets as a rejection is one
 * they had no way to satisfy. The server still enforces all of it: this is the
 * courtesy, not the control (BR-21 to BR-23).
 *
 * Removed attachments keep their metadata and lose their Download. That is the
 * visible half of soft removal, and the thing Part 8 asks to see: the record of
 * what was attached survives, the bytes do not.
 */

const LIMIT = 5;
const MIN_REASON = 3;
const MAX_REASON = 500;

const formatSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatWhen = (iso: string) => {
  const value = new Date(iso);

  return `${value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} ${value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

interface AttachmentSectionProps {
  ticketId: number;
  requesterId: number;
  attachments: AttachmentMetadata[];
  onChange: (attachments: AttachmentMetadata[]) => void;
}

export const AttachmentSection = ({
  ticketId,
  requesterId,
  attachments,
  onChange,
}: AttachmentSectionProps) => {
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AttachmentMetadata | null>(null);
  const [reason, setReason] = useState("");

  const active = attachments.filter((one) => one.status === "ACTIVE");
  const full = active.length >= LIMIT;

  const onFile = async (file: File) => {
    setBusy(true);
    setFailure(null);

    try {
      const created = await uploadAttachment(ticketId, file, requesterId);

      onChange([created, ...attachments]);
    } catch (error) {
      // The server's message names the rule that was broken — which type, which
      // limit — so it is shown rather than replaced with one of our own.
      setFailure(
        error instanceof ApiError
          ? error.message
          : "The file could not be attached."
      );
    } finally {
      setBusy(false);

      if (fileInput.current) {
        // Without this, choosing the same file twice fires no change event and
        // a retry after a failure looks like nothing happened.
        fileInput.current.value = "";
      }
    }
  };

  const onRemove = async () => {
    if (!removing) {
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      const removed = await removeAttachment(
        removing.id,
        reason.trim(),
        requesterId
      );

      onChange(
        attachments.map((one) => (one.id === removed.id ? removed : one))
      );
      setRemoving(null);
      setReason("");
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.message
          : "The attachment could not be removed."
      );
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (attachment: AttachmentMetadata) => {
    setFailure(null);

    try {
      await downloadAttachment(attachment, requesterId);
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.message
          : "The file could not be downloaded."
      );
    }
  };

  const reasonUsable =
    reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;

  return (
    <section aria-labelledby="tkt-attachments" className="tkt-card">
      <div className="tkt-list-header">
        <div>
          <h2 className="tkt-section-title" id="tkt-attachments">
            Attachments
          </h2>
          <p className="tkt-field-hint">
            JPG, PNG, WEBP or PDF · up to 5 MB · up to {LIMIT} files.{" "}
            {full
              ? "Remove one before adding another."
              : `${active.length} of ${LIMIT} used.`}
          </p>
        </div>

        <div className="tkt-actions">
          {/* The input holds the disabled state and the label sits next to
              it, so the styling follows the real state rather than a second
              copy of it. A label rather than a button firing a click at a
              hidden input: the label already is the control, and it stays
              keyboard reachable without any script. */}
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="tkt-file-input"
            disabled={full || busy}
            id="tkt-attachment-file"
            onChange={(event) => {
              const [file] = event.target.files ?? [];

              if (file) {
                void onFile(file);
              }
            }}
            ref={fileInput}
            type="file"
          />
          <label
            className="tkt-btn tkt-btn--primary"
            htmlFor="tkt-attachment-file"
          >
            <Icon name="create" />
            {busy ? "Working…" : "Add Attachment"}
          </label>
        </div>
      </div>

      {failure ? (
        <p className="tkt-callout tkt-callout--error" role="alert">
          {failure}
        </p>
      ) : null}

      {attachments.length === 0 ? (
        <p className="tkt-field-hint" data-state="empty">
          No files have been attached to this ticket.
        </p>
      ) : (
        <ul className="tkt-attachments">
          {attachments.map((attachment) => {
            const removed = attachment.status === "REMOVED";

            return (
              <li
                className={
                  removed
                    ? "tkt-attachment tkt-attachment--removed"
                    : "tkt-attachment tkt-attachment--active"
                }
                key={attachment.id}
              >
                <div className="tkt-attachment__body">
                  {/* Wraps rather than truncates: §8.7 forbids unreadable
                      attachment names, and an ellipsis in the middle of a
                      filename is unreadable. */}
                  <p className="tkt-attachment__name">
                    {attachment.originalFilename}
                  </p>
                  <p className="tkt-attachment__meta">
                    {formatSize(attachment.sizeBytes)} ·{" "}
                    {formatWhen(attachment.uploadedAt)} ·{" "}
                    {attachment.uploadedBy.name}
                  </p>
                  {removed ? (
                    <p className="tkt-attachment__meta">
                      Removed{" "}
                      {attachment.removedAt
                        ? formatWhen(attachment.removedAt)
                        : ""}
                      {attachment.removedReason
                        ? ` — ${attachment.removedReason}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="tkt-attachment__actions">
                  <Badge
                    kind="attachment"
                    value={removed ? "REMOVED" : "ACTIVE"}
                  />
                  {/* No Download on a removed attachment, and none is offered
                      anywhere else either: the server refuses the URL as well
                      (BR-28). */}
                  {removed ? null : (
                    <>
                      <Button
                        onClick={() => void onDownload(attachment)}
                        variant="secondary"
                      >
                        Download
                      </Button>
                      <Button
                        onClick={() => {
                          setRemoving(attachment);
                          setReason("");
                          setFailure(null);
                        }}
                        variant="secondary"
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removing ? (
        <div className="tkt-confirm" role="group" aria-label="Confirm removal">
          <p className="tkt-confirm__title">
            Remove <strong>{removing.originalFilename}</strong>?
          </p>
          <p className="tkt-field-hint">
            The file stops being downloadable. Its name, size and this reason
            stay on the ticket.
          </p>

          <TextArea
            hint={`${MIN_REASON}–${MAX_REASON} characters.`}
            label="Reason for removing"
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />

          <div className="tkt-actions">
            <Button
              disabled={busy}
              onClick={() => {
                setRemoving(null);
                setReason("");
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            {/* Disabled until the reason satisfies the rule, so the rule is met
                before the request rather than reported after it. */}
            <Button
              busy={busy}
              busyLabel="Removing…"
              disabled={!reasonUsable}
              onClick={() => void onRemove()}
              variant="danger"
            >
              Remove Attachment
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
