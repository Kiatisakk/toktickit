/**
 * The `version` a write names (BR-19, D-07).
 *
 * A positive integer: the stored version starts at 1 and only ever increments,
 * so zero, a negative number, a fraction, a numeric string or a boolean cannot
 * be a version anyone read. Refusing them as a shape error (`400`) keeps them
 * apart from a version that is well formed but out of date (`409`).
 */

export type VersionResult =
  | { ok: true; value: number }
  | { ok: false; why: string };

export const readVersion = (value: unknown): VersionResult =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? { ok: true, value }
    : { ok: false, why: "Send the version you read, a whole number from 1." };
