/**
 * The dashboard's day boundary (specification.md BR-23).
 *
 * "Yesterday" means the instant at 00:00 today in Asia/Bangkok, call it T0.
 * Bangkok is UTC+7 all year and has no daylight saving, so the zone is a fixed
 * offset and the arithmetic needs no time-zone database. A zone with daylight
 * saving could not be handled this way; this one can, and a test walks a full
 * year to keep that true.
 */

export const DASHBOARD_TIME_ZONE = "Asia/Bangkok";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * T0 for `now`: the start of the Bangkok day that contains it, as an instant.
 *
 * Shifting by the offset turns Bangkok wall-clock time into UTC fields, where
 * flooring to a multiple of a day lands on Bangkok midnight; shifting back
 * returns the instant. The instant at exactly Bangkok midnight is its own T0.
 */
export const bangkokDayStart = (now: Date): Date => {
  const shifted = now.getTime() + BANGKOK_OFFSET_MS;
  const midnight = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS);

  return new Date(midnight - BANGKOK_OFFSET_MS);
};
