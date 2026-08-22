import type { ReactNode } from "react";

export type StateKind = "loading" | "empty" | "no-results" | "error";

interface StateBlockProps {
  kind: StateKind;
  title: string;
  description?: string;
  /** Retry, Clear filters, Create Ticket — whatever moves the user forward. */
  action?: ReactNode;
}

const ICONS: Record<StateKind, string> = {
  loading: "⏳",
  empty: "📭",
  "no-results": "🔍",
  error: "⚠️",
};

/**
 * The four states every data-backed view has to define.
 *
 * `empty` and `no-results` are separate kinds on purpose. BR-35 requires a
 * requester with no tickets at all to look different from a filter that matched
 * nothing — they are different situations and need different wording and a
 * different next action.
 *
 * Loading announces itself politely so that a screen reader user is told the
 * view is working rather than being left with silence.
 */
export const StateBlock = ({
  kind,
  title,
  description,
  action,
}: StateBlockProps) => (
  <div
    aria-live={kind === "loading" ? "polite" : undefined}
    className={`tkt-state tkt-state--${kind}`}
    data-state={kind}
    role={kind === "error" ? "alert" : "status"}
  >
    <span aria-hidden="true" className="tkt-state__icon">
      {ICONS[kind]}
    </span>

    <p className="tkt-state__title">{title}</p>

    {description ? (
      <p className="tkt-state__description">{description}</p>
    ) : null}

    {action}
  </div>
);
