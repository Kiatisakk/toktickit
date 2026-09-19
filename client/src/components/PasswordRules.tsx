import { PASSWORD_RULES } from "../lib/passwordRules";
import { Icon } from "./Icon";

/**
 * The BR-07 checklist, ticking as the user types (AC-10, ui-spec.md §4).
 *
 * One component for every password field that sets a password — the user's own
 * change, and an Administrator issuing a starting one (ui-spec.md §8) — so the
 * two cannot drift into describing different rules.
 */
export const PasswordRules = ({ password }: { password: string }) => (
  <ul aria-label="Password requirements" className="tkt-password-rules">
    {PASSWORD_RULES.map((rule) => {
      const met = rule.satisfiedBy(password);

      return (
        <li
          className={
            met
              ? "tkt-password-rule tkt-password-rule--met"
              : "tkt-password-rule"
          }
          key={rule.id}
        >
          <Icon name={met ? "check" : "pending"} />
          {/* The state is in the text as well as the icon: a colour and a tick
              are not available to a screen reader. */}
          <span>{rule.label}</span>
          <span className="tkt-visually-hidden">
            {met ? " — met" : " — not yet met"}
          </span>
        </li>
      );
    })}
  </ul>
);
