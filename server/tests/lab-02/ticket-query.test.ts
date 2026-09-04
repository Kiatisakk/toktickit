import { describe, expect, it } from "vitest";

import { parseTicketQuery } from "../../src/tickets/ticketQuery.js";

/**
 * UNIT-04 — every documented parameter is accepted and normalised.
 * UNIT-05 — everything else is rejected by name.
 *
 * The contract lives in docs/lab-02/api-spec.md under `GET /api/tickets`. This
 * is a pure function on purpose: the rules are fiddly, there are a lot of them,
 * and none of them needs a database to be wrong.
 */

describe("an empty query", () => {
  it("returns the documented defaults", () => {
    const result = parseTicketQuery({});

    if (!result.ok) {
      throw new Error("expected an empty query to be valid");
    }

    expect(result.value).toMatchObject({
      sort: "createdAt",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
  });
});

const valueOf = (params: Record<string, unknown>) => {
  const result = parseTicketQuery(params);

  if (!result.ok) {
    throw new Error(`expected ${JSON.stringify(params)} to be valid`);
  }

  return result.value;
};

const detailsOf = (params: Record<string, unknown>) => {
  const result = parseTicketQuery(params);

  if (result.ok) {
    throw new Error(`expected ${JSON.stringify(params)} to be rejected`);
  }

  return result.details;
};

describe("search", () => {
  it("is trimmed", () => {
    expect(valueOf({ search: "  laptop  " }).search).toBe("laptop");
  });

  // A search box someone has cleared sends "", and that is not a filter. Left
  // as an empty string it would narrow nothing while still counting as an
  // active filter, which is how "no tickets yet" turns into "no matches".
  it("is absent when blank", () => {
    expect(valueOf({ search: "   " }).search).toBeUndefined();
    expect(valueOf({ search: "" }).search).toBeUndefined();
  });

  it("is absent when not supplied", () => {
    expect(valueOf({}).search).toBeUndefined();
  });
});

describe("filters", () => {
  it("accepts a category id", () => {
    expect(valueOf({ categoryId: "3" }).categoryId).toBe(3);
  });

  it.each(["0", "-1", "1.5", "abc"])("rejects categoryId %j", (categoryId) => {
    expect(detailsOf({ categoryId })).toHaveProperty("categoryId");
  });

  // Blank means "not filtering", not "filter by nothing". It is what an "All
  // Categories" dropdown sends when nothing is chosen, and the enums treat it
  // the same way — rejecting it here and accepting it there would be arbitrary.
  it.each(["categoryId", "requestedPriority", "itPriority", "status"])(
    "treats a blank %s as absent rather than invalid",
    (field) => {
      expect(valueOf({ [field]: "" })).not.toHaveProperty(field);
    }
  );

  it.each(["LOW", "MEDIUM", "HIGH"])(
    "accepts requestedPriority %s",
    (value) => {
      expect(valueOf({ requestedPriority: value }).requestedPriority).toBe(
        value
      );
    }
  );

  it.each(["URGENT", "low", "1"])(
    "rejects requestedPriority %j",
    (requestedPriority) => {
      expect(detailsOf({ requestedPriority })).toHaveProperty(
        "requestedPriority"
      );
    }
  );

  it("accepts itPriority on the same scale", () => {
    expect(valueOf({ itPriority: "HIGH" }).itPriority).toBe("HIGH");
  });

  it.each(["URGENT", "low", "1"])("rejects itPriority %j", (itPriority) => {
    expect(detailsOf({ itPriority })).toHaveProperty("itPriority");
  });

  it.each(["NEW", "OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"])(
    "accepts status %s",
    (value) => {
      expect(valueOf({ status: value }).status).toBe(value);
    }
  );

  it("rejects a status outside the enum", () => {
    expect(detailsOf({ status: "ARCHIVED" })).toHaveProperty("status");
  });
});

describe("sorting", () => {
  it.each([
    "ticketNumber",
    "createdAt",
    "updatedAt",
    "summary",
    "requestedPriority",
  ])("accepts sort %s", (sort) => {
    expect(valueOf({ sort }).sort).toBe(sort);
  });

  // Sorting by a column the contract does not list would let a caller order by
  // anything the table happens to have, including columns Lab 2 never populates.
  it.each(["id", "description", "requesterId", "DROP TABLE"])(
    "rejects sort %j",
    (sort) => {
      expect(detailsOf({ sort })).toHaveProperty("sort");
    }
  );

  it.each(["asc", "desc"])("accepts order %s", (order) => {
    expect(valueOf({ order }).order).toBe(order);
  });

  it.each(["ASC", "up", "1"])("rejects order %j", (order) => {
    expect(detailsOf({ order })).toHaveProperty("order");
  });
});

describe("pagination", () => {
  it("accepts a page at or above one", () => {
    expect(valueOf({ page: "3" }).page).toBe(3);
  });

  it.each(["0", "-1", "1.5", "abc"])("rejects page %j", (page) => {
    expect(detailsOf({ page })).toHaveProperty("page");
  });

  it.each(["10", "20", "50"])("accepts pageSize %s", (pageSize) => {
    expect(valueOf({ pageSize }).pageSize).toBe(Number(pageSize));
  });

  // A caller asking for 1000 rows is either mistaken or probing. Either way the
  // answer is the documented set, not a silent 10.
  it.each(["15", "0", "1000", "abc"])("rejects pageSize %j", (pageSize) => {
    expect(detailsOf({ pageSize })).toHaveProperty("pageSize");
  });
});

describe("parameters the contract does not define", () => {
  // BR-34. Ignoring an unknown parameter means a typo silently returns the
  // unfiltered list, and the user has no way to tell.
  it("rejects an unknown parameter by name", () => {
    expect(detailsOf({ sortBy: "createdAt" })).toHaveProperty("sortBy");
  });

  it("names every offending parameter at once", () => {
    const details = detailsOf({ pageSize: "15", order: "sideways", nope: "1" });

    expect(Object.keys(details).toSorted()).toEqual([
      "nope",
      "order",
      "pageSize",
    ]);
  });

  it("explains why, not just that", () => {
    expect(detailsOf({ pageSize: "15" })["pageSize"]).toMatch(/10, 20, 50/u);
  });
});

/**
 * A blank value is not the same as an omitted one: `?page=` was typed (or
 * built), while leaving `page` out of the query string entirely is what the
 * default exists for. Only the filter dropdowns get to say `""` and mean "not
 * filtering" — page, pageSize, sort and order have no such control behind
 * them, so a blank value there is a mistake the way any other invalid value
 * is, not a request for the default.
 */
describe("blank where a filter dropdown would mean 'not filtering'", () => {
  it.each(["page", "pageSize", "sort", "order"])(
    "rejects a blank %s rather than falling back to its default",
    (field) => {
      expect(detailsOf({ [field]: "" })).toHaveProperty(field);
    }
  );

  it("still applies every default when the parameters are omitted, not blank", () => {
    expect(valueOf({})).toMatchObject({
      sort: "createdAt",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
  });
});

/**
 * Findings from the peer review of PR #27.
 *
 * Both are the same failure in different clothes: a value the contract does not
 * permit being read as something it is not, and the caller never being told.
 */
describe("values Express does not hand over as a single string", () => {
  // `?status=NEW&status=OPEN` reaches the handler as an array, and `?status[a]=1`
  // as an object. Reading either as "absent" would drop the filter and return
  // the unfiltered list — the exact silence BR-34 exists to prevent.
  it("rejects a parameter supplied twice", () => {
    const result = parseTicketQuery({ status: ["NEW", "OPEN"] });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.details["status"]).toMatch(/once/u);
  });

  it("rejects a parameter supplied as a nested object", () => {
    const result = parseTicketQuery({ categoryId: { gt: 1 } });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.details["categoryId"]).toBeDefined();
  });

  it("names every repeated parameter rather than only the first", () => {
    const result = parseTicketQuery({ status: ["NEW"], search: ["a", "b"] });

    expect(result.ok).toBe(false);
    expect(
      result.ok === false && Object.keys(result.details).toSorted()
    ).toStrictEqual(["search", "status"]);
  });

  it("still accepts an ordinary single value", () => {
    const result = parseTicketQuery({ status: "NEW" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.status).toBe("NEW");
  });
});

describe("page size is compared as text, not as a number", () => {
  // Number() reads all four of these as ten. The contract permits ten in one
  // spelling, and a size it did not authorise is a size no test covers.
  it.each(["10.0", "1e1", "+10", "0x0A", " 10.00"])(
    "rejects %s",
    (spelling) => {
      const result = parseTicketQuery({ pageSize: spelling });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.details["pageSize"]).toBeDefined();
    }
  );

  it.each(["10", "20", "50"])("accepts %s", (spelling) => {
    const result = parseTicketQuery({ pageSize: spelling });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.pageSize).toBe(Number(spelling));
  });
});
