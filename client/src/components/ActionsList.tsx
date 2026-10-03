import type { TicketAction } from "../lib/api";
import { formatWhen } from "../lib/formatWhen";
import { Badge } from "./Badge";
import { Button } from "./Button";

/**
 * The Actions of one Ticket (ui-spec.md section 6, List).
 *
 * One table at every width. Below 768px the stylesheet lays each row out as a
 * card, carrying every cell as a labelled line (`data-label`), so no column is
 * lost on a phone and no second copy of the rows exists to disagree with the
 * first. From 768px the table scrolls inside its own container, never the page.
 */

export type ActionRowCommand = "view" | "edit" | "complete" | "cancel";

interface ActionsListProps {
  actions: TicketAction[];
  /** Whether the Edit, Complete and Cancel controls are drawn at all. */
  writable: boolean;
  onCommand: (command: ActionRowCommand, action: TicketAction) => void;
}

export const ActionsList = ({
  actions,
  writable,
  onCommand,
}: ActionsListProps) => (
  <div className="tkt-table-scroll tkt-actions-scroll">
    <table className="tkt-actions-table">
      <caption className="tkt-visually-hidden">Actions taken</caption>
      <thead>
        <tr>
          <th scope="col">Date/time</th>
          <th scope="col">Description</th>
          <th scope="col">Performed by</th>
          <th scope="col">State</th>
          <th scope="col">Follow-up</th>
          <th scope="col">
            <span className="tkt-visually-hidden">Row actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {actions.map((action) => (
          <tr key={action.id}>
            <td data-label="Date/time">
              <time dateTime={action.actionAt}>
                {formatWhen(action.actionAt)}
              </time>
              <span className="tkt-actions-table__id">#{action.id}</span>
            </td>
            <td className="tkt-actions-table__text" data-label="Description">
              <p className="tkt-actions-table__description">
                {action.description}
              </p>
              {action.result ? (
                <p className="tkt-actions-table__result">
                  <span className="tkt-actions-table__result-label">
                    Result:{" "}
                  </span>
                  {action.result}
                </p>
              ) : null}
            </td>
            <td data-label="Performed by">{action.performedBy.name}</td>
            <td data-label="State">
              <Badge kind="action" value={action.state} />
            </td>
            <td data-label="Follow-up">
              <Badge kind="followUp" value={action.followUpState} />
              {action.followsUpId === null ? null : (
                <span className="tkt-actions-table__links">
                  Follows up #{action.followsUpId}
                </span>
              )}
            </td>
            <td className="tkt-actions-table__row-actions">
              <Button
                aria-label={`View action #${action.id}`}
                onClick={() => onCommand("view", action)}
              >
                View
              </Button>
              {writable && action.state === "PLANNED" ? (
                <>
                  <Button
                    aria-label={`Edit action #${action.id}`}
                    onClick={() => onCommand("edit", action)}
                  >
                    Edit
                  </Button>
                  <Button
                    aria-label={`Complete action #${action.id}`}
                    onClick={() => onCommand("complete", action)}
                  >
                    Complete
                  </Button>
                  <Button
                    aria-label={`Cancel action #${action.id}`}
                    onClick={() => onCommand("cancel", action)}
                    variant="danger"
                  >
                    Cancel action
                  </Button>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
