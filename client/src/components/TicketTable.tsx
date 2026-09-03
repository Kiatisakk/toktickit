import { useId } from "react";
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
 * The columns a reader can actually sort by, derived from `COLUMNS` rather
 * than listed again — so the mobile sort control below can never end up
 * offering a field the desktop headers do not, or missing one they do.
 */
const SORTABLE_COLUMNS = COLUMNS.filter(
  (column): column is { field: SortField; label: string; wraps?: boolean } =>
    column.field !== null
);

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
  // A column with no `field` is not sortable at all, so it carries no
  // `aria-sort` — the attribute would claim a capability the header does not
  // have. A sortable column that is not the current sort still gets an
  // explicit "none" rather than nothing: WAI-ARIA's own definition of
  // `aria-sort` treats "not present" and "none" as different states, and a
  // screen reader user can only tell a column is sortable at all from the
  // attribute existing on it.
  const ariaSort = (field: SortField | null) => {
    if (field === null) {
      return undefined;
    }

    if (field !== sort) {
      return "none" as const;
    }

    return order === "asc" ? ("ascending" as const) : ("descending" as const);
  };

  const sortFieldId = useId();

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
        // `role="region"` is what makes `aria-label` mean anything here. A
        // bare `<div>` has no implicit role, and `aria-label` is only ever
        // surfaced as an accessible name on an element that has one — without
        // it the label is inert, present in the DOM and announced by nobody.
        role="region"
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

      {/*
        The sort buttons live only in <th> above, and `.tkt-table` — buttons
        included — is `display: none` below 768px (components.css), so a
        mobile reader had no way to change the sort at all. This is that
        control: a labelled field select plus a direction toggle, wired to the
        same `onSort` the headers call, and visible only where the table
        itself is not (`.tkt-mobile-sort` in components.css).

        Choosing a field behaves exactly like clicking its header — `onSort`
        resets to descending and page 1 either way. The direction button
        re-sends the *current* field, which `onSort` already treats as
        "toggle": the same call a second click on an active header makes.
      */}
      <div className="tkt-mobile-sort">
        <label className="tkt-field-label" htmlFor={sortFieldId}>
          Sort by
        </label>
        <div className="tkt-mobile-sort__row">
          <select
            className="tkt-field"
            id={sortFieldId}
            onChange={(event) => onSort(event.target.value as SortField)}
            value={sort}
          >
            {SORTABLE_COLUMNS.map((column) => (
              <option key={column.field} value={column.field}>
                {column.label}
              </option>
            ))}
          </select>
          <button
            aria-pressed={order === "asc"}
            className="tkt-btn tkt-btn--secondary"
            onClick={() => onSort(sort)}
            type="button"
          >
            <span aria-hidden="true">{order === "asc" ? "▲" : "▼"}</span>
            {order === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
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
