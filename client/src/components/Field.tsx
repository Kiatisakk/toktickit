import type { ReactNode } from "react";

export interface FieldProps {
  /** Rendered above the control, per §8.3. */
  label: string;
  /** Id of the control this label points at. */
  controlId: string;
  required?: boolean;
  /**
   * Validation message. It appears immediately beneath the control it concerns
   * — §8.3 forbids collecting messages into one summary at the top of a form.
   */
  error?: string;
  hint?: string;
  children: ReactNode;
}

/**
 * Layout for one labelled control: label, optional required marker, the control
 * itself, then either its validation message or its hint.
 *
 * The red asterisk never stands in for the message. §8.3 is explicit that the
 * marker and the message are two different things, and a screen reader user who
 * cannot see the asterisk still needs to be told what went wrong — which is why
 * the asterisk is aria-hidden and the control carries `required` instead.
 */
export const Field = ({
  label,
  controlId,
  required = false,
  error,
  hint,
  children,
}: FieldProps) => (
  <div className="tkt-field-group">
    <label className="tkt-field-label" htmlFor={controlId}>
      {label}
      {required ? (
        <span aria-hidden="true" className="tkt-required">
          *
        </span>
      ) : null}
    </label>

    {children}

    {error ? (
      <p className="tkt-field-error" id={`${controlId}-error`} role="alert">
        {error}
      </p>
    ) : null}

    {!error && hint ? (
      <p className="tkt-field-hint" id={`${controlId}-hint`}>
        {hint}
      </p>
    ) : null}
  </div>
);
