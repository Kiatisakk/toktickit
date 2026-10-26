import type { TicketAction } from "../lib/api";
import { formatWhen } from "../lib/formatWhen";
import { Badge } from "./Badge";
import { Button } from "./Button";

/**
 * One Action's fields as read-only values (ui-spec.md section 6, View).
 *
 * A definition list rather than disabled inputs: these are values to read, and
 * a disabled control is a label with nothing to say about why it cannot be
 * used. Every value is a React text child, never markup (BR-31), and wraps
 * rather than widening the page.
 */

const Value = ({ text }: { text: string | null }) =>
  text === null || text === "" ? (
    <span className="tkt-action-view__none">None</span>
  ) : (
    <>{text}</>
  );

interface ActionViewProps {
  action: TicketAction;
  onClose: () => void;
}

export const ActionView = ({ action, onClose }: ActionViewProps) => (
  <section
    aria-label={`Action #${action.id}`}
    className="tkt-action-form tkt-action-view"
  >
    <h3 className="tkt-action-form__title">Action #{action.id}</h3>

    <dl className="tkt-action-view__fields">
      <div>
        <dt>State</dt>
        <dd>
          <Badge kind="action" value={action.state} />
        </dd>
      </div>
      <div>
        <dt>Date/time</dt>
        <dd>
          <time dateTime={action.actionAt}>{formatWhen(action.actionAt)}</time>
        </dd>
      </div>
      <div className="tkt-action-view__wide">
        <dt>Description</dt>
        <dd>
          <Value text={action.description} />
        </dd>
      </div>
      <div className="tkt-action-view__wide">
        <dt>Result</dt>
        <dd>
          <Value text={action.result} />
        </dd>
      </div>
      <div>
        <dt>Performed by</dt>
        <dd>{action.performedBy.name}</dd>
      </div>
      <div>
        <dt>Recorded by</dt>
        <dd>{action.recordedBy.name}</dd>
      </div>
      <div>
        <dt>Follow-up required</dt>
        <dd>{action.followUpRequired ? "Yes" : "No"}</dd>
      </div>
      <div>
        <dt>Follow-up status</dt>
        <dd>
          <Badge kind="followUp" value={action.followUpState} />
        </dd>
      </div>
      <div className="tkt-action-view__wide">
        <dt>Follow-up note</dt>
        <dd>
          <Value text={action.followUpNote} />
        </dd>
      </div>
      <div>
        <dt>Follows up</dt>
        <dd>
          {action.followsUpId === null ? (
            <Value text={null} />
          ) : (
            `Action #${action.followsUpId}`
          )}
        </dd>
      </div>
      <div className="tkt-action-view__wide">
        <dt>Attachment notes</dt>
        <dd>
          <Value text={action.attachmentNotes} />
        </dd>
      </div>
      {action.state === "CANCELLED" ? (
        <div className="tkt-action-view__wide">
          <dt>Cancellation reason</dt>
          <dd>
            <Value text={action.cancelReason} />
          </dd>
        </div>
      ) : null}
      <div>
        <dt>Recorded</dt>
        <dd>
          <time dateTime={action.createdAt}>
            {formatWhen(action.createdAt)}
          </time>
        </dd>
      </div>
      <div>
        <dt>Last updated</dt>
        <dd>
          <time dateTime={action.updatedAt}>
            {formatWhen(action.updatedAt)}
          </time>
        </dd>
      </div>
    </dl>

    {action.state === "PLANNED" ? null : (
      <p className="tkt-field-hint">This action can no longer be changed.</p>
    )}

    <div className="tkt-actions">
      <Button onClick={onClose}>Close</Button>
    </div>
  </section>
);
