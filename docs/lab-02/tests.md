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
| UNIT-01 | AC-09, BR-04 | Ticket number generator output shape | Matches `TKT-<4 digits>-<6 digits>`, including the exact values both labsheet figures print; refuses a sequence past `999999` or below `1` rather than producing a value its own pattern rejects | `server/tests/lab-02/ticket-number.test.ts` | **Pass** |
| UNIT-02 | BR-01, BR-04 | Sequence increments, restarts each year, and survives concurrency | Sequential claims advance; a new year restarts at `000001`; eight simultaneous claims yield eight distinct numbers | `server/tests/lab-02/ticket-number.test.ts` | **Pass** |
| UNIT-03 | AC-10, BR-11, BR-13, BR-14 | Trim-then-validate helper | Whitespace-only fails; both boundaries pass and one character outside each fails; padding never counts toward the limit; a `requesterId` in the body is not read | `server/tests/lab-02/validation.test.ts` | **Pass** |
| UNIT-04 | AC-15 | Query parser accepts every documented parameter | Returns the normalised query with defaults applied; search is trimmed; a blank filter is absent rather than a filter for nothing | `server/tests/lab-02/ticket-query.test.ts` | **Pass** |
| UNIT-05 | AC-16, BR-34 | Query parser rejects the undocumented | Unknown key, unlisted sort column, bad enum, `pageSize=15`, `page=0` each rejected by name; every offending parameter reported at once; the message says which values are allowed | `server/tests/lab-02/ticket-query.test.ts` | **Pass** |
| UNIT-06 | BR-24 | Stored filename generation | Nothing of the uploaded name survives but its extension; traversal segments and separators cannot reach it; fifty generations collide never | `server/tests/lab-02/attachment-rules.test.ts` | **Pass** |
| UNIT-07 | AC-19, BR-21–23 | Attachment rule evaluation | Each of the four permitted types accepted and four disallowed ones refused; a permitted type carrying a foreign extension refused; the limit exact at 5 MB; the removal reason bounded at 3 and 500 | `server/tests/lab-02/attachment-rules.test.ts` | **Pass** |

### API / integration

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| API-01 | AC-01, AC-04, BR-07 | Seed idempotency and required counts | Second run changes nothing, ids included; 4 categories, 7 related systems, 4 active and 1 inactive requester; a retired row is moved off its positive display slot | `server/tests/lab-02/seed.api.test.ts` | **Pass** |
| API-02 | AC-01, BR-07 | `GET /api/requesters` | Only active requesters; the inactive one is absent; no role or active flag exposed | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-21 | AC-08 | `GET /api/related-systems` and `/api/categories` | Active rows only, in display order rather than alphabetically | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-03 | AC-04, BR-03, BR-07, BR-20 | Context header validation | Missing, blank, malformed, non-positive, unsafe-integer, unknown, inactive and non-requester each return `400` with their own code; no response leaks a path or a database message | `server/tests/lab-02/requester-context.api.test.ts` | **Pass** |
| API-04 | AC-09, BR-02, BR-06 | `POST /api/tickets` happy path | `201`; one row; status `NEW`; owner is the context; server-issued number; IT priority, owner and resolution summary left unset | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-05 | AC-10, BR-18 | Field validation | All fourteen rejection cases — both text fields missing, whitespace-only, below minimum and above maximum, both reference ids missing and non-positive, and priority missing or outside the enum — each return `400 VALIDATION_FAILED` naming the field and store nothing; both boundaries are accepted; missing and retired reference rows are rejected; no ticket number is burned | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-06 | AC-11, BR-11 | Body cannot override ownership | Ticket is owned by the header's requester, not the body's; a missing context creates nothing | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-07 | AC-09, BR-01 | Concurrent creation | Eight parallel creates all return `201` with eight distinct numbers | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-08 | AC-14, FR-10 | List ownership | Requester B's list contains none of Requester A's tickets; ownership is a `where` clause so the count is the owner's too; the response omits `description` | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-09 | AC-15 | Search, filters, sorting | Search matches ticket number and summary case-insensitively; each filter narrows; filters combine rather than replace; sort and order both apply | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-10 | AC-15, BR-32 | Pagination stability | Every fixture shares a `createdAt` to the millisecond; paging the whole set returns each row exactly once and the same page twice returns the same rows | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-11 | AC-16, BR-34 | Invalid query parameters | `400 INVALID_QUERY_PARAMETER` naming the parameter for six cases including an unknown one; no `data` is returned, so nothing falls back | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-12 | AC-18, BR-12 | Detail ownership | Another requester's ticket and a nonexistent id return byte-identical `404` bodies, asserted by comparing the two responses rather than by asserting `404` twice | `server/tests/lab-02/ticket-detail.api.test.ts` | **Pass** |
| API-13 | AC-19 | Attachment upload | `201` with the metadata shape; `storedFilename` never present in the response | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-14 | AC-19, BR-21–23 | Upload rejections | Disallowed type `415`; oversized `413` and exactly-at-the-limit `201`; sixth active `409` | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-15 | AC-20, BR-25 | Download | `200` with `Content-Disposition: attachment` and `nosniff` for PDF, JPEG and PNG alike | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-16 | AC-21, BR-26, BR-27 | Soft removal | Row survives with removal time, reason and remover; a missing reason is `400`; a second removal is `404` | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-17 | AC-22, BR-28, BR-29 | After removal | The download URL that worked a moment ago returns `404 ATTACHMENT_REMOVED`; a new upload is accepted because the slot is free | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-18 | AC-23, BR-30 | Compensation | Forced metadata failure leaves no file on disk and no row | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-19 | AC-24, BR-20 | Safe errors | An unmatched `/api` path and a malformed JSON body both leave through the documented envelope, not Express's HTML default; neither echoes the rejected body nor a stack trace | `server/tests/lab-02/error-envelope.api.test.ts` | **Pass** |
| API-20 | AC-18 | Cross-requester attachment access | Upload, listing, download and removal each `404` for another requester; a stranger sending an invalid reason is told the attachment does not exist rather than that their reason is short | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-25 | BR-25, BR-30 | A row whose file has gone | Answers `500 INTERNAL_ERROR` rather than hanging; names neither the stored filename nor the upload directory | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-26 | BR-32 | Attachment ordering | The detail and listing endpoints return rows sharing an upload timestamp in the same order, and that order is stable across reads | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-27 | AC-18 | Detail identifier handling | `abc`, `1.5`, `-1`, `0`, `1e3` and a padded `1` are refused with the same `404` as a missing ticket | `server/tests/lab-02/ticket-detail.api.test.ts` | **Pass** |

