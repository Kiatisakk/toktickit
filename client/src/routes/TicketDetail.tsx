import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AppShell } from "../components/AppShell";
import { AttachmentSection } from "../components/AttachmentSection";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import { useRequester } from "../context/useRequester";
import {
  ApiError,
  type AttachmentMetadata,
  fetchTicket,
  type TicketDetail as Detail,
} from "../lib/api";
import { formatWhen } from "../lib/formatWhen";

/**
 * The Requester Ticket Detail screen (§8.5).
 *
 * Read-only, in the layout Figure 1 draws: identification and classification
 * across two rows of four, then the owner beside a wide Summary, then
 * Description and Resolution Summary at full width, then attachments.
 *
 * The three fields Lab 2 never populates — IT Priority, Ticket Owner,
 * Resolution Summary — are present and say why they are empty. §4.2 excludes the
 * work that fills them, not the fact that they exist; a missing field would tell
 * a requester nothing, where an empty one tells them nobody has triaged this
 * yet (D-04).
 *
 * There is no tab strip. Figure 1 shows four — Public Comments, Attachments,
 * Service Actions, Event Log — and §4.2 excludes the features behind three of
 * them. Drawing them disabled would advertise a screen this lab must not build.
 */

type Load =
  | { kind: "loading" }
  | { kind: "loaded"; ticket: Detail }
  | { kind: "missing" }
  | { kind: "failed"; message: string };

export const TicketDetail = () => {
  const { ticketId } = useParams();
  const { requester, generation } = useRequester();
  const navigate = useNavigate();

  const [state, setState] = useState<Load>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    (signal: AbortSignal) => {
      const id = Number(ticketId);

      if (!requester) {
        return;
      }

      // A path that is not a number never reaches the API. It cannot be a
      // ticket, and asking would only produce the same answer more slowly.
      if (!/^\d+$/u.test(ticketId ?? "") || !Number.isSafeInteger(id)) {
        setState({ kind: "missing" });
        return;
      }

      setState({ kind: "loading" });

      fetchTicket(id, requester.id, signal)
        .then((ticket) => setState({ kind: "loaded", ticket }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          // The API answers a stranger's ticket exactly as a missing one, so
          // this screen cannot tell them apart either — and must not try.
          if (error instanceof ApiError && error.status === 404) {
            setState({ kind: "missing" });
            return;
          }

          setState({
            kind: "failed",
            message:
              error instanceof Error
                ? error.message
                : "The ticket could not be loaded.",
          });
        });
    },
    [ticketId, requester]
  );

  // `generation` is here so that changing requester re-asks. Without it, one
  // person's ticket stays on screen under another person's name — and this is
  // the screen where that matters most, because the URL survives the switch.
  useEffect(() => {
    const controller = new AbortController();

    // oxlint-disable-next-line react/set-state-in-effect
    load(controller.signal);

    return () => {
      controller.abort();
    };
  }, [load, generation, reloadToken]);

  const onAttachmentsChange = (attachments: AttachmentMetadata[]) => {
    setState((current) =>
      current.kind === "loaded"
        ? { kind: "loaded", ticket: { ...current.ticket, attachments } }
        : current
    );
  };

  const crumbs = [
    { label: "My Tickets", to: "/my-tickets" },
    { label: "Ticket Details" },
  ];

  if (state.kind === "loading") {
    return (
      <AppShell breadcrumbs={crumbs}>
        <StateBlock
          description="Fetching the ticket."
          kind="loading"
          title="Loading…"
        />
      </AppShell>
    );
  }

  if (state.kind === "missing") {
    return (
      <AppShell breadcrumbs={crumbs}>
        <StateBlock
          action={
            <Button
              onClick={() => void navigate("/my-tickets")}
              variant="primary"
            >
              Back to My Tickets
            </Button>
          }
          description="This ticket does not exist, or it belongs to another requester."
          kind="empty"
          title="Ticket not found"
        />
      </AppShell>
    );
  }

  if (state.kind === "failed") {
    return (
      <AppShell breadcrumbs={crumbs}>
        <StateBlock
          action={
            <Button
              onClick={() => setReloadToken((token) => token + 1)}
              variant="primary"
            >
              Try again
            </Button>
          }
          description={state.message}
          kind="error"
          title="Could not load the ticket"
        />
      </AppShell>
    );
  }

  const { ticket } = state;

  return (
    <AppShell breadcrumbs={crumbs}>
      <div className="tkt-list-header">
        <div>
          <h1 className="tkt-page-title">{ticket.ticketNumber}</h1>
          <p className="tkt-page-subtitle">{ticket.summary}</p>
        </div>
        <div className="tkt-actions">
          <Button
            onClick={() => void navigate("/my-tickets")}
            variant="secondary"
          >
            Back to My Tickets
          </Button>
        </div>
      </div>

      <div className="tkt-card">
        <div className="tkt-grid tkt-grid--4">
          <TextInput label="Ticket No." readOnly value={ticket.ticketNumber} />
          <TextInput
            label="Ticket Date"
            readOnly
            value={formatWhen(ticket.createdAt)}
          />
          <TextInput label="Category" readOnly value={ticket.category.name} />
          <TextInput
            label="Related System"
            readOnly
            value={ticket.relatedSystem.name}
          />

          <TextInput label="Requester" readOnly value={ticket.requester.name} />
          <div className="tkt-field-group">
            <span className="tkt-field-label">Requested Priority</span>
            <div className="tkt-readonly-badge">
              <Badge kind="priority" value={ticket.requestedPriority} />
            </div>
          </div>
          <div className="tkt-field-group">
            <span className="tkt-field-label">IT Priority</span>
            <div className="tkt-readonly-badge">
              <Badge
                emptyLabel="Not set until IT triages this ticket"
                kind="priority"
                value={ticket.itPriority}
              />
            </div>
          </div>
          <div className="tkt-field-group">
            <span className="tkt-field-label">Current Status</span>
            <div className="tkt-readonly-badge">
              <Badge kind="status" value={ticket.currentStatus} />
            </div>
          </div>

          <TextInput
            label="Ticket Owner"
            readOnly
            value={ticket.ticketOwner?.name ?? "Not yet assigned"}
          />
          <div className="tkt-span-3">
            <TextInput label="Summary" readOnly value={ticket.summary} />
          </div>

          <div className="tkt-span-4">
            <label className="tkt-field-label" htmlFor="tkt-detail-description">
              Description
            </label>
            {/* A block rather than a textarea: it is prose to read, not a
                control, and a read-only textarea invites a click that does
                nothing and scrolls text that should simply be there. */}
            <p className="tkt-readonly-block" id="tkt-detail-description">
              {ticket.description}
            </p>
          </div>

          <div className="tkt-span-4">
            <label className="tkt-field-label" htmlFor="tkt-detail-resolution">
              Resolution Summary
            </label>
            <p
              className={
                ticket.resolutionSummary
                  ? "tkt-readonly-block"
                  : "tkt-readonly-block tkt-readonly-block--empty"
              }
              id="tkt-detail-resolution"
            >
              {ticket.resolutionSummary ??
                "No resolution summary available yet."}
            </p>
          </div>
        </div>
      </div>

      {requester ? (
        <AttachmentSection
          attachments={ticket.attachments}
          onChange={onAttachmentsChange}
          requesterId={requester.id}
          ticketId={ticket.id}
        />
      ) : null}
    </AppShell>
  );
};
