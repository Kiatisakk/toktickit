# Lab 2 Test Plan and Results

Companion to [`specification.md`](./specification.md). Every acceptance criterion in that
document maps to at least one test here, and every test names the file it will live in.

**Status of this document.** Written before implementation, as §9 requires — the plan is
the contract, not a report assembled afterwards from whatever the coding agent happened to
generate. The `Result` column reads `Planned` until the test exists and runs; each
implementation Issue updates its own rows as part of the same Pull Request.

---

## 1. Test Strategy

Six levels, chosen so that each failure is diagnosed at the cheapest level that can see it.

| Level | Tool | Answers |
| --- | --- | --- |
| Unit | Vitest | Is this rule correct in isolation? |
| API / integration | Vitest + Supertest, real PostgreSQL | Does the endpoint honour the contract, including ownership and failure? |
| UI component | Vitest + React Testing Library, jsdom | Does the screen behave — states, messages, disabled controls? |
| UI style | Vitest + React Testing Library | Are the required classes, labels, asterisks and accessible names present? |
| Responsive / visual | Playwright | Does it survive a real layout engine at three widths? |
| E2E | Playwright | Does the whole journey work in a browser? |

**Why style splits across two tools.** jsdom has no layout engine, so it can assert that an
element carries `tkt-field--invalid` but cannot tell you the resulting colour, whether text
is clipped, or whether the page scrolls sideways. Class and state assertions therefore live
in Vitest where they are fast; computed colour, overflow and clipping live in Playwright
where they are real.

**Databases.** API tests run against `toktickit_test`, seeded with reference data only, so
counts and pagination are deterministic. The demonstration data used for screenshots lives
in the development database and is never touched by a test run.

---

## 2. Planned Tests

### Unit

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | AC-09, BR-04 | Ticket number generator output shape | Matches `TKT-<4 digits>-<6 digits>` | `server/tests/lab-02/ticket-number.test.ts` | Planned |
| UNIT-02 | BR-04 | Sequence increments, and restarts at `000001` in a new year | `TKT-2026-000001` follows `TKT-2025-000412` | `server/tests/lab-02/ticket-number.test.ts` | Planned |
| UNIT-03 | AC-10, BR-13, BR-14 | Trim-then-validate helper | Whitespace-only fails; boundary lengths 5/150 and 10/5000 behave correctly | `server/tests/lab-02/validation.test.ts` | Planned |
| UNIT-04 | AC-15 | Query parser accepts every documented parameter | Returns the normalised query object | `server/tests/lab-02/ticket-query.test.ts` | Planned |
| UNIT-05 | AC-16, BR-34 | Query parser rejects the undocumented | Unknown key, bad enum, `pageSize=15`, `page=0` each throw naming the parameter | `server/tests/lab-02/ticket-query.test.ts` | Planned |
| UNIT-06 | BR-24 | Filename sanitiser | Path separators, traversal segments and control characters removed; extension preserved | `server/tests/lab-02/filename.test.ts` | Planned |
| UNIT-07 | AC-19, BR-21–23 | Attachment rule evaluation | Type, size and active-count rules each reject independently | `server/tests/lab-02/attachment-rules.test.ts` | Planned |

