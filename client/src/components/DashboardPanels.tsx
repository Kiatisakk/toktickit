import type { ReactNode } from "react";
import { Link } from "react-router";

import type { QuickAction, RecentTicket } from "../lib/api";
import { drillDownTo } from "../lib/dashboard";
import { formatWhen } from "../lib/formatWhen";
import { Badge } from "./Badge";
import { Icon, type IconName } from "./Icon";

/**
 * My Recent Tickets and Quick Actions, the two panels both dashboards end with
 * (ui-spec.md sections 3 and 4). Only their wording differs by role.
 */

/** Up to five rows, each linking to its Ticket (BR-26). */
export const RecentTickets = ({
  tickets,
  viewAll,
  emptyMessage,
  emptyAction,
}: {
  tickets: readonly RecentTicket[];
  viewAll: { label: string; to: ReturnType<typeof drillDownTo> };
  emptyMessage: string;
  /** Shown beneath the empty message, e.g. a prominent Create Ticket. */
  emptyAction?: ReactNode;
}) => (
  <section aria-labelledby="recent-heading" className="tkt-card tkt-recent">
    <div className="tkt-recent__header">
      <h2 className="tkt-section-title" id="recent-heading">
        My Recent Tickets
      </h2>
      <Link className="tkt-recent__viewall" to={viewAll.to}>
        {viewAll.label}
      </Link>
    </div>

    {tickets.length === 0 ? (
      <div className="tkt-recent__empty">
        <p>{emptyMessage}</p>
        {emptyAction}
      </div>
    ) : (
      <ul className="tkt-recent__list">
        {tickets.map((ticket) => (
          <li className="tkt-recent__row" key={ticket.id}>
            <Link className="tkt-recent__number" to={`/tickets/${ticket.id}`}>
              {ticket.ticketNumber}
            </Link>
            <span className="tkt-recent__summary">{ticket.summary}</span>
            <Badge kind="status" value={ticket.currentStatus} />
            <time className="tkt-recent__when" dateTime={ticket.updatedAt}>
              {formatWhen(ticket.updatedAt)}
            </time>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const ACTION_ICONS: Record<string, IconName> = {
  "create-ticket": "create",
  "search-tickets": "search",
  "my-queue": "queue",
  "my-tickets": "ticket",
};

const ACTION_HINTS: Record<string, string> = {
  "create-ticket": "Submit a new request",
  "my-tickets": "Track existing requests",
};

export const QuickActions = ({
  actions,
}: {
  actions: readonly QuickAction[];
}) => (
  <section aria-labelledby="quick-heading" className="tkt-card tkt-quick">
    <h2 className="tkt-section-title" id="quick-heading">
      Quick Actions
    </h2>
    <ul className="tkt-quick__list">
      {actions.map((action) => {
        const hint = ACTION_HINTS[action.key];

        return (
          <li key={action.key}>
            <Link className="tkt-quick__tile" to={drillDownTo(action)}>
              <Icon name={ACTION_ICONS[action.key] ?? "ticket"} />
              <span className="tkt-quick__label">{action.label}</span>
              {hint ? <span className="tkt-quick__hint">{hint}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  </section>
);
