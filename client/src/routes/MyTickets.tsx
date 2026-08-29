import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";
import { Select } from "../components/Select";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import {
  type SortField,
  type TicketRow,
  TicketTable,
} from "../components/TicketTable";
import { useRequester } from "../context/useRequester";
import {
  fetchCategories,
  fetchTickets,
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

interface Filters {
  search: string;
  categoryId: string;
  requestedPriority: string;
  itPriority: string;
  status: string;
}

const NO_FILTERS: Filters = {
  search: "",
  categoryId: "",
  requestedPriority: "",
  itPriority: "",
  status: "",
};

type Listing =
  | { kind: "loading" }
  | { kind: "loaded"; tickets: TicketRow[]; meta: TicketListMeta }
  | { kind: "failed"; message: string };

const anyFilterActive = (filters: Filters) =>
  Object.values(filters).some((value) => value.trim() !== "");

/**
 * My Tickets (§8.4).
 *
 * The distinction that drives most of this screen is BR-35: a requester with no
 * tickets at all and a query that matched nothing are different situations. The
 * API cannot tell them apart — both are an empty list — so the client decides by
 * whether any filter is active, and says something different in each case.
 */
export const MyTickets = () => {
  const { requester, generation } = useRequester();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [listing, setListing] = useState<Listing>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        // The filter is a convenience. Losing it is not worth failing the whole
        // screen over, and the list below still works without it.
        setCategories([]);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const load = useCallback(
    (signal: AbortSignal) => {
      if (!requester) {
        return;
      }

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

      query.set("sort", sort);
      query.set("order", order);
      query.set("page", String(page));

      setListing({ kind: "loading" });

      fetchTickets<TicketRow>(query, requester.id, signal)
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
                : "The ticket list could not be loaded.",
          });
        });
    },
    [requester, filters, sort, order, page]
  );

  // `generation` is in the dependency list so that changing requester discards
  // what is on screen and refetches, rather than leaving one person's tickets
  // visible under another person's name (BR-08).
  useEffect(() => {
    const controller = new AbortController();

    // `load` sets the loading state before it fetches, which the rule reads as
    // a synchronous setState in an effect. It is wanted on every fetch and not
    // only the first: a filter change refetches, and leaving the previous
    // page's rows on screen while the new ones arrive shows results that do not
    // match the controls above them. Synchronising with the API is the case the
    // rule's own guidance allows.
    // oxlint-disable-next-line react/set-state-in-effect
    load(controller.signal);

    return () => {
      controller.abort();
    };
  }, [load, generation]);

  const setFilter = (key: keyof Filters) => (value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    // Any change to what is being asked for starts again at the first page:
    // staying on page 3 of a result set that now has one page shows nothing.
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
    <AppShell breadcrumbs={[{ label: "My Tickets" }]}>
      <div className="tkt-list-header">
        <div>
          <h1 className="tkt-page-title">My Tickets</h1>
          <p className="tkt-page-subtitle">
            View and track all of your support requests.
          </p>
        </div>
        <div className="tkt-actions">
          <Button
            disabled={!filtering}
            onClick={clearFilters}
            variant="secondary"
          >
            Clear Filters
          </Button>
          <Button
            onClick={() => void navigate("/tickets/new")}
            variant="primary"
          >
            Create Ticket
          </Button>
        </div>
      </div>

      <div className="tkt-filters">
        <TextInput
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
      </div>

      {listing.kind === "loading" ? (
        <StateBlock
          description="Fetching your tickets."
          kind="loading"
          title="Loading…"
        />
      ) : null}

      {listing.kind === "failed" ? (
        <StateBlock
          action={
            <Button
              onClick={() => {
                const controller = new AbortController();
                load(controller.signal);
              }}
              variant="primary"
            >
              Try again
            </Button>
          }
          description={listing.message}
          kind="error"
          title="Could not load your tickets"
        />
      ) : null}

      {listing.kind === "loaded" && listing.tickets.length === 0 ? (
        filtering ? (
          <StateBlock
            action={
              <Button onClick={clearFilters} variant="secondary">
                Clear Filters
              </Button>
            }
            description="Nothing matches the filters you have applied. Widen them or clear them to see your tickets again."
            kind="no-results"
            title="No tickets match your filters"
          />
        ) : (
          <StateBlock
            action={
              <Button
                onClick={() => void navigate("/tickets/new")}
                variant="primary"
              >
                Create Ticket
              </Button>
            }
            description="You have not raised any support requests yet."
            kind="empty"
            title="No tickets yet"
          />
        )
      ) : null}

      {listing.kind === "loaded" && listing.tickets.length > 0 ? (
        <>
          <TicketTable
            onSort={onSort}
            order={order}
            sort={sort}
            tickets={listing.tickets}
          />
          <Pagination
            onPageChange={setPage}
            page={listing.meta.page}
            pageSize={listing.meta.pageSize}
            totalItems={listing.meta.totalItems}
            totalPages={listing.meta.totalPages}
          />
        </>
      ) : null}
    </AppShell>
  );
};
