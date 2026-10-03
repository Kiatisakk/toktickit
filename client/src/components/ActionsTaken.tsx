import { useCallback, useEffect, useState } from "react";

import { fetchActions, type TicketAction } from "../lib/api";
import { TICKET_NOT_ACTIONABLE_MESSAGE } from "../lib/useActionWrite";
import { ActionForm } from "./ActionForm";
import { type ActionRowCommand, ActionsList } from "./ActionsList";
import { ActionStepForm } from "./ActionStepForm";
import { ActionView } from "./ActionView";
import { Button } from "./Button";

/**
 * The Actions Taken area of Ticket Detail (ui-spec.md section 6).
 *
 * The same section serves every role. IT Staff and Administrators get the write
 * controls; a Requester gets the list and each Action's fields, with no write
 * control present at all — absent, not disabled (AC-07). The controls drawn are
 * courtesy: the API enforces who may write and when (BR-04, BR-13, BR-31).
 */

/** The Ticket statuses that take no new Actions (BR-13). */
const CLOSED_FOR_ACTIONS: readonly string[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

type Load =
  | { kind: "loading" }
  | { kind: "loaded"; actions: TicketAction[] }
  | { kind: "failed"; message: string };

type Mode =
  | { kind: "none" }
  | { kind: "create"; session: number }
  | { kind: "view"; id: number }
  | { kind: "edit"; id: number }
  | { kind: "complete"; id: number }
  | { kind: "cancel"; id: number };

/** The server's own order: date/time, then id (FR-03). */
const byServerOrder = (a: TicketAction, b: TicketAction) =>
  new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime() ||
  a.id - b.id;

const upsert = (actions: TicketAction[], saved: TicketAction) =>
  [...actions.filter((one) => one.id !== saved.id), saved].sort(byServerOrder);

interface ActionsTakenProps {
  ticketId: number;
  /** The Ticket's current status, which decides whether Actions can be written. */
  ticketStatus: string;
  /** IT Staff or Administrator: the write controls are drawn only for them. */
  canWrite: boolean;
  /** Re-read the Ticket; resolves to whether that worked. */
  reloadTicket: () => Promise<boolean>;
}

export const ActionsTaken = ({
  ticketId,
  ticketStatus,
  canWrite,
  reloadTicket,
}: ActionsTakenProps) => {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [notice, setNotice] = useState<string | null>(null);
  const [sessions, setSessions] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: "loading" });

    fetchActions(ticketId, controller.signal)
      .then((actions) => {
        if (active) {
          setState({ kind: "loaded", actions });
        }
      })
      .catch((error: unknown) => {
        if (
          !active ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        setState({
          kind: "failed",
          message:
            error instanceof Error
              ? error.message
              : "The actions could not be loaded.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [ticketId, reloadToken]);

  /**
   * Read the list again without the loading state, so an open form stays
   * mounted and keeps what was typed (AC-42). `null` when the read failed.
   */
  const reloadActions = useCallback(async (): Promise<
    TicketAction[] | null
  > => {
    try {
      const actions = await fetchActions(ticketId);

      setState({ kind: "loaded", actions });

      return actions;
    } catch {
      return null;
    }
  }, [ticketId]);

  const onSaved = (saved: TicketAction) => {
    setNotice(null);
    setMode({ kind: "none" });
    setState((current) =>
      current.kind === "loaded"
        ? { kind: "loaded", actions: upsert(current.actions, saved) }
        : current
    );

    // Completing or linking an Action can change another one's follow-up state
    // (BR-09), which only the server derives; ask it rather than guess.
    void reloadActions();
  };

  const onRefused = (message: string) => {
    setNotice(message);
    setMode({ kind: "none" });
  };

  const onCommand = (command: ActionRowCommand, action: TicketAction) => {
    setNotice(null);
    setMode({ kind: command, id: action.id } as Mode);
  };

  const actionable = !CLOSED_FOR_ACTIONS.includes(ticketStatus);
  const writable = canWrite && actionable;

  const actions = state.kind === "loaded" ? state.actions : [];

  // The newest copy of an Action. Handed to the forms as a prop, so a form that
  // is still open after a stale reload sees the reloaded version on its next
  // submit: it re-renders with the new function.
  const latestOf = (id: number) => actions.find((one) => one.id === id);

  const selected =
    mode.kind === "none" || mode.kind === "create"
      ? undefined
      : actions.find((one) => one.id === mode.id);

  const panel = () => {
    if (mode.kind === "create" && writable) {
      return (
        <ActionForm
          actions={actions}
          editing={null}
          key={`create-${mode.session}`}
          latestOf={latestOf}
          onCancel={() => setMode({ kind: "none" })}
          onRefused={onRefused}
          onSaved={onSaved}
          reloadActions={reloadActions}
          reloadTicket={reloadTicket}
          ticketId={ticketId}
        />
      );
    }

    if (!selected) {
      return null;
    }

    const common = {
      latestOf,
      onRefused,
      onSaved,
      reloadActions,
      reloadTicket,
    };

    if (mode.kind === "view") {
      return (
        <ActionView
          action={selected}
          key={`view-${selected.id}`}
          onClose={() => setMode({ kind: "none" })}
        />
      );
    }

    // Not gated on the Action still being Planned: after a stale reload that
    // shows it Done, the form stays up with its text and the server's refusal
    // explains (ACTION_NOT_EDITABLE) rather than the form silently vanishing.
    if (!writable) {
      return null;
    }

    if (mode.kind === "edit") {
      return (
        <ActionForm
          {...common}
          actions={actions}
          editing={selected}
          key={`edit-${selected.id}`}
          onCancel={() => setMode({ kind: "none" })}
          ticketId={ticketId}
        />
      );
    }

    if (mode.kind === "complete" || mode.kind === "cancel") {
      return (
        <ActionStepForm
          {...common}
          action={selected}
          key={`${mode.kind}-${selected.id}`}
          onBack={() => setMode({ kind: "none" })}
          step={mode.kind}
        />
      );
    }

    return null;
  };

  return (
    <section aria-labelledby="tkt-actions-taken" className="tkt-card">
      <div className="tkt-actions-taken__head">
        <h2 className="tkt-section-title" id="tkt-actions-taken">
          Actions Taken
        </h2>
        {writable && mode.kind !== "create" ? (
          <Button
            onClick={() => {
              setNotice(null);
              // A new session is a new Action, and so a new request key
              // (AC-48): the form is keyed by it and mounts afresh.
              setSessions((count) => count + 1);
              setMode({ kind: "create", session: sessions + 1 });
            }}
            variant="primary"
          >
            Add action
          </Button>
        ) : null}
      </div>

      {canWrite ? null : (
        <p className="tkt-field-hint">Work IT has recorded on your ticket.</p>
      )}

      {actionable ? null : (
        <p className="tkt-callout tkt-callout--warning" role="status">
          {TICKET_NOT_ACTIONABLE_MESSAGE}
        </p>
      )}

      {notice && !(notice === TICKET_NOT_ACTIONABLE_MESSAGE && !actionable) ? (
        <p className="tkt-callout tkt-callout--error" role="alert">
          {notice}
        </p>
      ) : null}

      {state.kind === "loading" ? (
        <p className="tkt-field-hint" data-state="loading">
          Loading actions…
        </p>
      ) : null}

      {state.kind === "failed" ? (
        <div className="tkt-callout tkt-callout--error" role="alert">
          <p className="tkt-comment__failure">{state.message}</p>
          <Button onClick={() => setReloadToken((token) => token + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.kind === "loaded" && state.actions.length === 0 ? (
        <p className="tkt-field-hint" data-state="empty">
          No actions have been recorded for this ticket.
        </p>
      ) : null}

      {state.kind === "loaded" && state.actions.length > 0 ? (
        <ActionsList
          actions={state.actions}
          onCommand={onCommand}
          writable={writable}
        />
      ) : null}

      {panel()}
    </section>
  );
};