### API / integration

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| API-01 | AC-01, AC-04, BR-07 | Seed idempotency and required counts | Second run changes nothing, ids included; 4 categories, 7 related systems, 4 active and 1 inactive requester | `server/tests/lab-02/seed.api.test.ts` | **Pass** |
| API-02 | AC-01, BR-07 | `GET /api/requesters` | Only active requesters; the inactive one is absent; no role or active flag exposed | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-21 | AC-08 | `GET /api/related-systems` and `/api/categories` | Active rows only, in display order rather than alphabetically | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-03 | AC-04, BR-03, BR-07, BR-20 | Context header validation | Missing, blank, malformed, unknown and inactive each return `400` with their own code; no response leaks a path or a database message | `server/tests/lab-02/requester-context.api.test.ts` | **Pass** |
| API-04 | AC-09 | `POST /api/tickets` happy path | `201`; one row; status `NEW`; owner is the context; number returned | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-05 | AC-10, BR-18 | Field validation | Each rule returns `400 VALIDATION_FAILED` with `details` naming the field; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | AC-11, BR-11 | Body cannot override ownership | Ticket is owned by the header's requester, not the body's | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-07 | AC-09, BR-01 | Concurrent creation | Parallel creates yield distinct numbers; no duplicate survives | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-08 | AC-14, FR-10 | List ownership | Requester B's list contains none of Requester A's tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-09 | AC-15 | Search, filters, sorting | Each documented parameter narrows or orders as specified | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-10 | AC-15, BR-32 | Pagination stability | With identical `createdAt` values, paging the whole set returns every row exactly once | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-11 | AC-16, BR-34 | Invalid query parameters | `400 INVALID_QUERY_PARAMETER` naming the parameter; never a silent default | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-12 | AC-18, BR-12 | Detail ownership | Another requester's ticket and a nonexistent id return identical `404` bodies | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-13 | AC-19 | Attachment upload | `201`; metadata stored; file present under a generated name | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-14 | AC-19, BR-21–23 | Upload rejections | Disallowed type `415`; oversized `413`; sixth active `409` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-15 | AC-20, BR-25 | Download | `200` with `Content-Disposition: attachment` for every permitted type, images included | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-16 | AC-21, BR-26, BR-27 | Soft removal | Row survives with removal time, reason and remover; reason outside 3–500 rejected | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-17 | AC-22, BR-28, BR-29 | After removal | Download returns `404`; a new upload is accepted because the slot is free | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-18 | AC-23, BR-30 | Compensation | Forced metadata failure leaves no file on disk and no row | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-19 | AC-24, BR-20 | Safe errors | No response contains a stack trace, filesystem path, database message or configuration value | `server/tests/lab-02/error-envelope.api.test.ts` | Planned |
| API-20 | AC-18 | Cross-requester attachment access | Metadata, download and removal each return `404` for another requester's attachment | `server/tests/lab-02/attachments.api.test.ts` | Planned |

### UI component

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | AC-02 | Selector states | Loading, empty and failure each render their own block, each with the right next action | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-02 | AC-03, BR-03 | Selector wording | Screen says it is not a login screen, that Lab 3 brings authentication, and never uses the words "sign in" or "log in" | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-03 | AC-04, BR-10 | Route guard | Opening My Tickets with no context renders the selector, and waits rather than redirecting while a stored id is still resolving | `client/tests/lab-02/RequesterGuard.test.tsx` | **Pass** |
| UI-04 | AC-05, BR-07 | Context persistence | A stored id resolves back to its requester; one that is no longer active is discarded rather than trusted | `client/tests/lab-02/RequesterContext.test.tsx` | **Pass** |
| UI-05 | AC-06, BR-08 | Switching clears data | Selecting a different requester persists the change and bumps the generation scoped screens key off | `client/tests/lab-02/RequesterContext.test.tsx` | **Pass** |
| UI-06 | AC-07, BR-09 | Switching mid-draft | Draft discarded and navigation lands on My Tickets | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-07 | AC-08 | Reference data source | Options render from the mocked API; none are hard-coded | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-08 | AC-10 | Field-level messages | Each message renders adjacent to its control, not in a top summary | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-09 | AC-12, BR-17 | Busy submit | Button disabled and `aria-busy` while the request is in flight | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-10 | AC-13, BR-19 | Failure preserves input | After a rejected request every entered value is still in the form | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-11 | AC-17, BR-35 | Empty vs no-results | Different text and different actions | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-12 | AC-18, FR-16 | Detail is read-only | No input, no status control, no comment box | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-13 | AC-21, BR-27 | Attachment add and remove | Confirmation requires a reason; confirm stays disabled below 3 characters | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-14 | AC-22 | Removed attachment | Metadata shown with a Removed badge and no Download control | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |

### UI style

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | AC-25 | Required marker | Asterisk present and `aria-hidden`; control marked `required`; message appears as well as the asterisk | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-02 | AC-25 | Read-only vs editable | Distinct classes; read-only controls are not editable; invalid and disabled each carry their own modifier | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-03 | AC-25 | Button hierarchy | Primary, secondary, destructive, disabled and busy each carry their class; busy sets `aria-busy` and disables; neither busy nor disabled can be activated | `client/tests/lab-02/style/buttons.test.tsx` | **Pass** |
| STYLE-04 | AC-25 | Badges | Every badge renders its word, so meaning does not depend on colour | `client/tests/lab-02/style/badges.test.tsx` | Planned |
| STYLE-05 | AC-25 | Accessible names | Navigation toggle carries a name, `aria-expanded` and `aria-controls`; decorative icons are `aria-hidden`; both landmarks are named | `client/tests/lab-02/style/shell.test.tsx` | **Pass** |
| STYLE-06 | AC-25 | Labels and message wiring | Every control is reachable by its label; `aria-describedby` points at the message; `aria-invalid` set when invalid | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-07 | AC-25, BR-35 | Shell and state blocks | Active nav marked by class **and** `aria-current`; breadcrumb marks the current page; empty and no-results carry different `data-state` values | `client/tests/lab-02/style/shell.test.tsx` | **Pass** |

