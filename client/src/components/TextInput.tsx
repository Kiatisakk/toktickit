import { type InputHTMLAttributes, useId } from "react";

import { Field } from "./Field";
import { fieldAria, fieldClassName } from "./fieldAttributes";

interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className"
> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextInput = ({
  label,
  error,
  hint,
  required = false,
  readOnly = false,
  ...rest
}: TextInputProps) => {
  const controlId = useId();

  return (
    <Field
      controlId={controlId}
      error={error}
      hint={hint}
      label={label}
      required={required}
    >
      <input
        className={fieldClassName(error, readOnly)}
        id={controlId}
        readOnly={readOnly}
        type="text"
        {...fieldAria(controlId, { error, hint, required })}
        {...rest}
      />
    </Field>
  );
};
