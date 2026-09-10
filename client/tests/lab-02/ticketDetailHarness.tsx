import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";

import { RequesterContext } from "../../src/context/requesterContextValue";
import type { AttachmentMetadata } from "../../src/lib/api";
import { TicketDetail } from "../../src/routes/TicketDetail";
import { CONTEXT, jsonResponse } from "../support/requester";

/**
 * Fixtures and a renderer shared by the two suites that exercise this screen.
 *
 * `RequesterTicketDetail.test.tsx` owns the screen itself — what it shows, what
 * it refuses to show, and the not-found state that must be indistinguishable
 * from a ticket belonging to someone else. `AttachmentSection.test.tsx` owns the
 * attachment lifecycle rendered inside it. §12 names both files, and both need
 * the same ticket to render against, so the fixtures live here rather than being
 * copied into each and drifting apart.
 */

// Re-exported so the two suites that already import these from here keep
// working unchanged; the definitions now live with the other fixtures.
export { CONTEXT, jsonResponse };

export const ATTACHMENT: AttachmentMetadata = {
  id: 11,
  originalFilename: "battery-report.pdf",
  mimeType: "application/pdf",
  sizeBytes: 284_119,
  uploadedAt: "2026-08-19T09:15:02.117Z",
  uploadedBy: { id: 1, name: "Jennifer Anderson" },
  status: "ACTIVE",
  removedAt: null,
  removedReason: null,
  removedBy: null,
};

export const TICKET = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  description: "It started after last week's update.",
  requestedPriority: "HIGH",
  itPriority: null,
  currentStatus: "NEW",
  resolutionSummary: null,
  createdAt: "2026-08-01T09:14:00.000Z",
  updatedAt: "2026-08-03T11:02:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requester: { id: 1, name: "Jennifer Anderson" },
  ticketOwner: null,
  attachments: [] as AttachmentMetadata[],
};

export const respond = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(jsonResponse(body, status)));

export const renderAt = (path = "/tickets/42") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RequesterContext.Provider value={CONTEXT}>
        <Routes>
          <Route element={<TicketDetail />} path="/tickets/:ticketId" />
        </Routes>
      </RequesterContext.Provider>
    </MemoryRouter>
  );