### UI component

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | AC-02 | Selector states | Loading, empty and failure each render their own block; Continue is present and disabled while loading; empty and failure each carry an action | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-02 | AC-03, BR-03 | Selector wording | Screen says it is not a login screen, that Lab 3 brings authentication, and never uses the words "sign in" or "log in" | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-03 | AC-04, BR-10 | Route guard | Opening My Tickets with no context renders the selector, and waits rather than redirecting while a stored id is still resolving | `client/tests/lab-02/RequesterGuard.test.tsx` | **Pass** |
| UI-04 | AC-05, BR-07 | Context persistence | A stored id resolves back to its requester; one that is no longer active is discarded rather than trusted | `client/tests/lab-02/RequesterContext.test.tsx` | **Pass** |
| UI-05 | AC-06, BR-08 | Switching clears data | Selecting a different requester persists the change, bumps the generation scoped screens key off, and is not overwritten when the startup resolution lands late | `client/tests/lab-02/RequesterContext.test.tsx` | **Pass** |
| UI-06 | AC-07, BR-09 | Switching mid-draft | Draft discarded and navigation lands on My Tickets | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-07 | AC-08 | Reference data source | Options render from the mocked API; the fields stay disabled until they load; a load failure and an empty list each have their own state, and submit is disabled in both | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-08 | AC-10, AC-25 | Field-level messages | Each message renders inside its own field group; whitespace-only counts as empty; focus moves to the first invalid control; the API is never called for an invalid form | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-09 | AC-12, BR-17 | Busy submit | Button disabled and renamed while the request is in flight, leaving no enabled control to click again | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-10 | AC-13, BR-19 | Failure preserves input | Every entered value survives a failed submission; the message is readable rather than the exception; the control re-enables; server-reported field messages reach their field | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-11 | AC-17, BR-35 | Empty vs no-results | Different text, different actions and different `data-state`; filters are sent to the API rather than applied in the browser; a query change returns to page one | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-12 | AC-18, FR-16 | Detail is read-only | Every input carries `readonly` except the file picker; no comment box, no status control, and none of the three tab labels §4.2 excludes | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |
| UI-13 | AC-21, BR-27 | Attachment add and remove | Removal asks for confirmation rather than acting on the first click; confirm stays disabled below three characters | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |
| UI-14 | AC-22 | Removed attachment | Metadata and the removal reason stay visible; neither Download nor Remove is offered | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |
| UI-19 | AC-18 | A ticket that is not yours | One wording for "missing" and "someone else's", so the screen does not undo what the endpoint is careful about; a non-numeric path never calls the API | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |
| UI-20 | AC-19, BR-21 | The file picker | `accept` limited to the four permitted types, which is why the unsupported-type rejection is unreachable through the control and the failure test uses a size refusal | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |
| UI-21 | AC-19, BR-23 | The add control at the limit | Disabled at five active attachments, and says why | `client/tests/lab-02/TicketDetail.test.tsx` | **Pass** |

### UI style

