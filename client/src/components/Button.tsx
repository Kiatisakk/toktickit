import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * Marks a request that is still in flight. The button disables itself, shows
   * a spinner and swaps its label — §8.3 requires the submit control to be both
   * visibly busy and unusable while its request runs, which is also the
   * duplicate-submission control (BR-17).
   */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
}

export const Button = ({
  variant = "secondary",
  busy = false,
  busyLabel = "Working…",
  disabled = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) => {
  const classes = [
    "tkt-btn",
    `tkt-btn--${variant}`,
    busy ? "tkt-btn--busy" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-busy={busy || undefined}
      className={classes}
      disabled={disabled || busy}
      type={type}
      {...rest}
    >
      {busy ? (
        <>
          <span aria-hidden="true" className="tkt-btn__spinner" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
};
