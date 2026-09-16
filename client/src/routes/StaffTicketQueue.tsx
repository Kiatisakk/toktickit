import { useEffect, useState } from "react";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Pagination } from "../components/Pagination";
import { Select } from "../components/Select";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import { type SortField, TicketTable } from "../components/TicketTable";
import { TicketTableSkeleton } from "../components/TicketTableSkeleton";
import {
  fetchCategories,
  fetchStaffOwners,
  fetchStaffTickets,
  type QueueRow,
  type ReferenceItem,
  type TicketListMeta,
} from "../lib/api";

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

/**
 * The Owner filter's value. `""` is every ticket, `"unassigned"` is nobody's,
 * and anything else is an owner id. One select rather than a separate
 * Unassigned checkbox, because the API refuses an owner and "unassigned"
 * together (api-spec.md §7) and a single control cannot express both at once.
 */
const UNASSIGNED = "unassigned";

interface Filters {
  search: string;
  categoryId: string;
  requestedPriority: string;
  itPriority: string;
  status: string;
  owner: string;
}

const NO_FILTERS: Filters = {
  search: "",
  categoryId: "",
  requestedPriority: "",
  itPriority: "",
  status: "",
  owner: "",
};

type Listing =
  | { kind: "loading" }
  | { kind: "loaded"; tickets: QueueRow[]; meta: TicketListMeta }
  | { kind: "failed"; message: string };

const anyFilterActive = (filters: Filters) =>
  Object.values(filters).some((value) => value.trim() !== "");

const toQuery = (
  filters: Filters,
  sort: SortField,
  order: "asc" | "desc",
  page: number
) => {
  const query = new URLSearchParams();

  if (filters.search.trim() !== "") {
    query.set("search", filters.search.trim());
  }

  for (const key of [
    "categoryId",
    "requestedPriority",
    "itPriority",
    "status",
  ] as const) {
    if (filters[key] !== "") {
      query.set(key, filters[key]);
    }
  }

  if (filters.owner === UNASSIGNED) {
    query.set("unassigned", "true");
  } else if (filters.owner !== "") {
    query.set("ownerId", filters.owner);
  }

  query.set("sort", sort);
  query.set("order", order);
  query.set("page", String(page));

  return query;
};

/**
 * The staff Ticket Queue (ui-spec.md §5).
 *
 * Every requester's tickets, with the tools to find the one to act on. It is My
 * Tickets' surface on purpose — the same table, filter bar and pagination — so
 * staff move between their own tickets and everyone's without learning a second
 * list. What the queue adds is an Owner filter with *Unassigned*, three more
 * sortable columns, and owner rendered in words.
 *
 * Reached only by IT Staff and Administrators; the route guard redirects anyone
 * else, and the API refuses them 403 whatever the screen does (AC-13).
 */
