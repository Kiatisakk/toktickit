import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import {
  ApiError,
  fetchGateActions,
  type GateActionRow,
  setTicketStatus,
  type TicketDetail,
} from "../lib/api";
import {
  applyRefusal,
  evaluateGate,
  type GateCondition,
  RESOLUTION_SUMMARY_MAX,
} from "../lib/resolutionGate";
import {
  STALE_MESSAGE,
  STALE_RELOAD_FAILED_MESSAGE,
} from "../lib/staleMessages";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextArea } from "./TextArea";

/**
 * The resolve dialog (ui-spec.md section 7, AC-41).
 *
 * Choosing Resolved does not change the status at once: it opens this, with the
 * Resolution Summary box and the four gate conditions as a checklist. The
 * checklist is computed from the Actions loaded when the dialog opened, so the
 * conditions the user can already see are unmet are shown before they submit.
 * It is feedback only. The server decides, and when it refuses with
 * `RESOLUTION_GATE_FAILED` its `details` replace the checklist's state, with
 * each message beside the condition it names (BR-16).
 *
 * A real modal: focus moves in and is trapped, `Escape` closes it, and focus
 * goes back to whatever had it before. Nothing is applied until the server
 * accepts the change, so closing leaves nothing half-done.
 */

interface ResolveDialogProps {
  ticket: TicketDetail;
  onClose: () => void;
  onResolved: (ticket: TicketDetail) => void;
  /** Reload the Ticket after a stale refusal; resolves to whether it loaded. */
  onStale: () => Promise<boolean>;
}

type Load =
  | { kind: "loading" }
  | { kind: "loaded"; actions: GateActionRow[] }
  | { kind: "failed" };

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const countText = (condition: GateCondition): string | null => {
  if (condition.met || condition.count === 0) {
    return null;
  }

  if (condition.key === "openFollowUp") {
    return `${condition.count} open`;
  }

  return condition.key === "plannedActions"
    ? `${condition.count} planned`
    : null;
};

export const ResolveDialog = ({
  ticket,
  onClose,
  onResolved,
  onStale,
}: ResolveDialogProps) => {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Record<string, string> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Focus in on open, and back to whatever had it on close.
  useEffect(() => {
    const opener = document.activeElement;

    dialogRef.current?.focus();

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  // Read the Actions every time the dialog opens, so one completed or cancelled
  // since the screen loaded is reflected (AC-49).
  useEffect(() => {
    const controller = new AbortController();

    fetchGateActions(ticket.id, controller.signal)
      .then((actions) => {
        setLoad({ kind: "loaded", actions });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setLoad({ kind: "failed" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [ticket.id]);

  const computed = evaluateGate(
    load.kind === "loaded" ? load.actions : null,
    summary
  );
  const conditions = refusal ? applyRefusal(computed, refusal) : computed;
  const unchecked = load.kind !== "loaded" && refusal === null;
  const canConfirm = summary.trim() !== "" && !busy;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      return;
    }

    const active = document.activeElement;
    const leavingBackwards =
      event.shiftKey && (active === first || active === dialogRef.current);

    if (leavingBackwards) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const confirm = async () => {
    setBusy(true);
    setFailure(null);

    try {
      const updated = await setTicketStatus(
        ticket.id,
        "RESOLVED",
        ticket.version,
        summary
      );

      onResolved(updated);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "RESOLUTION_GATE_FAILED"
      ) {
        // The server is the authority: its list replaces the one we computed.
        setRefusal(error.details ?? {});
        setFailure(error.message);
      } else if (error instanceof ApiError && error.code === "STALE_UPDATE") {
        // Reload the Ticket behind the dialog, keep what was typed (AC-42).
        const reloaded = await onStale();

        setFailure(reloaded ? STALE_MESSAGE : STALE_RELOAD_FAILED_MESSAGE);
      } else {
        setFailure(
          error instanceof ApiError
            ? error.message
            : "The ticket could not be resolved."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tkt-modal-backdrop">
      <div
        aria-labelledby={headingId}
        aria-modal="true"
        className="tkt-modal tkt-card"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="tkt-modal__title" id={headingId}>
          Resolve ticket {ticket.ticketNumber}
        </h2>

        <TextArea
          error={
            refusal?.["resolutionSummary"] && summary.trim() === ""
              ? refusal["resolutionSummary"]
              : undefined
          }
          hint={`${summary.length} / ${RESOLUTION_SUMMARY_MAX} characters`}
          label="Resolution Summary"
          maxLength={RESOLUTION_SUMMARY_MAX}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
          required
          rows={5}
          value={summary}
        />

        <h3 className="tkt-modal__subtitle">
          Before this ticket can be resolved
        </h3>
        {load.kind === "loading" ? (
          <p className="tkt-field-hint">Checking the ticket&apos;s actions…</p>
        ) : null}
        {load.kind === "failed" && refusal === null ? (
          <p className="tkt-field-hint">
            The ticket&apos;s actions could not be loaded here. The server will
            check them when you confirm.
          </p>
        ) : null}

        <ul aria-label="Conditions for resolving" className="tkt-gate-list">
          {conditions.map((condition) => {
            const message = refusal?.[condition.key];
            const showMessage =
              message !== undefined &&
              (condition.key !== "resolutionSummary" || !condition.met);
            const count = countText(condition);
            const pending = unchecked && condition.key !== "resolutionSummary";

            return (
              <li
                className={
                  condition.met && !pending
                    ? "tkt-gate-item tkt-gate-item--met"
                    : "tkt-gate-item"
                }
                key={condition.key}
              >
                <Icon
                  name={
                    pending ? "pending" : condition.met ? "check" : "warning"
                  }
                />
                <span>
                  {condition.label}
                  {count ? ` — ${count}` : ""}
                </span>
                <span className="tkt-visually-hidden">
                  {pending ? " — not checked yet" : null}
                  {!pending && condition.met ? " — met" : null}
                  {!pending && !condition.met ? " — not met" : null}
                </span>
                {condition.firstActionId !== null && !condition.met ? (
                  <a
                    href={`#action-${condition.firstActionId}`}
                    onClick={onClose}
                  >
                    View the first
                  </a>
                ) : null}
                {showMessage ? (
                  <span className="tkt-gate-item__message">{message}</span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {failure ? (
          <p className="tkt-field-error" role="alert">
            {failure}
          </p>
        ) : null}

        <div className="tkt-actions">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            busy={busy}
            busyLabel="Resolving…"
            disabled={!canConfirm}
            onClick={() => void confirm()}
            variant="primary"
          >
            Confirm resolution
          </Button>
        </div>
      </div>
    </div>
  );
};
