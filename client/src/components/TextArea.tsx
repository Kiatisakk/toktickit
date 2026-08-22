import { type TextareaHTMLAttributes, useId } from "react";

import { Field } from "./Field";
import { fieldAria, fieldClassName } from "./fieldAttributes";

interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "className"
> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * The multiline control is taller than the single-line inputs and resizes
 * vertically only — §8.3 allows resizing, but not where it can break the
 * layout, and horizontal growth does exactly that.
 */
export const TextArea = ({
  label,
  error,
  hint,
  required = false,
  readOnly = false,
  rows = 6,
  ...rest
}: TextAreaProps) => {
  const controlId = useId();

  return (
    <Field
      controlId={controlId}
      error={error}
      hint={hint}
      label={label}
      required={required}
    >
      <textarea
        className={`${fieldClassName(error, readOnly)} tkt-field--multiline`}
        id={controlId}
        readOnly={readOnly}
        rows={rows}
        {...fieldAria(controlId, { error, hint, required })}
        {...rest}
      />
    </Field>
  );
};