export const StaffTicketQueue = () => {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [owners, setOwners] = useState<ReferenceItem[]>([]);
  const [ownersFailed, setOwnersFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [listing, setListing] = useState<Listing>({ kind: "loading" });

  // Reference data for the filters. Losing either is not worth failing the
  // screen over — the queue still works — so each degrades on its own.
  useEffect(() => {
    const controller = new AbortController();
    const aborted = (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError";

    fetchCategories(controller.signal)
      .then(setCategories)
      .catch((error: unknown) => {
        if (!aborted(error)) {
          setCategories([]);
        }
      });

    fetchStaffOwners(controller.signal)
      .then((items) => {
        setOwners(items);
        setOwnersFailed(false);
      })
      .catch((error: unknown) => {
        if (!aborted(error)) {
          // "Unassigned" needs no list, so it stays usable; only the named
          // owners go, and the hint says why.
          setOwners([]);
          setOwnersFailed(true);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // oxlint-disable-next-line react/set-state-in-effect
    setListing({ kind: "loading" });

    fetchStaffTickets(toQuery(filters, sort, order, page), controller.signal)
      .then((response) => {
        setListing({
          kind: "loaded",
          tickets: response.data,
          meta: response.meta,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setListing({
          kind: "failed",
          message:
            error instanceof Error
              ? error.message
              : "The ticket queue could not be loaded.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [filters, sort, order, page, reloadToken]);

  const setFilter = (key: keyof Filters) => (value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    // Staying on page 3 of a result that now has one page shows nothing.
    setPage(1);
  };

  const onSort = (field: SortField) => {
    if (field === sort) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("desc");
    }

    setPage(1);
  };

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPage(1);
  };

  const filtering = anyFilterActive(filters);

  return (
    <AppShell breadcrumbs={[{ label: "Ticket Queue" }]}>
      <div className="tkt-list-header">
        <div>
          <h1 className="tkt-page-title">Ticket Queue</h1>
          <p className="tkt-page-subtitle">
            Every ticket from every requester. Find unassigned work and open a
            ticket to act on it.
          </p>
        </div>
        <div className="tkt-actions">
          <Button
            disabled={!filtering}
            onClick={clearFilters}
            variant="secondary"
          >
            <Icon name="reload" />
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="tkt-filters">
        <TextInput
          icon="search"
          label="Search"
          onChange={(event) => setFilter("search")(event.target.value)}
          placeholder="Search by ticket number or summary"
          value={filters.search}
        />
        <Select
          label="Category"
          onChange={(event) => setFilter("categoryId")(event.target.value)}
          options={[
            { value: "", label: "All Categories" },
            ...categories.map((item) => ({
              value: String(item.id),
              label: item.name,
            })),
          ]}
          value={filters.categoryId}
        />
        <Select
          label="Requested Priority"
          onChange={(event) =>
            setFilter("requestedPriority")(event.target.value)
          }
          options={[{ value: "", label: "All Priorities" }, ...PRIORITIES]}
          value={filters.requestedPriority}
        />
        <Select
          label="IT Priority"
          onChange={(event) => setFilter("itPriority")(event.target.value)}
          options={[{ value: "", label: "All Priorities" }, ...PRIORITIES]}
          value={filters.itPriority}
        />
        <Select
          label="Current Status"
          onChange={(event) => setFilter("status")(event.target.value)}
          options={[{ value: "", label: "All Statuses" }, ...STATUSES]}
          value={filters.status}
        />
        <Select
          hint={
            ownersFailed
              ? "Owners could not be loaded; Unassigned still works."
              : undefined
          }
          label="Owner"
          onChange={(event) => setFilter("owner")(event.target.value)}
          options={[
            { value: "", label: "All Owners" },
            { value: UNASSIGNED, label: "Unassigned" },
            ...owners.map((owner) => ({
              value: String(owner.id),
              label: owner.name,
            })),
          ]}
          value={filters.owner}
        />
      </div>

      {listing.kind === "loading" ? <TicketTableSkeleton /> : null}

      {listing.kind === "failed" ? (
        <StateBlock
          action={
            <Button
              onClick={() => setReloadToken((token) => token + 1)}
              variant="primary"
            >
              Try again
            </Button>
          }
          description={listing.message}
          kind="error"
          title="Could not load the ticket queue"
        />
      ) : null}

      {/* Empty and no-results are different situations with different
          remedies, and must not share a message (ui-spec.md §5). */}
      {listing.kind === "loaded" && listing.tickets.length === 0 ? (
        filtering ? (
          <StateBlock
            action={
              <Button onClick={clearFilters} variant="secondary">
                Clear Filters
              </Button>
            }
            description="Nothing in the queue matches the filters applied. Widen them or clear them to see every ticket."
            kind="no-results"
            title="No tickets match these filters"
          />
        ) : (
          <StateBlock
            description="Nobody has raised a ticket yet. New requests will appear here."
            kind="empty"
            title="No tickets yet"
          />
        )
      ) : null}

      {listing.kind === "loaded" && listing.tickets.length > 0 ? (
        <div className="tkt-list">
          <TicketTable
            onSort={onSort}
            order={order}
            sort={sort}
            tickets={listing.tickets}
            variant="queue"
          />
          <Pagination
            onPageChange={setPage}
            page={listing.meta.page}
            pageSize={listing.meta.pageSize}
            totalItems={listing.meta.totalItems}
            totalPages={listing.meta.totalPages}
          />
        </div>
      ) : null}
    </AppShell>
  );
};
