import { type FormEvent, useEffect, useState } from "react";

import { ApiError, fetchNotes, type InternalNote, postNote } from "../lib/api";
import { formatWhen } from "../lib/formatWhen";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextArea } from "./TextArea";

/**
 * A ticket's Internal Notes and the composer beneath them (ui-spec.md §6).
 *
 * IT Staff and Administrator only — rendered only when the caller is one of
 * those roles (TicketDetail.tsx), and never rendered, disabled or empty for a
 * Requester (AC-25). The endpoint enforces the same boundary independently
 * (BR-32), so a stray render here is a display bug, not a leak.
 *
 * Visually unmistakable from Public Comments without relying on colour: the
 * heading text, the lock icon and the standing note each say "not visible to
 * the Requester" on their own (ui-spec.md §6). The standing note repeats at
 * the composer, so the restriction is the last thing read before posting.
 *
 * Append-only, like the server (BR-28): there is no edit and no delete
 * control on an entry, because there is no route either would call.
 */

/** Mirrors the server's rule (`tickets/messages.ts`), which is the real control. */
const MESSAGE_LIMIT = 5000;

type Load =
  | { kind: "loading" }
  | { kind: "loaded"; notes: InternalNote[] }
  | { kind: "failed"; message: string };

const bodyProblem = (text: string): string | undefined => {
  if (text.trim() === "") {
    return "Write something before posting.";
  }

  if (text.trim().length > MESSAGE_LIMIT) {
    return `Keep it to ${MESSAGE_LIMIT} characters or fewer.`;
  }

  return undefined;
};

interface InternalNotesProps {
  ticketId: number;
}

export const InternalNotes = ({ ticketId }: InternalNotesProps) => {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: "loading" });

    fetchNotes(ticketId, controller.signal)
      .then((notes) => {
        if (active) {
          setState({ kind: "loaded", notes });
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
              : "The notes could not be loaded.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [ticketId, reloadToken]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Validating mode: refused here, before a request, and said beside the
    // field. The server refuses the same text regardless (AC-26).
    const problem = bodyProblem(text);

    setFieldError(problem);
    setFailure(null);

    if (problem) {
      return;
    }

    setBusy(true);

    try {
      const note = await postNote(ticketId, text);

      // Success: the entry lands at the foot of the list — oldest first, so
      // the newest is last — and the composer clears. As with Public
      // Comments, only a loaded list can take the entry directly; otherwise
      // the list is read again so a posted note never vanishes from the
      // screen.
      if (state.kind === "loaded") {
        setState({ kind: "loaded", notes: [...state.notes, note] });
      } else {
        setReloadToken((token) => token + 1);
      }

      setText("");
    } catch (error) {
      // Failure: the typed text stays exactly where it was (AC-36).
      if (error instanceof ApiError && error.details?.["body"]) {
        setFieldError(error.details["body"]);
      } else {
        setFailure(
          error instanceof Error
            ? error.message
            : "The note could not be posted."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="tkt-internal-notes"
      className="tkt-card tkt-card--notes"
    >
      <h2 className="tkt-section-title" id="tkt-internal-notes">
        <Icon name="lock" />
        Internal Notes
      </h2>
      <p className="tkt-field-hint">Not visible to the Requester</p>

      {state.kind === "loading" ? (
        <p className="tkt-field-hint" data-state="loading">
          Loading notes…
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

      {state.kind === "loaded" && state.notes.length === 0 ? (
        <p className="tkt-field-hint" data-state="empty">
          No notes yet.
        </p>
      ) : null}

      {state.kind === "loaded" && state.notes.length > 0 ? (
        <ol aria-label="Internal notes, oldest first" className="tkt-comments">
          {state.notes.map((note) => (
            <li className="tkt-comment" key={note.id}>
              <p className="tkt-comment__meta">
                <strong>{note.author.name}</strong>
                <Badge kind="role" value={note.author.role} />
                <time dateTime={note.createdAt}>
                  {formatWhen(note.createdAt)}
                </time>
              </p>
              <p className="tkt-comment__body">{note.body}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {/* The composer is usable while the list loads or has failed: what a
          person has to say does not depend on reading what was said before. */}
      <form className="tkt-comment-composer" noValidate onSubmit={onSubmit}>
        <TextArea
          error={fieldError}
          hint={`Up to ${MESSAGE_LIMIT} characters. Not visible to the Requester.`}
          label="Add a note"
          name="note"
          onChange={(event) => {
            setText(event.target.value);

            if (fieldError) {
              setFieldError(undefined);
            }
          }}
          required
          rows={4}
          value={text}
        />

        {failure ? (
          <p className="tkt-callout tkt-callout--error" role="alert">
            {failure}
          </p>
        ) : null}

        <div className="tkt-actions">
          <Button
            busy={busy}
            busyLabel="Posting…"
            type="submit"
            variant="secondary"
          >
            Post Note
          </Button>
        </div>
      </form>
    </section>
  );
};
