/**
 * "Aug 29, 2026 09:14 AM" — the shape the labsheet illustrations print.
 *
 * Two calls rather than one because `toLocaleString` puts a comma between the
 * date and the time and offers no option to drop it. The figures have none.
 *
 * Defined once. It was written twice, identically, in the detail screen and in
 * the attachment section — two copies of a format shown side by side on one
 * page, which is the arrangement most likely to end up disagreeing.
 */
export const formatWhen = (iso: string): string => {
  const value = new Date(iso);

  const date = value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const time = value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${time}`;
};
