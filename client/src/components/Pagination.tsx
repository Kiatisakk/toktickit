import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Page controls with a range summary.
 *
 * The summary ("Showing 1 to 10 of 42 tickets") is not decoration: it is the
 * only thing on the screen that tells a reader the list is longer than what
 * they can see. The figure in the labsheet carries the same line.
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
        <span className="tkt-pagination__position">
          Page {page} of {totalPages}
        </span>
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
