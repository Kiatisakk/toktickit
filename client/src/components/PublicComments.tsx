import { type FormEvent, useEffect, useState } from "react";

import {
  ApiError,
  fetchComments,
  postComment,
  type PublicComment,
} from "../lib/api";
import { formatWhen } from "../lib/formatWhen";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { TextArea } from "./TextArea";

/**
 * A ticket's Public Comments and the composer beneath them (ui-spec.md §6, §7).
 *
 * Append-only, like the server (BR-28): there is no edit and no delete control
 * on an entry, because there is no route either would call.
 *
 * Every body is rendered as a React text child, never as markup (BR-31). That
 * is the whole of the defence and it is enough — nothing here reaches for
 * `dangerouslySetInnerHTML`, and a comment reading `<b>` shows the three
 * characters.
 *
 * Deliberately no Internal Notes here, not even a disabled one. Notes are a
 * separate component with a separate endpoint (D-09), and a Requester's screen
 * never renders it (AC-25).
 */

/** Mirrors the server's rule (`tickets/messages.ts`), which is the real control. */
const MESSAGE_LIMIT = 5000;

type Load =
  | { kind: "loading" }
  | { kind: "loaded"; comments: PublicComment[] }
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

interface PublicCommentsProps {
  ticketId: number;
}

export const PublicComments = ({ ticketId }: PublicCommentsProps) => {
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

    fetchComments(ticketId, controller.signal)
      .then((comments) => {
        if (active) {
          setState({ kind: "loaded", comments });
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
              : "The comments could not be loaded.",
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
      const comment = await postComment(ticketId, text);

      // Success: the entry lands at the foot of the list — oldest first, so
      // the newest is last — and the composer clears.
      //
      // Only a loaded list can take the entry directly. While the list is still
      // loading, or after it failed, there is nothing to append to — and
      // clearing the composer then would make a posted comment vanish from the
      // screen (review of PR #63). So the list is read again instead: the read
      // in flight is abandoned, and the fresh one includes the new comment.
      if (state.kind === "loaded") {
        setState({ kind: "loaded", comments: [...state.comments, comment] });
      } else {
        setReloadToken((token) => token + 1);
      }

      setText("");
    } catch (error) {
      // Failure: the typed text stays exactly where it was. Losing a paragraph
      // to a dropped connection is the failure this mode exists to prevent.
      if (error instanceof ApiError && error.details?.["body"]) {
        setFieldError(error.details["body"]);
      } else {
        setFailure(
          error instanceof Error
            ? error.message
            : "The comment could not be posted."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="tkt-public-comments" className="tkt-card">
      <h2 className="tkt-section-title" id="tkt-public-comments">
        Public Comments
      </h2>
      <p className="tkt-field-hint">Visible to the Requester</p>

      {state.kind === "loading" ? (
        <p className="tkt-field-hint" data-state="loading">
          Loading comments…
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

      {state.kind === "loaded" && state.comments.length === 0 ? (
        <p className="tkt-field-hint" data-state="empty">
          No comments yet.
        </p>
      ) : null}

      {state.kind === "loaded" && state.comments.length > 0 ? (
        <ol aria-label="Public comments, oldest first" className="tkt-comments">
          {state.comments.map((comment) => (
            <li className="tkt-comment" key={comment.id}>
              <p className="tkt-comment__meta">
                <strong>{comment.author.name}</strong>
                <Badge kind="role" value={comment.author.role} />
                <time dateTime={comment.createdAt}>
                  {formatWhen(comment.createdAt)}
                </time>
              </p>
              <p className="tkt-comment__body">{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {/* The composer is usable while the list loads or has failed: what a
          person has to say does not depend on reading what was said before. */}
      <form className="tkt-comment-composer" noValidate onSubmit={onSubmit}>
        <TextArea
          error={fieldError}
          hint={`Up to ${MESSAGE_LIMIT} characters.`}
          label="Add a comment"
          name="comment"
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
            variant="primary"
          >
            Post Comment
          </Button>
        </div>
      </form>
    </section>
  );
};
