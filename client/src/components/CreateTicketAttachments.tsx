import { useRef } from "react";

import {
  ACCEPT,
  ACTIVE_LIMIT,
  formatSize,
  typeLabel,
} from "../lib/attachments";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * One row in the Create Ticket picker's list (`ui-spec.md` §5.2 and §6,
 * Issue #40).
 *
 * Three kinds rather than `AttachmentSection`'s two, because this screen holds
 * more than one file before any of them has been sent anywhere. "queued" is
 * the row §6's table has no name for: it is neither in flight nor rejected,
 * and "active" already means something else — a row with a server-issued id,
 * which nothing here has until the ticket itself exists. Each row carries its
 * own `id`, a token this component invents, so the list has a stable React key
 * before any row does.
 */
export type QueuedAttachmentRow =
  | { id: string; kind: "queued"; file: File }
  | { id: string; kind: "uploading"; filename: string; sizeBytes: number }
  | {
      id: string;
      kind: "invalid";
      filename: string;
      sizeBytes: number;
      reason: string;
    };

interface CreateTicketAttachmentsProps {
  rows: QueuedAttachmentRow[];
  /** True once the ticket itself is being submitted — nothing here can change mid-submit. */
  disabled: boolean;
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
}

/**
 * The attachment picker on Create Ticket.
 *
 * A file chosen here is validated on the spot (`lib/attachments`, mirroring
 * `server/src/attachments/rules.ts`) and, if it passes, held in memory rather
 * than sent — there is no ticket id yet for `POST /api/tickets/:id/attachments`
 * to target. The files travel up through `onAdd`/`onRemove` and are actually
 * uploaded by `CreateTicket`'s submit handler, one at a time, once the ticket
 * itself has been created.
 */
export const CreateTicketAttachments = ({
  rows,
  disabled,
  onAdd,
  onRemove,
}: CreateTicketAttachmentsProps) => {
  const fileInput = useRef<HTMLInputElement>(null);

  // Invalid rows never count toward the limit — they were never going to be
  // sent, so they should not cost the person one of their five slots.
  const queuedCount = rows.filter((row) => row.kind !== "invalid").length;
  const full = queuedCount >= ACTIVE_LIMIT;

  return (
    // Not `tkt-card`: this section sits inside the same card as the rest of
    // the form (ui-spec.md §5.2 reads Create Ticket as one flowing screen,
    // unlike Ticket Detail's separate attachment card), and a card nested in
    // a card doubles the border and padding on every edge.
    <section
      aria-labelledby="tkt-create-attachments"
      className="tkt-inline-section"
    >
      <div className="tkt-list-header">
        <div>
          <h2 className="tkt-section-title" id="tkt-create-attachments">
            Attachments
          </h2>
          <p className="tkt-field-hint">
            JPG, PNG, WEBP or PDF · up to 5 MB · up to {ACTIVE_LIMIT} files.{" "}
            {full
              ? "Remove one before adding another."
              : `${queuedCount} of ${ACTIVE_LIMIT} selected.`}
          </p>
        </div>

        <div className="tkt-actions">
          {/* Same shape as AttachmentSection's control: the input holds the
              disabled state, the label sits next to it and stays keyboard
              reachable without any script. */}
          <input
            accept={ACCEPT}
            className="tkt-file-input"
            disabled={full || disabled}
            id="tkt-create-attachment-file"
            onChange={(event) => {
              const [file] = event.target.files ?? [];

              if (file) {
                onAdd(file);
              }

              if (fileInput.current) {
                // Without this, choosing the same file twice (once
                // dismissed as invalid, once meant for real) fires no
                // change event on the retry.
                fileInput.current.value = "";
              }
            }}
            ref={fileInput}
            type="file"
          />
          <label
            className="tkt-btn tkt-btn--secondary"
            htmlFor="tkt-create-attachment-file"
          >
            <Icon name="create" />
            Add Attachment
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="tkt-field-hint" data-state="empty">
          No files selected. Attachments are optional here and can also be added
          from the ticket afterwards.
        </p>
      ) : (
        <ul className="tkt-attachments">
          {rows.map((row) => {
            if (row.kind === "invalid") {
              return (
                <li
                  className="tkt-attachment tkt-attachment--invalid"
                  data-state="invalid"
                  key={row.id}
                >
                  <div className="tkt-attachment__body">
                    <p className="tkt-attachment__name">{row.filename}</p>
                    <p className="tkt-attachment__meta" role="alert">
                      {row.reason}
                    </p>
                  </div>
                  <div className="tkt-attachment__actions">
                    <Button
                      onClick={() => onRemove(row.id)}
                      variant="secondary"
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              );
            }

            if (row.kind === "uploading") {
              return (
                <li
                  className="tkt-attachment tkt-attachment--uploading"
                  data-state="uploading"
                  key={row.id}
                >
                  <div className="tkt-attachment__body">
                    <p className="tkt-attachment__name">{row.filename}</p>
                    <p className="tkt-attachment__meta">
                      {formatSize(row.sizeBytes)} · Uploading…
                    </p>
                    {/* Indeterminate, as on Ticket Detail: the request
                        reports no progress, and a bar that invents a
                        percentage is a bar that lies. */}
                    <progress aria-label={`Uploading ${row.filename}`} />
                  </div>
                </li>
              );
            }

            // "queued": chosen, validated, waiting for the ticket to exist.
            return (
              <li className="tkt-attachment" data-state="queued" key={row.id}>
                <div className="tkt-attachment__body">
                  <p className="tkt-attachment__name">{row.file.name}</p>
                  <p className="tkt-attachment__meta">
                    {typeLabel(row.file.type)} · {formatSize(row.file.size)}
                  </p>
                </div>
                <div className="tkt-attachment__actions">
                  <Button
                    disabled={disabled}
                    onClick={() => onRemove(row.id)}
                    variant="secondary"
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
