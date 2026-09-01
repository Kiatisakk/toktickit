/**
 * What a client is told about an attachment.
 *
 * `storedFilename` is absent by construction rather than deleted afterwards: a
 * shape that lists what may leave is a shape you can read to check, where a
 * shape that lists what must be stripped is one you have to trust nobody
 * forgot. The name on disk is an internal detail, and publishing it invites
 * path guessing (BR-24).
 */
export const ATTACHMENT_SHAPE = {
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  uploadedBy: { select: { id: true, name: true } },
  removedAt: true,
  removedReason: true,
  removedBy: { select: { id: true, name: true } },
} as const;

interface StoredAttachment {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: { id: number; name: string };
  removedAt: Date | null;
  removedReason: string | null;
  removedBy: { id: number; name: string } | null;
}

/**
 * Adds the one derived field: `status`.
 *
 * Derived from `removedAt` on the way out rather than stored beside it. Two
 * columns describing one fact admit a state where they disagree; with one
 * column that state is unreachable, and the client still gets the word it
 * wants to render (decision D-05).
 */
export const toAttachmentResponse = (attachment: StoredAttachment) => ({
  ...attachment,
  status: attachment.removedAt === null ? "ACTIVE" : "REMOVED",
});
