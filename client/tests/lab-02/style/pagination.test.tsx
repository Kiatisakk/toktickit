import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "../../../src/components/Pagination";

/**
 * STYLE-09 — the page controls the page 11 illustration shows.
 *
 * The figure draws numbered page buttons, not a "Page 1 of 6" caption, and the
 * number of the current page is filled dark green. Both are assertable here;
 * the colour is not, and waits for the Playwright pass.
 */

const renderPagination = (
  page: number,
  totalPages: number,
  onPageChange = vi.fn()
) => {
  render(
    <Pagination
      onPageChange={onPageChange}
      page={page}
      pageSize={10}
      totalItems={totalPages * 10}
      totalPages={totalPages}
    />
  );

  return onPageChange;
};

describe("the range summary", () => {
  it("says where in the list the reader is", () => {
    renderPagination(2, 5);

    expect(
      screen.getByText("Showing 11 to 20 of 50 tickets")
    ).toBeInTheDocument();
  });

  // Controls that can only be pressed to arrive where you already are.
  it("renders nothing at all when everything fits on one page", () => {
    const { container } = render(
      <Pagination
        onPageChange={() => undefined}
        page={1}
        pageSize={10}
        totalItems={4}
        totalPages={1}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("numbered pages", () => {
  it("gives every page its own button when they all fit", () => {
    renderPagination(1, 3);

    for (const label of ["Page 1", "Page 2", "Page 3"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the current page for assistive technology, not only in colour", () => {
    renderPagination(2, 3);

    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("asks for the page that was clicked", async () => {
    const onPageChange = renderPagination(1, 3);

    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe("a long list", () => {
  // A requester with two thousand tickets would otherwise get two hundred
  // buttons, so the run is windowed: first, last, and the current page's
  // neighbours.
  it("keeps the first, the last and the pages either side of the current one", () => {
    renderPagination(10, 20);

    for (const label of ["Page 1", "Page 9", "Page 10", "Page 11", "Page 20"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("leaves out the pages between", () => {
    renderPagination(10, 20);

    expect(screen.queryByRole("button", { name: "Page 5" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Page 15" })).toBeNull();
  });

  /**
   * The figure draws `1 2 3 4 5 … 6`, which places an ellipsis between 5 and 6
   * with nothing skipped between them. That is a drawing artefact rather than a
   * rule, so a gap is rendered only where pages are genuinely missing — copying
   * the mock here would mean promising a page that is not there.
   */
  it("shows no gap when the run is unbroken", () => {
    const { container } = render(
      <Pagination
        onPageChange={() => undefined}
        page={2}
        pageSize={10}
        totalItems={30}
        totalPages={3}
      />
    );

    expect(container.querySelector(".tkt-pagination__gap")).toBeNull();
  });

  it("shows a gap where pages really are skipped", () => {
    const { container } = render(
      <Pagination
        onPageChange={() => undefined}
        page={10}
        pageSize={10}
        totalItems={200}
        totalPages={20}
      />
    );

    expect(container.querySelectorAll(".tkt-pagination__gap")).toHaveLength(2);
  });
});

describe("previous and next", () => {
  it("cannot go back from the first page", () => {
    renderPagination(1, 3);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("cannot go forward from the last page", () => {
    renderPagination(3, 3);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
