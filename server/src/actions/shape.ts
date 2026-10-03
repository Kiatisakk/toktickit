import type { ActionState, FollowUpState } from "./domain.js";
import { followUpStateOf } from "./domain.js";

/**
 * What a client is told about an Action (api-spec.md §4).
 *
 * A list of what may leave, as `attachments/shape.ts` does: `requestId` is
 * absent by construction, not stripped afterwards (BR-35). `followedBy` is read
 * only to derive `followUpState` and is not forwarded.
 */
export const ACTION_SHAPE = {
  id: true,
  ticketId: true,
  state: true,
  actionAt: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  followsUpId: true,
  attachmentNotes: true,
  cancelReason: true,
  recordedBy: { select: { id: true, name: true } },
  performedBy: { select: { id: true, name: true } },
  version: true,
  createdAt: true,
  updatedAt: true,
  followedBy: { select: { state: true } },
} as const;

interface StoredAction {
  id: number;
  ticketId: number;
  state: ActionState;
  actionAt: Date;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  followsUpId: number | null;
  attachmentNotes: string | null;
  cancelReason: string | null;
  recordedBy: { id: number; name: string };
  performedBy: { id: number; name: string };
  version: number;
  createdAt: Date;
  updatedAt: Date;
  followedBy: { state: ActionState }[];
}

export interface ActionResponse extends Omit<StoredAction, "followedBy"> {
  followUpState: FollowUpState;
}

/** Adds the derived `followUpState` and drops what only derived it. */
export const toActionResponse = (action: StoredAction): ActionResponse => {
  const { followedBy, ...rest } = action;

  return {
    ...rest,
    followUpState: followUpStateOf(
      action,
      followedBy.map((follower) => follower.state)
    ),
  };
};
