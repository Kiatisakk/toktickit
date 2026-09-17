import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import type { TicketQuery } from "./ticketQuery.js";

/**
 * Reading a page of tickets, shared by My Tickets and the staff Ticket Queue.
 *
 * The two lists differ in *which* tickets they may read — the caller's own, or
 * all of them — and in a few extra filters. Everything else is the same list:
 * the same search, the same stable ordering, the same one-snapshot page. Kept
 * here once, so the two cannot drift into paging differently or treating a
 * search term differently.
 */

/**
 * What a row in the list carries.
 *
 * Deliberately without `description`: the list shows a summary, and sending a
 * five-thousand-character body for every row of every page to render one line
 * of it is a cost with no reader.
 */
export const LIST_SHAPE = {
  id: true,
  ticketNumber: true,
  summary: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  ticketOwner: { select: { id: true, name: true } },
} as const;

/** Everything a client is given about one ticket. */
export const TICKET_SHAPE = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  resolutionSummary: true,
  resolvedIndicatedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  ticketOwner: { select: { id: true, name: true } },
} as const;

/**
 * The queue also says whose ticket each row is — the list is everyone's — and
 * whether its Requester has said the problem appears resolved (api-spec.md §7),
 * which is what staff scan a queue for.
 */
export const QUEUE_SHAPE = {
  ...LIST_SHAPE,
  requester: { select: { id: true, name: true } },
  resolvedIndicatedAt: true,
} as const;

/**
 * Escapes the three characters `LIKE` treats specially.
 *
 * Prisma's `contains` becomes `ILIKE '%' || $1 || '%'` and passes the term
 * through unescaped — checked against PostgreSQL on this Prisma version, where
 * a search for `50%` matched `50 off`. A search box is a request for literal
 * text, so `%`, `_` and the escape character itself are matched as themselves.
 */
const literal = (term: string) => term.replaceAll(/[\\%_]/gu, "\\$&");

/** The filters both lists share, and the three only the queue sends. */
export const ticketListWhere = (
  query: TicketQuery
): Prisma.TicketWhereInput => ({
  ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
  ...(query.requestedPriority === undefined
    ? {}
    : { requestedPriority: query.requestedPriority }),
  ...(query.itPriority === undefined ? {} : { itPriority: query.itPriority }),
  ...(query.status === undefined ? {} : { currentStatus: query.status }),
  ...(query.ownerId === undefined ? {} : { ticketOwnerId: query.ownerId }),
  ...(query.unassigned ? { ticketOwnerId: null } : {}),
  ...(query.requesterId === undefined
    ? {}
    : { requesterId: query.requesterId }),
  ...(query.search === undefined
    ? {}
    : {
        OR: [
          {
            ticketNumber: {
              contains: literal(query.search),
              mode: "insensitive" as const,
            },
          },
          {
            summary: {
              contains: literal(query.search),
              mode: "insensitive" as const,
            },
          },
        ],
      }),
});

/**
 * The order, with the immutable id always last.
 *
 * Without the id two tickets sharing a sort value have no defined order between
 * them, so the same row can appear on two pages or on none (BR-32) — and the
 * queue sorts by status and priority, where ties are the normal case rather than
 * the rare one.
 *
 * Owner sorts by the owner's name, which is what the column shows; an owner id
 * would order the rows by when each account happened to be created.
 */
export const ticketListOrder = (
  query: TicketQuery
): Prisma.TicketOrderByWithRelationInput[] => [
  query.sort === "ticketOwner"
    ? { ticketOwner: { name: query.order } }
    : { [query.sort]: query.order },
  { id: "desc" },
];

/**
 * One page and its total, read from one snapshot.
 *
 * Run separately, the two reads see different states, so a ticket created
 * between them makes `totalItems` disagree with the rows returned. Repeatable
 * read rather than the default: under read committed each statement takes its
 * own snapshot even inside one transaction, which is the very thing avoided.
 */
export const readTicketPage = async <
  Shape extends typeof LIST_SHAPE | typeof QUEUE_SHAPE,
>(
  where: Prisma.TicketWhereInput,
  query: TicketQuery,
  select: Shape
) => {
  const [totalItems, data] = await prisma.$transaction(
    [
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: ticketListOrder(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select,
      }),
    ],
    { isolationLevel: "RepeatableRead" }
  );

  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
};
