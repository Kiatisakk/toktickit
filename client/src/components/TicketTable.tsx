import { Link } from "react-router";

import { Badge } from "./Badge";

export interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  ticketOwner: { id: number; name: string } | null;
}

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

const COLUMNS: { field: SortField | null; label: string }[] = [
  { field: "ticketNumber", label: "Ticket No." },
  { field: "createdAt", label: "Created Date" },
  { field: "summary", label: "Summary" },
  { field: null, label: "Category" },
  { field: "requestedPriority", label: "Requested Priority" },
  { field: null, label: "IT Priority" },
  { field: null, label: "Current Status" },
  { field: null, label: "Ticket Owner" },
  { field: "updatedAt", label: "Last Updated" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <table className="tkt-table">
        <caption className="tkt-visually-hidden">
          Your tickets, sortable by column
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                aria-sort={ariaSort(column.field)}
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
                <Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link>
              </td>
              <td>{formatDate(ticket.createdAt)}</td>
              <td>{ticket.summary}</td>
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
