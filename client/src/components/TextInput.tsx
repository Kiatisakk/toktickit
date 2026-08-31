import { type InputHTMLAttributes, useId } from "react";

import { Field } from "./Field";
import { fieldAria, fieldClassName } from "./fieldAttributes";
import { Icon, type IconName } from "./Icon";

interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className"
> {
  label: string;
  error?: string;
  hint?: string;
  /**
   * A mark inside the control, as the search box in the illustration has.
   *
   * It belongs to the input rather than to the field group: positioned against
   * the group it has to be guessed at from the bottom edge, and the guess is
   * wrong the moment a validation message appears beneath, a hint is added, or
   * the control height changes at the mobile breakpoint.
   */
  icon?: IconName;
}

export const TextInput = ({
  label,
  error,
  hint,
  icon,
  required = false,
  readOnly = false,
  ...rest
}: TextInputProps) => {
  const controlId = useId();

  const control = (
    <input
      className={fieldClassName(error, readOnly)}
      id={controlId}
      readOnly={readOnly}
      type="text"
      {...fieldAria(controlId, { error, hint, required })}
      {...rest}
    />
  );

  return (
    <Field
      controlId={controlId}
      error={error}
      hint={hint}
      label={label}
      required={required}
    >
      {icon ? (
        <span className="tkt-control-icon">
          <Icon name={icon} />
          {control}
        </span>
      ) : (
        control
      )}
    </Field>
  );
};
