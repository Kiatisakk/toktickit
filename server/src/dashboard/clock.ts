/**
 * The dashboard's only source of "now".
 *
 * An object rather than a bare function so a test can replace `now` with a
 * fixed instant and assert both sides of the Bangkok boundary without waiting
 * for midnight or faking every timer in the process (tests.md, Environment).
 * Nothing a request carries can change it.
 */
export const clock: { now: () => Date } = {
  now: () => new Date(),
};
