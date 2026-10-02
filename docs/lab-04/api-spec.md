# Lab 4 API Specification

Companion to [specification.md](specification.md). Paths, shapes, status codes and failure behaviour for every endpoint **added or changed** in the Lab 4 increment. Everything not listed here is unchanged from [Lab 3's API specification](../lab-03/api-spec.md) (§10 below).

---

## 1. Conventions

Unchanged from Lab 3: base path `/api`; session cookie `toktickit.session`; identity from the cookie alone; the error envelope `{ "error": { "code", "message", "details"? } }` with `details` keyed by field name and present only for field-level failures; JSON bodies; `credentials: "include"` on the client. No error body discloses a stack trace, a path, a database message or the existence of something the caller may not see (BR-32).

**Strict bodies.** As in Lab 3, an endpoint refuses a body carrying a field it does not accept (`400 VALIDATION_FAILED`, the field named in `details`) rather than ignoring it. `recordedById`, `state`, `version` where not accepted, `createdAt` and any identity field are therefore refused, not silently dropped, on Action endpoints.

**Timestamps** are ISO 8601 strings in UTC (`2026-10-05T03:15:00.000Z`). Dashboard day boundaries are calculated in Asia/Bangkok on the server (BR-23); no client time is ever sent.

**Check order for writes** (BR-20): body shape `400` → existence and scope `404` → `version` `409 STALE_UPDATE` → state `409` / `400 INVALID_STATUS_TRANSITION` → resolution gate `400 RESOLUTION_GATE_FAILED`. Authentication and role checks (`401`, `403`) run before all of them, and a Requester is refused `403` on every Action write before the body is read.

## 2. Status codes

| Code | Used for |
| --- | --- |
| `200` | A successful read, or a successful change that returns the new state |
| `201` | An Action was created |
| `200` | (also) An Action create repeated with the same `requestId`: the existing Action is returned and nothing is written |
| `400` | Malformed JSON, failed field validation, invalid query parameter, invalid transition, resolution gate failed, ineligible performer |
| `401` | No session, or an expired or deleted one |
| `403` | The role forbids this, or a password change is outstanding |
| `404` | The resource does not exist, or is outside the caller's ownership scope |
| `409` | **New this sprint for conflicts:** stale `version`, Action not editable, Ticket not actionable. (Lab 3's uses of `409` — duplicate email, last Administrator, self-deactivation — are unchanged.) |
| `413`, `415`, `500` | Unchanged |

## 3. Error codes

### Introduced this sprint

| Code | Status | Raised when |
| --- | --- | --- |
| `STALE_UPDATE` | 409 | A write names a `version` that is no longer the stored one, on a Ticket or an Action |
| `RESOLUTION_GATE_FAILED` | 400 | A transition to Resolved where at least one gate condition is unmet; `details` names each |
| `ACTION_ASSIGNEE_INELIGIBLE` | 400 | `performedById` is not an active IT Staff or Administrator (inactive, a Requester, or unknown) |
| `ACTION_NOT_EDITABLE` | 409 | An edit, completion or cancellation of an Action that is Done or Cancelled |
| `ACTION_NOT_FOUND` | 404 | An Action id that does not exist, or whose Ticket is outside the caller's scope |
| `TICKET_NOT_ACTIONABLE` | 409 | An Action write on a Ticket that is Resolved, Closed or Cancelled |
| `REQUEST_ID_CONFLICT` | 409 | An Action create whose `requestId` already exists on that Ticket with different field values |

### Changed

`INVALID_STATUS_TRANSITION` (400) is no longer returned for the race "the ticket moved while this change was being made". That case is now `STALE_UPDATE` (409). The code still answers a transition outside the matrix.

### Retained

Every Lab 3 code: `UNAUTHENTICATED` · `INVALID_CREDENTIALS` · `ACCOUNT_INACTIVE` · `PASSWORD_CHANGE_REQUIRED` · `FORBIDDEN` · `EMAIL_ALREADY_EXISTS` · `LAST_ACTIVE_ADMIN` · `CANNOT_DEACTIVATE_SELF` · `USER_NOT_FOUND` · `TICKET_OWNER_INELIGIBLE` · `VALIDATION_FAILED` · `INVALID_QUERY_PARAMETER` · `REQUEST_TOO_LARGE` · `ROUTE_NOT_FOUND` · `TICKET_NOT_FOUND` · `ATTACHMENT_NOT_FOUND` · `ATTACHMENT_REMOVED` · `ATTACHMENT_LIMIT_REACHED` · `FILE_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `INTERNAL_ERROR`.

---

## 4. Actions Taken

### The Action resource

```json
{
  "id": 12,
  "ticketId": 7,
  "state": "DONE",
  "actionAt": "2026-10-05T03:15:00.000Z",
  "description": "Replaced the faulty access point on floor 3.",
  "result": "Signal restored; tested from three desks.",
  "followUpRequired": true,
  "followUpNote": "Confirm with the Requester after a week.",
  "followUpState": "OPEN",
  "followsUpId": null,
  "attachmentNotes": "Photo of the old unit is in the shared folder IT-2026/AP-3.",
  "cancelReason": null,
  "recordedBy": { "id": 11, "name": "Michael Brown" },
  "performedBy": { "id": 12, "name": "Ploy Chaiyo" },
  "version": 3,
  "createdAt": "2026-10-05T02:50:00.000Z",
  "updatedAt": "2026-10-05T03:20:00.000Z"
}
```

- `state` is `PLANNED`, `DONE` or `CANCELLED` (BR-03).
- `followUpState` is derived on every read, never stored (BR-09): `NOT_REQUIRED` when `followUpRequired` is false; `VOID` when the Action is Cancelled; otherwise `CLOSED` if a Done Action has this one as its `followsUpId`, else `OPEN`.
- `result`, `followUpNote`, `attachmentNotes`, `followsUpId` and `cancelReason` are explicit `null`, never absent keys.
- `recordedBy` and `performedBy` carry `id` and `name` only.

### `GET /api/tickets/:id/actions`

**Roles.** Requester (own Tickets only), IT Staff, Administrator. A Requester asking for another Requester's Ticket, or a Ticket that does not exist, receives the same `404 TICKET_NOT_FOUND` (BR-31, AC-07).

**Response `200`** — `{ "data": [Action, …] }`, ordered by `actionAt` ascending then `id` ascending (FR-03). Not paginated (A-03). A Ticket with no Actions answers `{ "data": [] }`. A Requester receives every Action and every field (BR-12).

### `POST /api/tickets/:id/actions`

**Roles.** IT Staff and Administrator. A Requester is refused `403 FORBIDDEN`.

**Request**

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `requestId` | string (UUID) | yes | Client-generated, one per intentional create, resent unchanged on retry (BR-35, D-24) |
| `description` | string | yes | 1–2000 characters after trimming (BR-14) |
| `actionAt` | string (ISO 8601 instant) | no | Not more than one minute in the future; default server now |
| `result` | string or `null` | no | 1–2000 if given; may be empty while Planned (BR-06) |
| `performedById` | integer | no | Default the caller; must be active IT Staff or Administrator (BR-07) |
| `followUpRequired` | boolean | no | Default `false` |
| `followUpNote` | string or `null` | iff `followUpRequired` | 1–1000 when required; must be absent or `null` otherwise (BR-08) |
| `attachmentNotes` | string or `null` | no | At most 1000 characters |
| `followsUpId` | integer or `null` | no | An Action on the same Ticket that requires follow-up and is not Cancelled (BR-10) |

The new Action is `PLANNED`, `version` 1, with `recordedBy` the caller. Creation locks the Ticket row, so it serialises with a resolution (BR-16, AC-27).

**Idempotency (BR-35).** After the body is validated and the Ticket found, the server looks for an Action with this `(ticketId, requestId)`. If one exists and every submitted field equals its stored value, the response is `200` with that Action and nothing is written, even when the Ticket has since been Resolved. If one exists and any field differs, the response is `409 REQUEST_ID_CONFLICT`. Otherwise the Action is created. Two simultaneous requests with one key are serialised by the Ticket lock and the unique `(ticketId, requestId)` constraint: one creates, the other replays. A different `requestId` always creates a new Action.

**Response `201`** — the Action (`200` for a replay). The Action resource does not expose `requestId`.

| Condition | Status | Code |
| --- | --- | --- |
| Body not an object, unexpected field, wrong type, bound exceeded | 400 | `VALIDATION_FAILED`, field in `details` |
| `requestId` missing or not a UUID | 400 | `VALIDATION_FAILED`, `details.requestId` |
| `followsUpId` invalid | 400 | `VALIDATION_FAILED`, `details.followsUpId` |
| `requestId` exists with different fields | 409 | `REQUEST_ID_CONFLICT` |
| `performedById` ineligible | 400 | `ACTION_ASSIGNEE_INELIGIBLE` |
| Ticket absent | 404 | `TICKET_NOT_FOUND` |
| Ticket Resolved, Closed or Cancelled | 409 | `TICKET_NOT_ACTIONABLE` |

### `PATCH /api/actions/:id`

Edit a **Planned** Action. IT Staff and Administrator; any of them, not only the creator (BR-11).

**Request** — `version` (integer, required) plus at least one of `actionAt`, `description`, `result`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes`, with the same rules as creation. `ticketId`, `recordedById`, `state`, `followsUpId`, `cancelReason` and timestamps are not editable and are refused. After the change, Follow-Up Required and Follow-Up Note must still satisfy BR-08; setting `followUpRequired` to `false` on an Action that another Action already follows up is refused `400 VALIDATION_FAILED` (`details.followUpRequired`, BR-10).

**Response `200`** — the Action, `version` incremented.

| Condition | Status | Code |
| --- | --- | --- |
| Missing or non-integer `version` | 400 | `VALIDATION_FAILED`, `details.version` |
| Other validation failure | 400 | `VALIDATION_FAILED` |
| `performedById` ineligible | 400 | `ACTION_ASSIGNEE_INELIGIBLE` |
| Action absent | 404 | `ACTION_NOT_FOUND` |
| `version` stale | 409 | `STALE_UPDATE` |
| Action is Done or Cancelled | 409 | `ACTION_NOT_EDITABLE` |
| Ticket Resolved, Closed or Cancelled | 409 | `TICKET_NOT_ACTIONABLE` |

### `POST /api/actions/:id/complete`

**Request** — `{ "version": integer, "result"?: string }`. When `result` is given (1–2000) it replaces the stored one. After applying it, the Action must have a non-empty Result (BR-06).

**Response `200`** — the Action, now `DONE`, `version` incremented. Failures: as `PATCH`, with a missing Result answering `400 VALIDATION_FAILED`, `details.result`. Two staff completing at once: one `200`, the other `409 STALE_UPDATE` (AC-25).

### `POST /api/actions/:id/cancel`

**Request** — `{ "version": integer, "cancelReason": string }`, reason 1–500 after trimming (BR-05).

**Response `200`** — the Action, now `CANCELLED`, with the reason, `version` incremented. Only a Planned Action can be cancelled, and a Planned Action never closed a follow-up, so cancelling one changes no follow-up's state (BR-09). Failures: as `PATCH`, with a missing reason answering `400 VALIDATION_FAILED`, `details.cancelReason`.

There is **no** endpoint that deletes an Action or moves it out of Done or Cancelled (BR-04).

---

## 5. Ticket writes — changed

### The three staff `PATCH` endpoints

`PATCH /api/staff/tickets/:id/owner`, `/it-priority` and `/status`. **Changed from Lab 3:** each accepted exactly one named field; each now accepts that field **plus `version`**, and `/status` additionally accepts `resolutionSummary`. Anything else is still refused.

| Endpoint | Request |
| --- | --- |
| `/owner` | `{ "ownerId": number \| null, "version": integer }` |
| `/it-priority` | `{ "itPriority": "LOW" \| "MEDIUM" \| "HIGH" \| null, "version": integer }` |
| `/status` | `{ "status": TicketStatus, "version": integer, "resolutionSummary"?: string }` |

`version` is required on all three. Success is `200` with the updated Ticket in the shape `GET /api/tickets/:id` returns, now carrying `version` (incremented by one). Every other Lab 3 failure is unchanged.

| Condition | Status | Code |
| --- | --- | --- |
| `version` missing or not an integer | 400 | `VALIDATION_FAILED`, `details.version` |
| `version` no longer the stored one | 409 | `STALE_UPDATE` |

**Changed from Lab 3:** the "the ticket moved while this change was being made" refusal was `400 INVALID_STATUS_TRANSITION`; it is now `409 STALE_UPDATE` (D-07, D-16).

### `PATCH /api/staff/tickets/:id/status` and the resolution gate

`resolutionSummary` is 1–2000 characters after trimming (BR-17). It is **required only when `status` is `RESOLVED`**. Sending it with any other target is `400 VALIDATION_FAILED` (`details.resolutionSummary`); omitting or blanking it when resolving is a gate failure (below), not a shape error, so that the user sees every unmet condition together.

The gate (BR-16) runs after the matrix check, inside the transition's transaction with the Ticket row locked. All four conditions are evaluated; every unmet one is reported:

```json
{
  "error": {
    "code": "RESOLUTION_GATE_FAILED",
    "message": "This ticket cannot be resolved yet.",
    "details": {
      "doneAction": "Record at least one completed action before resolving.",
      "openFollowUp": "2 follow-ups are still open.",
      "plannedActions": "Complete or cancel the 1 planned action before resolving.",
      "resolutionSummary": "Enter a resolution summary."
    }
  }
}
```

Only the keys for unmet conditions are present: `doneAction`, `openFollowUp`, `plannedActions`, `resolutionSummary`. The refusal is `400`, the Ticket is unchanged, and nothing is written to the history (BR-21).

On success the Ticket's status becomes `RESOLVED`, `resolutionSummary` is stored (trimmed), `version` increments, and one history row is appended in the same transaction (AC-19, AC-23). Transitions to any other status evaluate no gate condition (AC-20). A Requester's resolved indication does not satisfy any condition (BR-18).

### Order of failures on `/status`

`400` body shape → `404` → `409 STALE_UPDATE` → `400 INVALID_STATUS_TRANSITION` → `400 RESOLUTION_GATE_FAILED`.

### Ticket responses

`GET /api/tickets/:id` (Requester and staff), the staff PATCH responses, and Ticket creation now include `version` (integer). List rows and queue rows are unchanged. Ticket creation additionally writes the `null → NEW` history row in its transaction; its request and response shape are otherwise unchanged.

### `POST /api/tickets/:id/resolved-indication`

Unchanged in request, response and roles. It now increments the Ticket's `version` (BR-19) and sends none; a staff member editing at that moment may therefore see `409 STALE_UPDATE` and must reload. It writes no history row (it is not a status change).

---

## 6. List filters — additive

### `statusGroup` — `GET /api/tickets` and `GET /api/staff/tickets`

`statusGroup=open` narrows to Tickets whose status is **not** Resolved, Closed or Cancelled (BR-24). It is the only accepted value. It cannot be combined with `status`; doing so, or sending any other value, answers `400 INVALID_QUERY_PARAMETER` with the parameter named. A blank value is treated as absent (Lab 3 BR-34). It composes with every other filter and with the Requester's ownership scope.

### `followUp` — `GET /api/staff/tickets` only

`followUp=mine` narrows to Tickets having at least one **open follow-up** (BR-09) on an Action whose `performedById` is the caller. It is the only accepted value and resolves to the signed-in user, so no identity travels in the query (BR-29). Sending it to `GET /api/tickets`, or any other value, is `400 INVALID_QUERY_PARAMETER`, consistent with how Lab 3 refuses queue-only parameters on My Tickets. A blank value is treated as absent.

Both parameters are added to the shared query parser's allowlists; there is no second parser (Lab 3 D-12).

---

## 7. Dashboards

Dashboard endpoints return **concise metrics**, never Ticket collections (handout §6.2). The only rows are the bounded recent list (at most five).

Both responses share one card shape:

```json
{
  "key": "new",
  "label": "New",
  "count": 14,
  "delta": 3,
  "drillDown": { "path": "/staff/tickets", "query": { "status": "NEW" } }
}
```

- `count` is an integer, `0` when nothing matches; the card is still returned (BR-27).
- `delta` is today's count minus the count at the start of today in Asia/Bangkok (BR-23); an integer (possibly `0` or negative) on status cards, and `null` on cards that have none (BR-25). A Requester dashboard card always has `delta: null`.
- `drillDown.path` is a client route and `query` its query string parameters, defined by the backend (BR-34). For "my" cards the backend writes the caller's own id into `ownerId`; `followUp=mine` carries none.

A recent Ticket:

```json
{ "id": 7, "ticketNumber": "TKT-2026-000007", "summary": "…",
  "currentStatus": "IN_PROGRESS", "updatedAt": "…" }
```

### `GET /api/dashboard/staff`

**Roles.** IT Staff and Administrator. A Requester is refused `403 FORBIDDEN`.

**Response `200`**

```json
{
  "generatedAt": "2026-10-05T03:20:00.000Z",
  "timeZone": "Asia/Bangkok",
  "cards": [ Card ×8 ],
  "recentTickets": [ RecentTicket, … ],
  "quickActions": [
    { "key": "create-ticket", "label": "Create Ticket", "path": "/tickets/new" },
    { "key": "search-tickets", "label": "Search Tickets", "path": "/staff/tickets" },
    { "key": "my-queue", "label": "My Queue", "path": "/staff/tickets", "query": { "ownerId": "11", "statusGroup": "open" } }
  ]
}
```

`cards` are always eight, in this order, with these keys, counts (specification.md §5.2) and drill-downs:

| `key` | `label` | `delta` | `drillDown.query` |
| --- | --- | --- | --- |
| `new` | New | integer | `status=NEW` |
| `open` | Open | integer | `status=OPEN` |
| `in-progress` | In Progress | integer | `status=IN_PROGRESS` |
| `waiting` | Waiting for Requester | integer | `status=WAITING_FOR_REQUESTER` |
| `reopened` | Reopened | integer | `status=REOPENED` |
| `my-assigned` | My Assigned | `null` | `ownerId=<caller>&statusGroup=open` |
| `unassigned` | Unassigned | `null` | `unassigned=true&statusGroup=open` |
| `my-follow-ups` | My open follow-ups | `null` | `followUp=mine` |

`recentTickets` are the caller's own owned Tickets, at most five, ordered `updatedAt` descending then `id` descending (BR-26); `[]` when none. An Administrator receives the same response, calculated for themselves (A-05).

### `GET /api/dashboard/requester`

**Roles.** Requester only. IT Staff and Administrator are refused `403 FORBIDDEN` (BR-28); they use the staff dashboard.

**Response `200`** — `generatedAt`, `timeZone`, `cards` (four), `recentTickets`, `quickActions`. Every count is over Tickets with `requesterId` equal to the caller, resolved inside the query (Lab 3 BR-19); there is no parameter by which another Requester's data could be asked for (AC-02, AC-33).

| `key` | `label` | `drillDown` |
| --- | --- | --- |
| `open` | Open | `/my-tickets?statusGroup=open` |
| `waiting-for-me` | Waiting for me | `/my-tickets?status=WAITING_FOR_REQUESTER` |
| `resolved` | Resolved | `/my-tickets?status=RESOLVED` |
| `closed` | Closed | `/my-tickets?status=CLOSED` |

`recentTickets` are the caller's own Tickets, at most five, same ordering; `quickActions` are Create Ticket (`/tickets/new`) and View My Tickets (`/my-tickets`).

### Failures

| Condition | Status | Code |
| --- | --- | --- |
| No session | 401 | `UNAUTHENTICATED` |
| Wrong role | 403 | `FORBIDDEN` |
| Password change outstanding | 403 | `PASSWORD_CHANGE_REQUIRED` |
| Any query parameter | 400 | `INVALID_QUERY_PARAMETER` — the endpoints take none |
| Database failure | 500 | `INTERNAL_ERROR`, no detail |

---

## 8. Authorization summary

Read against specification.md §5. `403` is a role refusal; `404` is out of scope.

| Endpoint | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| `GET /api/tickets/:id/actions` | Own → 404 otherwise | Any | Any |
| `POST /api/tickets/:id/actions` | **403** | Yes | Yes |
| `PATCH /api/actions/:id` | **403** | Yes, any Planned | Yes, any Planned |
| `POST /api/actions/:id/complete` | **403** | Yes | Yes |
| `POST /api/actions/:id/cancel` | **403** | Yes | Yes |
| `PATCH /api/staff/tickets/:id/{owner,it-priority,status}` | **403** | Yes | Yes |
| `GET /api/dashboard/requester` | Yes | **403** | **403** |
| `GET /api/dashboard/staff` | **403** | Yes | Yes |

Every row also answers `401` without a session and `403 PASSWORD_CHANGE_REQUIRED` while a password change is outstanding. Hiding a control is not authorization; every cell is enforced here (BR-31).

## 9. What is not in this API

No Action delete; no endpoint for the status history; no bulk Action operations; no pagination of Actions; no Action file upload (Attachment Notes is text); no dashboard filters or date-range parameters; no export; no notifications.

## 10. Unchanged from Lab 3

Authentication (`/api/auth/*`), password change and its gate, reference data, `POST` and `GET /api/tickets` and `GET /api/tickets/:id` (apart from carrying `version`, and the additive `statusGroup`), attachments, Public Comments, Internal Notes, `GET /api/staff/owners`, the Administrator user endpoints, `GET /api/health`, the error envelope, and the ownership `404` / role `403` split.
