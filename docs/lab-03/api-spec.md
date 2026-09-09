# Lab 3 API Specification

Companion to [specification.md](specification.md). Paths, shapes, status codes and failure behaviour for every endpoint in the Lab 3 increment.

---

## 1. Conventions

**Base path.** Every endpoint is under `/api`. Anything under `/api` that matches no route answers `404` with `ROUTE_NOT_FOUND`.

**Authentication.** A session token travels in a cookie named `toktickit.session`, set `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside local development. The token never appears in a request or response body, in a URL, or in a log line. There is no `Authorization` header and no bearer token (D-01).

**Who a request is from** is determined only by that cookie. No endpoint reads an identity from the request body, from a query parameter, or from a header. A body containing a `requesterId` is not an error — the field is simply never read (BR-03, AC-03).

**Authorization** is applied on the server for every protected endpoint (BR-17). The tables below state the permitted roles per endpoint; the full matrix is in specification.md §5.

**Error envelope.** Every failure answers with the same shape, unchanged from Lab 2:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details": { "email": "…" } } }
```

`details` is present only for field-level validation failures and is keyed by field name. No error body contains a stack trace, a file path, a database message, or the existence of a resource the caller may not see (BR-20).

**Content type** is `application/json` for every endpoint except attachment upload (`multipart/form-data`) and attachment download (the file's own type).

---

## 2. Status codes

| Code | Used for |
| --- | --- |
| `200` | A successful read, or a successful change that returns the new state |
| `201` | A resource was created |
| `204` | A successful change with nothing to return |
| `400` | Malformed JSON, failed field validation, or an invalid query parameter |
| `401` | No session, an expired or deleted session, or invalid sign-in credentials |
| `403` | Authenticated, but the role forbids this, or a password change is outstanding |
| `404` | The resource does not exist, or is outside the caller's ownership scope |
| `409` | Duplicate email, last active Administrator, or self-deactivation |
| `413` | Request body larger than the configured limit |
| `415` | Unsupported attachment type |
| `500` | Unexpected server error, with no internal detail disclosed |

## 3. Error codes

### Introduced this sprint

| Code | Status | Raised when |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No session cookie, or the session is expired, deleted, or belongs to a user who is no longer active |
| `INVALID_CREDENTIALS` | 401 | Sign-in with an unknown email address or an incorrect password |
| `ACCOUNT_INACTIVE` | 403 | Sign-in where the password verified but the account is deactivated |
| `PASSWORD_CHANGE_REQUIRED` | 403 | Any endpoint other than the three permitted while the flag is set |
| `FORBIDDEN` | 403 | Authenticated, but the role does not permit this operation |
| `EMAIL_ALREADY_EXISTS` | 409 | Creating or editing a user into an address another account holds |
| `LAST_ACTIVE_ADMIN` | 409 | A change that would leave the system with no active Administrator |
| `CANNOT_DEACTIVATE_SELF` | 409 | An Administrator deactivating their own account |
| `INVALID_STATUS_TRANSITION` | 400 | A status change outside the permitted matrix |
| `TICKET_OWNER_INELIGIBLE` | 400 | Assigning ownership to a user who is not an active IT Staff or Administrator |
| `USER_NOT_FOUND` | 404 | An Administrator endpoint naming a user id that does not exist |

### Retained from Lab 2

`VALIDATION_FAILED` · `INVALID_QUERY_PARAMETER` · `REQUEST_TOO_LARGE` · `ROUTE_NOT_FOUND` · `TICKET_NOT_FOUND` · `ATTACHMENT_NOT_FOUND` · `ATTACHMENT_REMOVED` · `ATTACHMENT_LIMIT_REACHED` · `FILE_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `INTERNAL_ERROR`

### Retired

`REQUESTER_CONTEXT_REQUIRED` · `REQUESTER_CONTEXT_INVALID` · `REQUESTER_CONTEXT_UNKNOWN` · `REQUESTER_CONTEXT_INACTIVE`

All four answered `400` and described a header that no longer exists. Their situations are now `401 UNAUTHENTICATED`. They are deleted rather than aliased, so that this document does not describe responses nothing produces (see specification.md §8, and D-06 for the 403/404 split these codes sit inside).

---

## 4. Authentication

### `POST /api/auth/login`

Public. Establishes a session.

**Request** — `{ "email": string, "password": string }`

**200** — sets the session cookie and returns

```json
{
  "user": { "id": 1, "name": "Jennifer Anderson", "email": "…", "role": "REQUESTER" },
  "mustChangePassword": false
}
```

**Failures**

| Condition | Status | Code |
| --- | --- | --- |
| Missing or blank email or password | 400 | `VALIDATION_FAILED` |
| Unknown email address | 401 | `INVALID_CREDENTIALS` |
| Known email, wrong password | 401 | `INVALID_CREDENTIALS` |
| Correct password, deactivated account | 403 | `ACCOUNT_INACTIVE` |

The first two are byte-for-byte identical, so the form cannot be used to discover which addresses have accounts (BR-08, AC-05). The third is reachable only after the password has verified, so an attacker who does not know the password cannot distinguish a deactivated account from an absent one (BR-09, D-04).

Signing in does not disturb sessions already open (BR-12).

### `POST /api/auth/logout`

Any authenticated user, including one with an outstanding password change.

**204** — deletes the session row and clears the cookie. Reusing the token afterwards answers `401 UNAUTHENTICATED`, indistinguishable from a token that never existed (BR-13, AC-07).

Calling this without a session also answers `204`. Signing out is idempotent; refusing would disclose whether a token was live.

### `GET /api/auth/me`

Any authenticated user, including one with an outstanding password change.

**200** — `{ "user": { id, name, email, role }, "mustChangePassword": boolean }`

**401** `UNAUTHENTICATED` — no session, expired session, or the session's user has since been deactivated (BR-15, AC-11).

This is what the client calls on load to decide whether anyone is signed in. It is the only identity source in the browser; nothing is stored client-side (D-13).

### `POST /api/auth/password`

Any authenticated user, including — and especially — one with an outstanding password change.

**Request** — `{ "currentPassword": string, "newPassword": string }`

**204** — clears the must-change flag, deletes every other session belonging to this user, and rotates the current session's token, setting the new cookie (BR-14, AC-09).

**Failures**

| Condition | Status | Code |
| --- | --- | --- |
| `currentPassword` does not match | 401 | `INVALID_CREDENTIALS` |
| `newPassword` fails length or composition | 400 | `VALIDATION_FAILED` with `details.newPassword` |
| `newPassword` equals `currentPassword` | 400 | `VALIDATION_FAILED` with `details.newPassword` |

Password rules: 8–128 characters, at least one upper-case letter, one lower-case letter, one digit and one special character (BR-07). The message names the rule that failed; it never echoes the password.

### The password-change gate

While `mustChangePassword` is set, every endpoint **except** `GET /api/auth/me`, `POST /api/auth/password` and `POST /api/auth/logout` answers `403 PASSWORD_CHANGE_REQUIRED` (BR-02, FR-11, AC-02). The gate is a guard in the middleware chain, not a restricted session (D-05).

---

## 5. Reference data

| Endpoint | Roles | Notes |
| --- | --- | --- |
| `GET /api/health` | **Public** | Stays unauthenticated: the end-to-end harness polls it to decide the server has started, before any account exists in that run |
| `GET /api/categories` | Any authenticated | Active categories in display order |
| `GET /api/related-systems` | Any authenticated | Active related systems in display order |

`GET /api/requesters` is **removed**. It existed only to populate the Development Requester selector, and both are gone (BR-41).

Categories and related systems required no authentication in Lab 2 because the selector needed them before any identity existed. That reason has disappeared, so they are now authenticated like everything else.

---

## 6. Requester tickets and attachments

Paths, request shapes, response shapes and status codes are **unchanged from Lab 2**. The only difference is where identity comes from: the session cookie rather than the request header. This is Lab 2's BR-36 being honoured literally (BR-40).

| Endpoint | Roles | Scope |
| --- | --- | --- |
| `POST /api/tickets` | Any authenticated | Ticket is recorded against the caller |
| `GET /api/tickets` | Any authenticated | The caller's own tickets only, whatever their role |
| `GET /api/tickets/:id` | Any authenticated | Requester: own only. IT Staff and Administrator: any |
| `GET /api/tickets/:id/attachments` | Any authenticated | Same scope as ticket detail |
| `POST /api/tickets/:id/attachments` | Any authenticated | Requester: own only. Staff: any |
| `GET /api/attachments/:id/download` | Any authenticated | Requester: own only. Staff: any |
| `DELETE /api/attachments/:id` | Any authenticated | **Own only, every role** — see below |

**Scope is applied inside the database query, never by fetching a row and comparing afterwards** (BR-19). A single helper maps the caller's role to a query fragment — a constraint that the ticket is theirs for a Requester, no constraint for IT Staff and Administrators (D-08).

A Requester requesting a ticket that belongs to someone else therefore matches nothing and receives `404 TICKET_NOT_FOUND` — the same bytes as a ticket that does not exist (BR-18, AC-12).

Attachment **removal** stays scoped to the ticket's requester for every role, including staff. FR-29 grants IT Staff only to view and download; letting them soft-remove a requester's evidence is a destructive capability no requirement asks for, and it would arrive by way of a table cell rather than a decision.

`GET /api/tickets` is deliberately scoped to the caller for every role, including staff: it is "my tickets", and staff raise tickets too (FR-30, D-07). The all-tickets view is §7.

### Ticket list query

Unchanged from Lab 2 and reused by the staff queue (D-12).

| Parameter | Values | Blank value |
| --- | --- | --- |
| `search` | Free text, matched against ticket number and summary | Treated as absent |
| `categoryId` | Positive integer | Treated as absent |
| `requestedPriority` | `LOW` \| `MEDIUM` \| `HIGH` | Treated as absent |
| `itPriority` | `LOW` \| `MEDIUM` \| `HIGH` | Treated as absent |
| `status` | A `TicketStatus` value | Treated as absent |
| `sort` | `ticketNumber` \| `createdAt` \| `updatedAt` \| `summary` \| `requestedPriority` | **Rejected** |
| `order` | `asc` \| `desc` | **Rejected** |
| `page` | Positive integer | **Rejected** |
| `pageSize` | `10` \| `20` \| `50` | **Rejected** |

Filters treat a blank value as "no filter" because a dropdown set to *All* submits an empty string. Paging and sorting parameters reject a blank value rather than silently defaulting, because a blank there means the caller sent something wrong (AC-16).

Default order is `createdAt desc`, with `id desc` as a secondary key so that pagination cannot repeat or skip a row when two tickets share a timestamp.

Invalid values answer `400 INVALID_QUERY_PARAMETER` with `details` naming each offending parameter.

**Response** — `{ "items": [...], "page": n, "pageSize": n, "total": n, "totalPages": n }`

---

## 7. IT Staff queue and ticket operations

All of §7 is IT Staff and Administrator only. A Requester receives `403 FORBIDDEN` (BR-18, AC-13).

### `GET /api/staff/tickets`

The queue. Same query contract as §6, with additional filters:

| Parameter | Values |
| --- | --- |
| `ownerId` | Positive integer — tickets owned by that user |
| `unassigned` | `true` — tickets with no owner |
| `requesterId` | Positive integer — tickets raised by that user |

`ownerId` and `unassigned` are mutually exclusive; sending both answers `400 INVALID_QUERY_PARAMETER`.

The queue also accepts three sort fields the Requester list does not: `itPriority`, `currentStatus` and `ticketOwner`. They are added to the shared parser's allowlist rather than parsed separately, which is what D-12 means by extending it — a Requester sending them is refused, because they are not in the Requester scope's allowlist.

Each item carries the ticket's requester, owner (or `null`), both priorities, status, and the "problem appears resolved" timestamp (or `null`).

### `PATCH /api/staff/tickets/:id/owner`

**Request** — `{ "ownerId": number | null }`

`null` releases ownership. A caller claiming a ticket for themselves sends their own id.

| Condition | Status | Code |
| --- | --- | --- |
| Ticket absent | 404 | `TICKET_NOT_FOUND` |
| `ownerId` is not an active IT Staff or Administrator | 400 | `TICKET_OWNER_INELIGIBLE` |

Reassignment is permitted regardless of who currently owns the ticket; there is no "only the owner may hand it on" rule this sprint (BR-21, AC-17, AC-18).

### `PATCH /api/staff/tickets/:id/it-priority`

**Request** — `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" | null }`

Requested Priority is never touched (BR-22, BR-23, AC-19).

### `PATCH /api/staff/tickets/:id/status`

**Request** — `{ "status": TicketStatus }`

| Condition | Status | Code |
| --- | --- | --- |
| Transition not permitted from the current status | 400 | `INVALID_STATUS_TRANSITION` |
| Ticket is `CANCELLED` | 400 | `INVALID_STATUS_TRANSITION` |

The permitted transitions are in specification.md §5. The response returns the ticket's new state. A refused transition leaves the ticket unchanged (AC-20, AC-21).

---

## 8. Public Comments and Internal Notes

Two separate resources on two separate tables, so that a requester-facing query cannot reach note content by forgetting a filter (D-09).

### `GET /api/tickets/:id/comments` · `POST /api/tickets/:id/comments`

Any authenticated user, scoped exactly like ticket detail: a Requester on their own ticket, staff on any.

**POST request** — `{ "body": string }` · **201** returns the created comment with its author and creation time.

Author and timestamp are taken from the session and the server clock; both are ignored if supplied (BR-29).

Body is 1–5000 characters after trimming; whitespace-only is refused with `400 VALIDATION_FAILED` (BR-30, AC-26).

### `GET /api/tickets/:id/notes` · `POST /api/tickets/:id/notes`

**IT Staff and Administrator only.**

A Requester receives `403 FORBIDDEN` with no body content and no indication of whether the ticket has notes — including when the ticket is their own, and including when it has none (BR-32, AC-04, AC-25).

Same body rules as comments. Both resources are append-only: there is no `PATCH` and no `DELETE` (BR-28).

### `POST /api/tickets/:id/resolved-indication`

**Requester only**, and only on a ticket they own. Any other role receives `403 FORBIDDEN`.

**204** — records the timestamp. The ticket's status is unchanged (BR-05, BR-27, AC-22).

Sending it twice is idempotent. There is no endpoint by which a Requester can set a status; the attempt has no route to make (AC-23).

---

## 9. Administrator user management

All of §9 is Administrator only. An unauthenticated request receives `401 UNAUTHENTICATED`; an authenticated Requester or IT Staff receives `403 FORBIDDEN` (AC-14, and the last row of §11).

### `GET /api/admin/users`

| Parameter | Values | Blank value |
| --- | --- | --- |
| `search` | Free text, matched against name and email | Treated as absent |
| `role` | `REQUESTER` \| `IT_STAFF` \| `ADMIN` | Treated as absent |

Returns every matching user with `{ id, name, email, role, isActive }`. **Not paginated** — §8.5 of the handout excludes pagination for this list, and the seeded population is small enough that adding it would be inventing a requirement.

Password hashes are never included in any response.

### `POST /api/admin/users`

**Request** — `{ "name": string, "email": string, "role": Role, "isActive": boolean, "initialPassword": string }`

**201** — creates the user with the must-change flag set, and returns the user without any credential.

| Condition | Status | Code |
| --- | --- | --- |
| Email already held by another account | 409 | `EMAIL_ALREADY_EXISTS` |
| Invalid role value | 400 | `VALIDATION_FAILED` |
| `initialPassword` fails the rules | 400 | `VALIDATION_FAILED` |
| Name or email missing or malformed | 400 | `VALIDATION_FAILED` |

Exactly one role. There is no array and no second role field (BR-16).

### `PATCH /api/admin/users/:id`

**Request** — any subset of `{ "name", "email", "role", "isActive" }`

| Condition | Status | Code |
| --- | --- | --- |
| Email already held by another account | 409 | `EMAIL_ALREADY_EXISTS` |
| Deactivating the caller's own account | 409 | `CANNOT_DEACTIVATE_SELF` |
| The change would leave no active Administrator | 409 | `LAST_ACTIVE_ADMIN` |
| User absent | 404 | `USER_NOT_FOUND` |

Self-*demotion* is deliberately **not** caught by the self-check: FR-38 and BR-34 forbid deactivating your own account and say nothing about your own role. A sole Administrator demoting themselves is refused by the last-Administrator check instead, which is what makes `LAST_ACTIVE_ADMIN` reachable outside a race and AC-32 testable at all.

The last-Administrator check counts and writes inside one transaction that locks the Administrator rows, so two Administrators submitting mutually deactivating changes cannot both observe a safe count and both proceed (BR-35, D-14, AC-33).

Deactivating a user takes effect on that user's next request, because the session record caches nothing about them (BR-15, AC-11).

### `POST /api/admin/users/:id/password`

**Request** — `{ "initialPassword": string }`

**204** — replaces the user's password hash, sets the must-change flag, and deletes all of that user's sessions.

An Administrator never learns an existing password; this endpoint only overwrites (BR-37, AC-29).

---

## 10. What is not in this API

Per §4.2 and §8.5 of the handout: no user deletion, no bulk operations, no import or export, no role history, no multi-role assignment, no email delivery of any kind, no password-reset flow, no self-registration, no account unlocking, and no approval workflow.

There is no endpoint that accepts an identity from the caller. There is no test-only authentication bypass, gated on an environment variable or otherwise (D-15).

---

## 11. Authorization summary

Read against specification.md §5's matrix. `403` means the role is refused; `404` means the resource is outside scope and answers as absent.

| Endpoint group | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| `/api/auth/*` | Yes | Yes | Yes |
| `/api/categories`, `/api/related-systems` | Yes | Yes | Yes |
| `POST`/`GET /api/tickets` | Yes, own | Yes, own | Yes, own |
| `GET /api/tickets/:id` and attachments | Own → 404 otherwise | Any | Any |
| `/api/tickets/:id/comments` | Own → 404 otherwise | Any | Any |
| `/api/tickets/:id/resolved-indication` | Own → 404 otherwise | 403 | 403 |
| `/api/tickets/:id/notes` | **403** | Any | Any |
| `/api/staff/*` | **403** | Yes | Yes |
| `/api/admin/*` | **403** | **403** | Yes |
