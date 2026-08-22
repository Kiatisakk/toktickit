/**
 * Shared wiring for controls that sit inside a `Field`.
 *
 * These live apart from Field.tsx on purpose: a module that exports both a
 * component and plain helpers breaks React Fast Refresh, because the bundler
 * can no longer tell whether the module is a component module.
 */

interface FieldStateOptions {
  error?: string;
  hint?: string;
  required?: boolean;
}

/**
 * Ids for a field's message elements.
 *
 * Both sides of the `aria-describedby` contract go through these two functions
 * — `Field` renders the elements with them, and `fieldAria` points at them.
 * Building the string in two places instead would mean a rename on one side
 * silently aims `aria-describedby` at nothing, and TypeScript could not catch
 * it because both halves would still be valid strings.
 */
export const errorId = (controlId: string) => `${controlId}-error`;
export const hintId = (controlId: string) => `${controlId}-hint`;

/**
 * ARIA attributes tying a control to its message.
 *
 * The error wins over the hint when both are present — a field that is wrong
 * should say what is wrong, not offer general advice.
 */
export const fieldAria = (controlId: string, options: FieldStateOptions) => {
  const { error, hint, required } = options;

  let describedBy: string | undefined;

  if (error) {
    describedBy = errorId(controlId);
  } else if (hint) {
    describedBy = hintId(controlId);
  }

  return {
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    required,
  };
};

/** Base class plus whichever state modifiers apply. */
export const fieldClassName = (error?: string, readOnly?: boolean) =>
  [
    "tkt-field",
    error ? "tkt-field--invalid" : null,
    readOnly ? "tkt-field--readonly" : null,
  ]
    .filter(Boolean)
    .join(" ");
