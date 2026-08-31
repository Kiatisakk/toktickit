/**
 * Parses an `:id` path parameter.
 *
 * Digits only, then a safe-integer check. `Number("1e400")` is `Infinity` and
 * `Number(" 1 ")` is one; neither is an identifier anybody typed, and handing
 * either to Prisma turns a bad request into a database error.
 *
 * Defined once. It began as two copies, one in each router, which is the same
 * shape of problem the peer review found with the priority list on PR #27 — two
 * copies of one rule do not stay equal, and the divergence is silent until a
 * URL is accepted by one route and refused by the other.
 */
export const identifier = (raw: unknown): number | null => {
  if (typeof raw !== "string" || !/^\d+$/u.test(raw)) {
    return null;
  }

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