### Responsive and visual

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| RESP-01 | AC-25 | Three screens × three viewports | No horizontal page overflow at any combination | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-02 | AC-25 | List adapts below 768 px | Table replaced by cards; no column of data lost | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-03 | AC-25 | Attachment filenames | Fully readable at every viewport; not truncated | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-04 | AC-25 | Zen Green tokens | Computed colours of header, primary button and active nav match §7 | `e2e/lab-02/visual.spec.ts` | Planned |

### End-to-end

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-09, 19, 20, 21, 22 | The full journey | Select requester → create ticket → see the number → find it in My Tickets → open it → add, download and remove an attachment → removed file no longer downloadable | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | AC-06, AC-14 | Requester isolation | Switching from A to B removes A's tickets from view | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | AC-18 | Direct URL access | Opening A's ticket URL while B is current is rejected | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
| --- | --- |
| AC-01 | API-01, API-02 |
| AC-02 | UI-01 |
| AC-03 | UI-02 |
| AC-04 | API-03, UI-03 |
| AC-05 | UI-04 |
| AC-06 | UI-05, E2E-02 |
| AC-07 | UI-06 |
| AC-08 | API-21, UI-07 |
| AC-09 | UNIT-01, UNIT-02, API-04, API-07, E2E-01 |
| AC-10 | UNIT-03, API-05, UI-08 |
| AC-11 | API-06 |
| AC-12 | UI-09 |
| AC-13 | UI-10 |
| AC-14 | API-08, E2E-02 |
| AC-15 | UNIT-04, API-09, API-10 |
| AC-16 | UNIT-05, API-11 |
| AC-17 | UI-11 |
| AC-18 | API-12, API-20, UI-12, E2E-03 |
| AC-19 | UNIT-07, API-13, API-14, E2E-01 |
| AC-20 | API-15, E2E-01 |
| AC-21 | API-16, UI-13, E2E-01 |
| AC-22 | API-17, UI-14, E2E-01 |
| AC-23 | API-18 |
| AC-24 | API-19 |
| AC-25 | STYLE-01…07, RESP-01…04 |

No acceptance criterion is unmapped, and no planned test exists without a criterion to
justify it.

---

## 4. Responsive and Visual Checklist

The checklist itself lives in [`ui-spec.md` §9](./ui-spec.md#9-visual-inspection-checklist).
Completed results are recorded here once the screens exist.

| Screen | Desktop ≥ 992 | Tablet 768–991 | Mobile < 768 |
| --- | --- | --- | --- |
| Create Ticket | Pending | Pending | Pending |
| My Tickets | Pending | Pending | Pending |
| Ticket Detail | Pending | Pending | Pending |

---

## 5. Test Commands

```bash
docker compose up -d              # PostgreSQL on host port 5433
npm run db:migrate                # migrate, then generate the Prisma client
npm run db:seed                   # reference data — idempotent
npm run db:seed:demo              # demonstration tickets (development database only)
npm run db:test:setup             # migrate + reference seed into toktickit_test

npm test                          # unit, API, UI component, UI style
npm run test:e2e                  # Playwright: E2E, responsive, visual, screenshots
npm exec -- ultracite check       # lint and format
```

---

## 6. Final Results

Filled in as each Issue merges; completed before the release Pull Request.

| Suite | Files | Tests | Passing | Recorded on |
| --- | --- | --- | --- | --- |
| Server (unit + API) | 5 | 36 | 36 | 2026-08-23 (Issue #16) |
| Client (component + style) | 9 | 76 | 76 | 2026-08-23 (Issue #16) |
| End-to-end | — | — | — | — |

---

## 7. Known Limitations and Deferred Tests

- **Duplicate submission across browser tabs is not covered.** The control is the disabled
  busy button (BR-17), which is per-document. Two tabs submitting the same draft
  simultaneously would create two tickets. Closing this needs a server-side idempotency
  key, which the handout does not ask for; the decision is recorded as D-09 in the
  specification rather than left to be discovered.
- **Virus scanning of uploads is out of scope** and therefore untested. Type checking is by
  extension, declared media type, and content signature — none of which establishes that a
  permitted file is safe, only that it is what it claims to be.
- **API-18 forces a metadata failure by injection** rather than by producing a genuine
  database error, since the real failure is not reproducible on demand. The test proves the
  compensation path runs, not that the specific database error triggers it.
- **Status filtering has only one reachable value in Lab 2.** Every ticket is `NEW`, so the
  filter is exercised by asserting that a query for any other status returns the
  no-results state. That is the honest coverage available until Lab 4 introduces
  transitions.
