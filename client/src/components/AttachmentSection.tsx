import { useRef, useState } from "react";

import {
  ApiError,
  type AttachmentMetadata,
  downloadAttachment,
  removeAttachment,
  uploadAttachment,
} from "../lib/api";
import {
  ACCEPT,
  ACTIVE_LIMIT,
  formatSize,
  type PendingRow,
  typeLabel,
} from "../lib/attachments";
import { formatWhen } from "../lib/formatWhen";
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
 * §6 defines five row states and this component shipped two of them. The three
 * that were missing — uploading, invalid, unavailable — all describe a row with
 * no server-side identity, or one that has lost the use of it, which is exactly
 * why they were easy to skip: nothing in the API response represents them, so
 * they have to be held here. `PendingRow`, from `lib/attachments`, is that
 * holding — shared with Create Ticket's picker (Issue #40), which needs the
 * same two states for the same reason.
 */

const MIN_REASON = 3;
const MAX_REASON = 500;

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

  const [pending, setPending] = useState<PendingRow | null>(null);
  const [removing, setRemoving] = useState<AttachmentMetadata | null>(null);
  const [removalFailure, setRemovalFailure] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  /** Which attachment failed to download, and why. §6, the unavailable state. */
  const [downloadFailure, setDownloadFailure] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const active = attachments.filter((one) => one.status === "ACTIVE");
  const uploading = pending?.kind === "uploading";
  const full = active.length >= ACTIVE_LIMIT;

  const onFile = async (file: File) => {
    setPending({
      kind: "uploading",
      filename: file.name,
      sizeBytes: file.size,
    });

    try {
      const created = await uploadAttachment(ticketId, file, requesterId);

      onChange([created, ...attachments]);
      setPending(null);
    } catch (error) {
      // The server's message names the rule that was broken — which type, which
      // limit — so it is shown against the file it concerns rather than
      // replaced by a message of our own floating above the list.
      setPending({
        kind: "invalid",
        filename: file.name,
        reason:
          error instanceof ApiError
            ? error.message
            : "The file could not be attached.",
      });
    } finally {
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
    setRemovalFailure(null);

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
      setRemovalFailure(
        error instanceof ApiError
          ? error.message
          : "The attachment could not be removed."
      );
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (attachment: AttachmentMetadata) => {
    setDownloadFailure(null);

    try {
      await downloadAttachment(attachment, requesterId);
    } catch (error) {
      setDownloadFailure({
        id: attachment.id,
        message:
          error instanceof ApiError
            ? error.message
            : "The file could not be downloaded.",
      });
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
            JPG, PNG, WEBP or PDF · up to 5 MB · up to {ACTIVE_LIMIT} files.{" "}
            {full
              ? "Remove one before adding another."
              : `${active.length} of ${ACTIVE_LIMIT} used.`}
          </p>
        </div>

        <div className="tkt-actions">
          {/* The input holds the disabled state and the label sits next to it,
              so the styling follows the real state rather than a second copy of
              it. A label rather than a button firing a click at a hidden input:
              the label already is the control, and it stays keyboard reachable
              without any script. */}
          <input
            accept={ACCEPT}
            className="tkt-file-input"
            disabled={full || uploading}
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
            {uploading ? "Uploading…" : "Add Attachment"}
          </label>
        </div>
      </div>

      {attachments.length === 0 && pending === null ? (
        <p className="tkt-field-hint" data-state="empty">
          No files have been attached to this ticket.
        </p>
      ) : (
        <ul className="tkt-attachments">
          {/* A pending row sits where the file it describes will appear. */}
          {pending?.kind === "uploading" ? (
            <li
              className="tkt-attachment tkt-attachment--uploading"
              data-state="uploading"
            >
              <div className="tkt-attachment__body">
                <p className="tkt-attachment__name">{pending.filename}</p>
                <p className="tkt-attachment__meta">
                  {formatSize(pending.sizeBytes)} · Uploading…
                </p>
                {/* Indeterminate: the request reports no progress, and a bar
                    that invents a percentage is a bar that lies. */}
                <progress aria-label={`Uploading ${pending.filename}`} />
              </div>
              {/* §6: Remove is hidden while a row is uploading — there is
                  nothing on the server yet to remove. */}
            </li>
          ) : null}

          {pending?.kind === "invalid" ? (
            <li
              className="tkt-attachment tkt-attachment--invalid"
              data-state="invalid"
            >
              <div className="tkt-attachment__body">
                <p className="tkt-attachment__name">{pending.filename}</p>
                <p className="tkt-attachment__meta" role="alert">
                  {pending.reason}
                </p>
              </div>
              <div className="tkt-attachment__actions">
                <Button onClick={() => setPending(null)} variant="secondary">
                  Dismiss
                </Button>
              </div>
            </li>
          ) : null}

          {attachments.map((attachment) => {
            const removed = attachment.status === "REMOVED";
            const failed = downloadFailure?.id === attachment.id;

            const className = [
              "tkt-attachment",
              removed ? "tkt-attachment--removed" : "tkt-attachment--active",
              failed ? "tkt-attachment--error" : null,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                className={className}
                data-state={removed ? "removed" : "active"}
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
                    {typeLabel(attachment.mimeType)} ·{" "}
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
                  {failed ? (
                    <p className="tkt-attachment__error" role="alert">
                      {downloadFailure.message}
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
                        {failed ? "Retry download" : "Download"}
                      </Button>
                      <Button
                        onClick={() => {
                          setRemoving(attachment);
                          setReason("");
                          setRemovalFailure(null);
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
        <div aria-label="Confirm removal" className="tkt-confirm" role="group">
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

          {removalFailure ? (
            <p className="tkt-callout tkt-callout--error" role="alert">
              {removalFailure}
            </p>
          ) : null}

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