| ID | Requirement / AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | AC-25 | Required marker | Asterisk present and `aria-hidden`; control marked `required`; message appears as well as the asterisk | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-02 | AC-25 | Read-only vs editable | Distinct classes; read-only controls are not editable; invalid and disabled each carry their own modifier | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-03 | AC-25 | Button hierarchy | Primary, secondary, destructive, disabled and busy each carry their class; busy sets `aria-busy` and disables; neither busy nor disabled can be activated | `client/tests/lab-02/style/buttons.test.tsx` | **Pass** |
| STYLE-04 | AC-25 | Badges | Every badge renders its word and a distinct label; an underscored enum reads as words; an unset value renders a dash with an accessible explanation rather than an empty cell | `client/tests/lab-02/style/badges.test.tsx` | **Pass** |
| STYLE-05 | AC-25 | Accessible names | Navigation toggle carries a name, `aria-expanded` and `aria-controls`; decorative icons are `aria-hidden`; both landmarks are named | `client/tests/lab-02/style/shell.test.tsx` | **Pass** |
| STYLE-06 | AC-25 | Labels and message wiring | Every control is reachable by its label; `aria-describedby` points at the message; `aria-invalid` set when invalid | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-07 | AC-25, BR-35 | Shell and state blocks | Active nav marked by class **and** `aria-current`; breadcrumb marks the current page; empty and no-results carry different `data-state` values | `client/tests/lab-02/style/shell.test.tsx` | **Pass** |
| STYLE-08 | AC-25 | Table and cards carry the same values | Every column the page 11 figure shows is present as a header and reachable from the mobile card; the current sort is announced with `aria-sort`; both link to the same detail screen | `client/tests/lab-02/style/ticket-table.test.tsx` | **Pass** |
| STYLE-09 | AC-25 | Page controls match the page 11 figure | Numbered page buttons rather than a "Page 1 of 6" caption; the current page carries `aria-current="page"` so it is not marked by colour alone; a long run is windowed to first, last and the current page's neighbours, with a gap only where pages are genuinely skipped | `client/tests/lab-02/style/pagination.test.tsx` | **Pass** |
| STYLE-10 | AC-25 | Table overflow stays inside its own container | `.tkt-table-scroll` wraps the table, is focusable and labelled, so the 768–991px band scrolls the table rather than the page | `client/tests/lab-02/style/ticket-table.test.tsx` | **Pass** |
| STYLE-12 | AC-25 | Icons support the label and never replace it | Every icon is `aria-hidden`, carries no text of its own, and maps our name to a Bootstrap glyph in one place | `client/tests/lab-02/style/badges.test.tsx` | **Pass** |
| STYLE-13 | AC-25 | A mark inside a control belongs to the control | The icon wraps the input rather than the field group, so a hint added beneath cannot move it | `client/tests/lab-02/style/fields.test.tsx` | **Pass** |
| STYLE-14 | AC-25 | The two badge columns cannot be confused | Every status has its own modifier; the element says which family it belongs to, so priority and status of the same hue stay distinguishable | `client/tests/lab-02/style/badges.test.tsx` | **Pass** |
| UI-18 | AC-14 | The page controls appear on the screen itself | Windowed numbers, the real total rather than the page length, a click asking the API for that page, and the table and controls sharing one surface | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| STYLE-11 | AC-25 | Create Ticket carries the fields Figure 1 shows | Ticket No., Ticket Date, Requester, Current Status and IT Priority are all read-only; status reads New per BR-02; the ticket fields are laid out four across | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-14 | AC-13, BR-34 | The ticket list response is validated in full | Every field the screen renders is checked, including `itPriority` and `ticketOwner`; one malformed row rejects the whole page as `UNEXPECTED_RESPONSE` | `client/tests/lab-02/api-contract.test.ts` | **Pass** |
| UI-15 | AC-13 | Loading shows skeleton rows with the filter bar live | Skeleton keeps the list's shape so nothing jumps on a refetch; one status line rather than eight; Search stays enabled | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-16 | AC-16 | A failed category load is stated, not silent | The filter is disabled and says why; the ticket list, which does not depend on it, still renders | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-17 | AC-13 | Retry runs through the effect that owns the abort | Try again re-enters the same effect, so a filter change during a slow retry cannot be overwritten by the stale response | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| API-22 | BR-34 | Repeated or nested query parameters are rejected | `?status=NEW&status=OPEN` and `?categoryId[gt]=1` are named as errors rather than read as absent and silently dropped | `server/tests/lab-02/ticket-query.test.ts` | **Pass** |
| API-23 | BR-33 | Page size is matched as text | `10.0`, `1e1`, `+10`, `0x0A` are refused; only the three spellings the contract names are accepted | `server/tests/lab-02/ticket-query.test.ts` | **Pass** |
| API-24 | AC-16 | The IT priority filter narrows the list | A fixture triaged directly in the database is the only row returned; the untriaged rows are excluded | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |

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
| AC-25 | STYLE-01, STYLE-02, STYLE-03, STYLE-04, STYLE-05, STYLE-06, STYLE-07, STYLE-08, RESP-01, RESP-02, RESP-03, RESP-04 |

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
| Server (unit + API) | 11 | 213 | 213 | 2026-08-30 (Issue #18) |
| Client (component + style) | 13 | 153 | 153 | 2026-08-30 (Issue #18) |
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
