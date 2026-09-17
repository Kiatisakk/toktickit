import { useEffect, useState } from "react";

import { useAuth } from "../context/useAuth";
import {
  ApiError,
  fetchStaffOwners,
  type Priority,
  type ReferenceItem,
  setItPriority,
  setTicketOwner,
  setTicketStatus,
  type TicketDetail,
} from "../lib/api";
import {
  permittedTargets,
  STATUS_LABELS,
  type TicketStatus,
} from "../lib/ticketStatus";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Select } from "./Select";

/**
 * The three fields IT Staff may change on a ticket (ui-spec.md §6).
 *
 * They sit in the same grid cells the read-only fields occupy for a Requester,
 * rather than in a separate panel: §6 says the ticket's information stays
 * grouped and read-only and only the operational fields become editable, which
 * is a description of one screen with three live fields in it, not of two
 * screens.
 *
 * Every change is one request, applied on its own. There is no Save: a status
 * change and a reassignment are separate acts, and batching them would invent a
 * transaction the API does not offer.
 *
 * The response to each carries the whole ticket, so the screen refreshes from
 * what the server actually stored — never from what the control hoped it would
 * store.
 */

interface ControlProps {
  ticket: TicketDetail;
  onUpdated: (ticket: TicketDetail) => void;
}

/** What a failed change says, and how a busy one looks. */
const useChange = (onUpdated: (ticket: TicketDetail) => void) => {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (change: () => Promise<TicketDetail>) => {
    setBusy(true);
    setFailure(null);

    try {
      onUpdated(await change());
    } catch (error) {
      // The server's own message: it is the one that knows why. A refused
      // transition and an ineligible owner read differently, and both are
      // written for a person (api-spec.md §2).
      setFailure(
        error instanceof ApiError
          ? error.message
          : "The change could not be saved."
      );
    } finally {
      setBusy(false);
    }
  };

  return { busy, failure, run };
};

const Failure = ({ message }: { message: string | null }) =>
  message ? (
    <p className="tkt-field-error" role="alert">
      {message}
    </p>
  ) : null;

/**
 * Claim, reassign or release (AC-17, AC-18).
 *
 * Unowned tickets get a primary Claim, because taking work is the common act
 * and naming yourself in a dropdown to do it is a worse way to say it. An owned
 * ticket presents the eligible owners and a Release beside them.
 */
export const OwnerControl = ({ ticket, onUpdated }: ControlProps) => {
  const { user } = useAuth();
  const { busy, failure, run } = useChange(onUpdated);
  const [owners, setOwners] = useState<ReferenceItem[]>([]);
  const [ownersFailed, setOwnersFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchStaffOwners(controller.signal)
      .then((items) => {
        setOwners(items);
        setOwnersFailed(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOwners([]);
          setOwnersFailed(true);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const owner = ticket.ticketOwner;

  return (
    <div className="tkt-field-group">
      {owner ? (
        <>
          <Select
            disabled={busy || ownersFailed}
            error={failure ?? undefined}
            hint={
              ownersFailed
                ? "The list of owners could not be loaded."
                : undefined
            }
            label="Ticket Owner"
            onChange={(event) =>
              void run(() =>
                setTicketOwner(ticket.id, Number(event.target.value))
              )
            }
            options={owners.map((one) => ({
              value: String(one.id),
              label: one.name,
            }))}
            value={String(owner.id)}
          />
          <div className="tkt-actions">
            <Button
              busy={busy}
              busyLabel="Saving…"
              onClick={() => void run(() => setTicketOwner(ticket.id, null))}
            >
              Release
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className="tkt-field-label">Ticket Owner</span>
          <p className="tkt-unassigned">Unassigned</p>
          <div className="tkt-actions">
            <Button
              busy={busy}
              busyLabel="Claiming…"
              disabled={!user}
              onClick={() =>
                void run(() => setTicketOwner(ticket.id, user?.id ?? 0))
              }
              variant="primary"
            >
              Claim
            </Button>
          </div>
        </>
      )}
      <Failure message={failure} />
    </div>
  );
};

/** IT's own view of urgency. The Requester's is read-only beside it (AC-19). */
export const ItPriorityControl = ({ ticket, onUpdated }: ControlProps) => {
  const { busy, failure, run } = useChange(onUpdated);

  return (
    <div className="tkt-field-group">
      <Select
        disabled={busy}
        error={failure ?? undefined}
        label="IT Priority"
        onChange={(event) => {
          const value = event.target.value;

          void run(() =>
            setItPriority(ticket.id, value === "" ? null : (value as Priority))
          );
        }}
        options={[
          { value: "", label: "Not set" },
          { value: "LOW", label: "Low" },
          { value: "MEDIUM", label: "Medium" },
          { value: "HIGH", label: "High" },
        ]}
        value={ticket.itPriority ?? ""}
      />
    </div>
  );
};

/**
 * Move the ticket along its lifecycle (AC-20, AC-21).
 *
 * The control offers exactly the permitted targets and nothing else, so a
 * refusal is not something a staff member can walk into by choosing from a
 * list. A cancelled ticket has no targets at all, and shows the status
 * read-only with a note — not an empty dropdown, which reads as a failed load
 * (ui-spec.md §6).
 */
export const StatusControl = ({ ticket, onUpdated }: ControlProps) => {
  const { busy, failure, run } = useChange(onUpdated);
  const status = ticket.currentStatus as TicketStatus;
  const targets = permittedTargets(status);

  if (targets.length === 0) {
    return (
      <div className="tkt-field-group">
        <span className="tkt-field-label">Current Status</span>
        <div className="tkt-readonly-badge">
          <Badge kind="status" value={ticket.currentStatus} />
        </div>
        <p className="tkt-field-hint">
          A cancelled ticket is closed for good and cannot be moved again.
        </p>
        <Failure message={failure} />
      </div>
    );
  }

  return (
    <div className="tkt-field-group">
      <Select
        disabled={busy}
        error={failure ?? undefined}
        hint={`Now ${STATUS_LABELS[status] ?? ticket.currentStatus}.`}
        label="Current Status"
        onChange={(event) => {
          const next = event.target.value;

          if (next !== "") {
            void run(() => setTicketStatus(ticket.id, next as TicketStatus));
          }
        }}
        options={[
          { value: "", label: "Move to…" },
          ...targets.map((target) => ({
            value: target,
            label: STATUS_LABELS[target],
          })),
        ]}
        value=""
      />
    </div>
  );
};
