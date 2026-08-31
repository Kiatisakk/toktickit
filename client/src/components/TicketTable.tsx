import { Link } from "react-router";

import type { TicketListRow } from "../lib/api";
import { Badge } from "./Badge";

/** The shape is defined and validated in `lib/api`; this is the local name. */
export type TicketRow = TicketListRow;

export type SortField =
  | "ticketNumber"
  | "createdAt"
  | "updatedAt"
  | "summary"
  | "requestedPriority";

interface TicketTableProps {
  tickets: TicketRow[];
  sort: SortField;
  order: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const COLUMNS: {
  field: SortField | null;
  label: string;
  /** The one column allowed to run to a second line. See components.css. */
  wraps?: boolean;
}[] = [
  { field: "ticketNumber", label: "Ticket No." },
  { field: "createdAt", label: "Created Date" },
  { field: "summary", label: "Summary", wraps: true },
  { field: null, label: "Category" },
  { field: "requestedPriority", label: "Requested Priority" },
  { field: null, label: "IT Priority" },
  { field: null, label: "Current Status" },
  { field: null, label: "Ticket Owner" },
  { field: "updatedAt", label: "Last Updated" },
];

/**
 * "Aug 29, 2026 09:14 AM" — the shape the illustrations print.
 *
 * Two calls rather than one because `toLocaleString` puts a comma between the
 * date and the time and offers no option to drop it. The figures have none.
 */
const formatDate = (iso: string) => {
  const value = new Date(iso);

  const date = value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const time = value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${time}`;
};

/**
 * The ticket list, as a table on desktop and as cards below 768px.
 *
 * Both presentations carry the same values. §8.7 allows the two to look
 * different but not for the small one to say less — a column dropped on a phone
 * is information the reader cannot reach at all, since there is no wider view
 * to switch to.
 *
 * Named for tickets rather than as a generic `DataTable`: it has exactly one
 * caller, and a column-definition API written for one consumer is a guess about
 * the second. See ui-spec.md §3.
 */
export const TicketTable = ({
  tickets,
  sort,
  order,
  onSort,
}: TicketTableProps) => {
  const ariaSort = (field: SortField | null) => {
    if (field === null || field !== sort) {
      return undefined;
    }

    return order === "asc" ? ("ascending" as const) : ("descending" as const);
  };

  return (
    <>
      {/*
        Between 768px and 991px the table is still the presentation, and nine
        columns of real data are wider than the viewport. The scroll belongs to
        this container: §8.7 forbids the *page* scrolling sideways, not a table.
        `tabIndex` and the region role are what make a scrollable box reachable
        from the keyboard — without them the columns past the edge can be seen
        with a mouse and not at all otherwise.
      */}
      <div
        aria-label="Your tickets"
        className="tkt-table-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region
        // must be focusable to be scrollable by keyboard.
        tabIndex={0}
      >
        <table className="tkt-table">
          <caption className="tkt-visually-hidden">
            Your tickets, sortable by column
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  aria-sort={ariaSort(column.field)}
                  className={column.wraps ? "tkt-cell-summary" : undefined}
                  key={column.label}
                  scope="col"
                >
                  {column.field ? (
                    <button
                      className="tkt-sort"
                      onClick={() => onSort(column.field as SortField)}
                      type="button"
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {column.field === sort
                          ? order === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ↕"}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link to={`/tickets/${ticket.id}`}>
                    {ticket.ticketNumber}
                  </Link>
                </td>
                <td>{formatDate(ticket.createdAt)}</td>
                <td className="tkt-cell-summary">{ticket.summary}</td>
                <td>{ticket.category.name}</td>
                <td>
                  <Badge kind="priority" value={ticket.requestedPriority} />
                </td>
                <td>
                  <Badge
                    emptyLabel="IT priority not set"
                    kind="priority"
                    value={ticket.itPriority}
                  />
                </td>
                <td>
                  <Badge kind="status" value={ticket.currentStatus} />
                </td>
                <td>
                  {ticket.ticketOwner ? (
                    ticket.ticketOwner.name
                  ) : (
                    <span className="tkt-unset">
                      <span aria-hidden="true">—</span>
                      <span className="tkt-visually-hidden">
                        Not yet assigned to an IT owner
                      </span>
                    </span>
                  )}
                </td>
                <td>{formatDate(ticket.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="tkt-cards">
        {tickets.map((ticket) => (
          <li className="tkt-ticket-card" key={ticket.id}>
            <div className="tkt-ticket-card__head">
              <Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link>
              <Badge kind="status" value={ticket.currentStatus} />
            </div>
            <p className="tkt-ticket-card__summary">{ticket.summary}</p>
            <dl className="tkt-ticket-card__meta">
              <dt>Category</dt>
              <dd>{ticket.category.name}</dd>
              <dt>Related System</dt>
              <dd>{ticket.relatedSystem.name}</dd>
              <dt>Requested Priority</dt>
              <dd>
                <Badge kind="priority" value={ticket.requestedPriority} />
              </dd>
              <dt>IT Priority</dt>
              <dd>
                <Badge
                  emptyLabel="IT priority not set"
                  kind="priority"
                  value={ticket.itPriority}
                />
              </dd>
              <dt>Ticket Owner</dt>
              <dd>
                {ticket.ticketOwner ? (
                  ticket.ticketOwner.name
                ) : (
                  <span className="tkt-unset">
                    <span aria-hidden="true">—</span>
                    <span className="tkt-visually-hidden">
                      Not yet assigned to an IT owner
                    </span>
                  </span>
                )}
              </dd>
              <dt>Created</dt>
              <dd>{formatDate(ticket.createdAt)}</dd>
              <dt>Last Updated</dt>
              <dd>{formatDate(ticket.updatedAt)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
};
