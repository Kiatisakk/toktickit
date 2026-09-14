import { type InputHTMLAttributes, useId } from "react";

import { Field } from "./Field";
import { fieldAria, fieldClassName } from "./fieldAttributes";

interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className" | "type"
> {
  label: string;
  error?: string;
  hint?: string;
  /** Whether the characters are currently shown. Owned by the form. */
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}

/**
 * A password field with a show/hide toggle (ui-spec.md §3, §4, §9).
 *
 * **The form owns the visibility, not this component.** ui-spec.md says the
 * toggle returns to hidden on submit, and only the form knows when it has been
 * submitted. A component holding its own state would leave a revealed password
 * on screen through a failed sign-in — on a shared machine, the moment it
 * matters most.
 *
 * The toggle is a real `button` whose accessible name changes between *Show
 * password* and *Hide password*, so a screen reader announces what pressing it
 * will do rather than a state it has to infer. `aria-pressed` is deliberately
 * not used alongside a changing name: the two together announce the state
 * twice and contradict each other on some readers.
 *
 * `type="button"` matters. Inside a form, a button's default type is submit,
 * and a toggle that submitted the form would send a half-typed password.
 */
export const PasswordInput = ({
  label,
  error,
  hint,
  visible,
  onVisibleChange,
  required = false,
  readOnly = false,
  ...rest
}: PasswordInputProps) => {
  const controlId = useId();

  return (
    <Field
      controlId={controlId}
      error={error}
      hint={hint}
      label={label}
      required={required}
    >
      <span className="tkt-password-control">
        <input
          className={fieldClassName(error, readOnly)}
          id={controlId}
          readOnly={readOnly}
          type={visible ? "text" : "password"}
          {...fieldAria(controlId, { error, hint, required })}
          {...rest}
        />
        <button
          aria-controls={controlId}
          className="tkt-password-toggle"
          disabled={readOnly}
          onClick={() => onVisibleChange(!visible)}
          type="button"
        >
          {visible ? "Hide password" : "Show password"}
        </button>
      </span>
    </Field>
  );
};
