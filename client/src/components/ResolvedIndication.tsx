import { useState } from "react";

import { ApiError, fetchTicket, indicateResolved } from "../lib/api";
import { formatWhen } from "../lib/formatWhen";
import { Button } from "./Button";

/**
 * "The problem appears resolved" (ui-spec.md §7, FR-18).
 *
 * A fact about the ticket, not a status, so it is never drawn as a status badge
 * (ui-spec.md §6) and never offers a status (BR-05). IT decide whether the
 * ticket is resolved; this tells them the Requester thinks it might be.
 *
 * Confirmed before it fires, because it cannot be taken back: the server sets
 * it once (BR-27), and a mis-click would put a claim in front of IT that the
 * Requester never meant to make.
 */

interface ResolvedIndicationProps {
  ticketId: number;
  /** When it was indicated, or null. */
  indicatedAt: string | null;
  /**
   * Whether the signed-in user may indicate — only the Requester who raised the
   * ticket. Staff and Administrators are refused by the server even on their
   * own tickets, so they are shown the fact and never the button.
   */
  canIndicate: boolean;
  onRecorded: (indicatedAt: string) => void;
}

export const ResolvedIndication = ({
  ticketId,
  indicatedAt,
  canIndicate,
  onRecorded,
}: ResolvedIndicationProps) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (indicatedAt) {
    return (
      <section
        aria-labelledby="tkt-resolved-indication"
        className="tkt-card tkt-resolved-indication"
        data-state="recorded"
      >
        <h2 className="tkt-section-title" id="tkt-resolved-indication">
          Problem appears resolved
        </h2>
        <p className="tkt-resolved-indication__statement">
          {canIndicate ? "You told IT" : "The requester told IT"} the problem
          appears resolved on{" "}
          <time dateTime={indicatedAt}>{formatWhen(indicatedAt)}</time>. IT will
          decide whether to resolve the ticket.
        </p>
      </section>
    );
  }

  if (!canIndicate) {
    return null;
  }

  const onConfirm = async () => {
    setBusy(true);
    setFailure(null);

    try {
      await indicateResolved(ticketId);
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.message
          : "The indication could not be recorded."
      );
      setBusy(false);
      return;
    }

    // The endpoint answers 204, so the time it recorded is read back with the
    // ticket. If that read fails the indication still happened — say so with
    // this device's clock rather than reporting a success as a failure.
    let recordedAt = new Date().toISOString();

    try {
      recordedAt =
        (await fetchTicket(ticketId)).resolvedIndicatedAt ?? recordedAt;
    } catch {
      // Keep the local time. See above.
    }

    setBusy(false);
    setConfirming(false);
    onRecorded(recordedAt);
  };

  return (
    <section
      aria-labelledby="tkt-resolved-indication"
      className="tkt-card tkt-resolved-indication"
      data-state="available"
    >
      <h2 className="tkt-section-title" id="tkt-resolved-indication">
        Problem appears resolved
      </h2>
      <p className="tkt-field-hint">
        If the problem has stopped, let IT know. They decide whether the ticket
        is resolved.
      </p>

      {confirming ? (
        <div
          aria-label="Confirm the problem appears resolved"
          className="tkt-confirm tkt-confirm--neutral"
          role="group"
        >
          <p className="tkt-confirm__title">
            Tell IT the problem appears resolved?
          </p>
          <p className="tkt-field-hint">
            This cannot be undone. The ticket's status does not change.
          </p>

          {failure ? (
            <p className="tkt-callout tkt-callout--error" role="alert">
              {failure}
            </p>
          ) : null}

          <div className="tkt-actions">
            <Button
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setFailure(null);
              }}
            >
              Cancel
            </Button>
            <Button
              busy={busy}
              busyLabel="Recording…"
              onClick={() => void onConfirm()}
              variant="primary"
            >
              Yes, tell IT
            </Button>
          </div>
        </div>
      ) : (
        <div className="tkt-actions">
          <Button onClick={() => setConfirming(true)}>
            Problem appears resolved
          </Button>
        </div>
      )}
    </section>
  );
};
