const DIGITS_ONLY = /^\d+$/u;

/**
 * The value of an id filter in the address, or `""` when the API would refuse
 * it. The API's rule (`readPositiveInt` in `server/src/tickets/ticketQuery.ts`)
 * is a positive whole number that is a safe integer: `0` and anything past
 * 2^53 - 1 are a 400, so a hand-edited or stale link must not send them.
 */
export const positiveSafeIntegerParam = (value: string | null): string => {
  if (value === null || !DIGITS_ONLY.test(value)) {
    return "";
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 1 ? value : "";
};
