/**
 * The loading state of the ticket list (`ui-spec.md` §7).
 *
 * Rows rather than a centred block, so the page keeps the shape it is about to
 * have. A block of a different height means every refetch — and a filter change
 * is a refetch — makes the content below jump, which reads as the page breaking
 * rather than working.
 *
 * The bars are `aria-hidden`; a screen reader gets the one status line instead,
 * because eight identical announcements of "loading" are worse than one.
 */

const ROWS = 5;
const COLUMNS = 9;

export const TicketTableSkeleton = () => (
  <div className="tkt-skeleton" data-state="loading">
    <p className="tkt-visually-hidden" role="status">
      Loading your tickets.
    </p>

    <div aria-hidden="true" className="tkt-skeleton__grid">
      {Array.from({ length: ROWS }, (_row, rowIndex) => (
        // Skeleton rows carry no data and never reorder, so their position is
        // the only identity they have.
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no id
        <div className="tkt-skeleton__row" key={`row-${rowIndex}`}>
          {Array.from({ length: COLUMNS }, (_cell, cellIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no id
            <span className="tkt-skeleton__cell" key={`cell-${cellIndex}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);
