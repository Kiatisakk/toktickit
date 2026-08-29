import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * The pages either side of the current one, plus the first and last, with a gap
 * standing in for whatever is skipped.
 *
 * A window rather than every page: the page 11 figure shows `1 2 3 4 5 … 6`, and
 * a requester with two thousand tickets would otherwise get two hundred buttons.
 */
type Slot = { kind: "page"; page: number } | { kind: "gap"; before: number };

const pageWindow = (page: number, totalPages: number): Slot[] => {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted]
    .filter((value) => value >= 1 && value <= totalPages)
    .toSorted((a, b) => a - b);

  const slots: Slot[] = [];

  for (const [index, value] of pages.entries()) {
    const previous = pages[index - 1];

    // A gap is named for the page it precedes, so its key is stable across
    // renders rather than being its position in the array.
    if (previous !== undefined && value - previous > 1) {
      slots.push({ kind: "gap", before: value });
    }

    slots.push({ kind: "page", page: value });
  }

  return slots;
};

/**
 * Page controls with a range summary.
 *
 * The summary ("Showing 1 to 10 of 42 tickets") is not decoration: it is the
 * only thing on the screen that tells a reader the list is longer than what
 * they can see.
 *
 * Renders nothing when everything fits on one page — controls that can only be
 * pressed to arrive where you already are are noise.
 */
export const Pagination = ({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: PaginationProps) => {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <nav aria-label="Pagination" className="tkt-pagination">
      <p aria-live="polite" className="tkt-pagination__summary">
        Showing {first} to {last} of {totalItems} tickets
      </p>

      <div className="tkt-pagination__controls">
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
        >
          Previous
        </Button>
        {pageWindow(page, totalPages).map((slot) =>
          slot.kind === "gap" ? (
            <span
              aria-hidden="true"
              className="tkt-pagination__gap"
              key={`gap-${slot.before}`}
            >
              …
            </span>
          ) : (
            <button
              aria-current={slot.page === page ? "page" : undefined}
              aria-label={`Page ${slot.page}`}
              className={
                slot.page === page
                  ? "tkt-page-btn tkt-page-btn--current"
                  : "tkt-page-btn"
              }
              key={slot.page}
              onClick={() => onPageChange(slot.page)}
              type="button"
            >
              {slot.page}
            </button>
          )
        )}
        <Button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
        >
          Next
        </Button>
      </div>
    </nav>
  );
};
