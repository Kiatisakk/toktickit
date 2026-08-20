import { type SelectHTMLAttributes, useId } from "react";

import { Field } from "./Field";
import { fieldAria, fieldClassName } from "./fieldAttributes";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "className"
> {
  label: string;
  options: SelectOption[];
  /** Shown as a disabled first entry when no value is chosen yet. */
  placeholder?: string;
  error?: string;
  hint?: string;
}

/**
 * A native `<select>` rather than a custom listbox. §8.1 requires the requester
 * selector to be keyboard accessible, and the platform control is already
 * correct on every browser and screen reader we would otherwise have to
 * reimplement.
 */
export const Select = ({
  label,
  options,
  placeholder,
  error,
  hint,
  required = false,
  ...rest
}: SelectProps) => {
  const controlId = useId();

  return (
    <Field
      controlId={controlId}
      error={error}
      hint={hint}
      label={label}
      required={required}
    >
      <select
        className={fieldClassName(error)}
        id={controlId}
        {...fieldAria(controlId, { error, hint, required })}
        {...rest}
      >
        {placeholder ? (
          <option disabled value="">
            {placeholder}
          </option>
        ) : null}

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
};
