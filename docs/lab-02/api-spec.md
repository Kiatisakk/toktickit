# Lab 2 API Contract

TokTickIT REST API. Companion to [`specification.md`](./specification.md).

Base URL in development: `http://localhost:3000`

---

## 1. Requester context

Every endpoint below marked **scoped** requires this header:

```http
X-Development-Requester-Id: 1
```

It is validated before anything else happens. The value must parse as a positive integer,
match an existing `User`, and that user must be active.

| Situation | Status | Code |
| --- | --- | --- |
| Header absent | `400` | `REQUESTER_CONTEXT_REQUIRED` |
| Not a positive integer | `400` | `REQUESTER_CONTEXT_INVALID` |
| No such user | `400` | `REQUESTER_CONTEXT_UNKNOWN` |
| User exists but is inactive | `400` | `REQUESTER_CONTEXT_INACTIVE` |

This header is forgeable by anyone. It is a test fixture, not a credential — see BR-03.
Lab 3 replaces it with an authenticated identity and nothing else in this contract
changes (BR-36).

---

## 2. Error envelope

Every failure returns this shape and nothing else.

```jsonc
{
  "error": {
    "code": "VALIDATION_FAILED",       // stable, machine-readable
    "message": "The ticket could not be created.",
    "details": {                        // present only for field validation
      "summary": "Summary must be at least 5 characters.",
      "description": "Description is required."
    }
  }
}
```

`details` is keyed by field name so the form can place each message beside its control
(§8.3). Responses never carry stack traces, database messages, filesystem paths, or
configuration values (BR-20).

### Status codes

| Code | Meaning here |
| --- | --- |
| `200` | Retrieval, download, soft removal |
| `201` | Ticket or attachment created |
| `400` | Invalid field, invalid query parameter, invalid or missing requester context |
| `404` | Resource absent — or owned by a different requester (BR-12, D-07) |
| `409` | Active-attachment limit reached |
| `413` | File larger than 5 MB |
| `415` | File type not permitted |
| `500` | Unexpected failure, reported safely |

### Codes used across endpoints

`REQUESTER_CONTEXT_*` · `VALIDATION_FAILED` · `INVALID_QUERY_PARAMETER` ·
`TICKET_NOT_FOUND` · `ATTACHMENT_NOT_FOUND` · `ATTACHMENT_LIMIT_REACHED` ·
`ATTACHMENT_REMOVED` · `FILE_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `INTERNAL_ERROR`

---

## 3. Reference data

### `GET /api/health`

Unchanged from Lab 1. Deliberately does not touch the database.

```json
{ "status": "ok", "service": "TokTickIT API" }
```

### `GET /api/categories`

Active categories in display order. Not scoped.

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

### `GET /api/related-systems`

Active related systems in display order. Not scoped.

```json
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" },
  { "id": 3, "name": "VPN" }
]
```

### `GET /api/requesters`

Active Development Requesters for the selector. Not scoped — it is what populates the
context in the first place. Inactive users never appear (BR-07).

```json
[
  { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.ac.th" },
  { "id": 2, "name": "Michael Brown",     "email": "michael.brown@example.ac.th" }
]
```

---

## 4. Tickets

### `POST /api/tickets` — scoped

Creates one ticket owned by the context. `201` on success.

**Request**

```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idle.",
  "requestedPriority": "MEDIUM"
}
```

A `requesterId` in this body is ignored (BR-11).

**Response `201`**

```json
{
  "id": 42,
  "ticketNumber": "TKT-2025-000042",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idle.",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requester": { "id": 1, "name": "Jennifer Anderson" },
  "ticketOwner": null,
  "resolutionSummary": null,
  "attachments": [],
  "createdAt": "2026-08-19T09:14:22.481Z",
  "updatedAt": "2026-08-19T09:14:22.481Z"
}
```

**Validation** — all applied after trimming, and all enforced again on the server
regardless of what the client checked.

| Field | Rule | Message key on failure |
| --- | --- | --- |
| `summary` | required, 5–150 chars | `summary` |
| `description` | required, 10–5000 chars | `description` |
| `categoryId` | required, exists, active | `categoryId` |
| `relatedSystemId` | required, exists, active | `relatedSystemId` |
| `requestedPriority` | required, one of `LOW` `MEDIUM` `HIGH` | `requestedPriority` |

**Failures**

| Status | Code | When |
| --- | --- | --- |
| `400` | `REQUESTER_CONTEXT_*` | Context header problem |
| `400` | `VALIDATION_FAILED` | Any field rule broken; `details` names each one |
| `500` | `INTERNAL_ERROR` | Anything unexpected |

Ticket number and status are assigned by the server (BR-01, BR-02, BR-04, BR-05).

---

### `GET /api/tickets` — scoped

Returns only tickets owned by the context (FR-10).

**Query parameters**

| Parameter | Accepted values | Default |
| --- | --- | --- |
| `search` | free text; trimmed; case-insensitive match on ticket number or summary | — |
| `categoryId` | positive integer | — |
| `requestedPriority` | `LOW` `MEDIUM` `HIGH` | — |
| `itPriority` | `LOW` `MEDIUM` `HIGH` | — |
| `status` | `NEW` `OPEN` `IN_PROGRESS` `PENDING` `RESOLVED` `CLOSED` | — |
| `sort` | `ticketNumber` `createdAt` `updatedAt` `summary` `requestedPriority` | `createdAt` |
| `order` | `asc` `desc` | `desc` |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | `10` `20` `50` | `10` |

A blank value (`?page=`) is not the same as an omitted one. `search`, `categoryId`,
`requestedPriority`, `itPriority`, and `status` treat `""` as "not supplied" — it is what a
cleared search box or an "All" dropdown sends, and is the one exception BR-34 makes. `sort`,
`order`, `page`, and `pageSize` have no such control behind them, so a blank value there is
rejected like any other invalid one rather than silently answered with the default.

Every sort is applied with the ticket `id` descending as a secondary key. Without it,
tickets sharing a `createdAt` — which the seed guarantees — could appear on two pages or
on none (BR-32).

**Response `200`**

```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-2025-000042",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "currentStatus": "NEW",
      "ticketOwner": null,
      "createdAt": "2026-08-19T09:14:22.481Z",
      "updatedAt": "2026-08-19T09:14:22.481Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "totalItems": 25, "totalPages": 3 }
}
```

**Failures**

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY_PARAMETER` | Unknown parameter, unknown enum value, `pageSize` outside the permitted set, `page` below 1, `sort`/`order` not in the allowed list, or `sort`/`order`/`page`/`pageSize` supplied blank |

`details` names the offending parameter and why. Parameters never fall back silently
(BR-34):

```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMETER",
    "message": "One or more query parameters are not valid.",
    "details": { "pageSize": "pageSize must be one of 10, 20, 50." }
  }
}
```

An owner with no tickets returns `data: []` with `totalItems: 0`. The client distinguishes
"no tickets at all" from "no matches" by whether any filter is active (BR-35) — the API
reports the same shape for both.

---

### `GET /api/tickets/:id` — scoped

One owned ticket plus its attachment metadata, active and removed.

**Response `200`** — the `POST` response shape, with `attachments` populated as in §5.

**Failures**

| Status | Code | When |
| --- | --- | --- |
| `404` | `TICKET_NOT_FOUND` | No such ticket **or** it belongs to another requester |

Those two cases produce byte-identical responses. `403` would confirm that another
requester's ticket exists, which is exactly what an attacker iterating identifiers wants
to learn (BR-12, D-07).

---

## 5. Attachments

Constraints are fixed by §4.5: JPEG, PNG, WEBP, PDF · 5 MB per file · at most five active
per ticket · removal is soft · removed files are neither downloadable nor previewable.

### Metadata shape

```json
{
  "id": 11,
  "originalFilename": "battery-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 284119,
  "uploadedAt": "2026-08-19T09:15:02.117Z",
  "uploadedBy": { "id": 1, "name": "Jennifer Anderson" },
  "status": "ACTIVE",
  "removedAt": null,
  "removedReason": null
}
```

A removed attachment keeps every field above, with `status: "REMOVED"` and the removal
fields populated. `storedFilename` is never exposed — it is an internal detail and
publishing it would invite path guessing (BR-24).

### `POST /api/tickets/:id/attachments` — scoped

`multipart/form-data`, field name `file`, one file per request. `201` on success,
returning the metadata shape.

Order of operations, which is what makes BR-30 hold:

1. Validate the context and the ticket's ownership.
2. Count active attachments; reject at five.
3. Validate declared type, extension, and size **in memory**, before anything is written.
4. Write to `server/uploads/` under a generated name.
5. Insert the metadata row.
6. If step 5 fails, delete the file written in step 4.

Validating before writing means a rejected upload never creates a file to clean up. The
compensation in step 6 exists for the one window that remains.

| Status | Code | When |
| --- | --- | --- |
| `404` | `TICKET_NOT_FOUND` | Absent, or owned by another requester |
| `409` | `ATTACHMENT_LIMIT_REACHED` | Five active attachments already |
| `413` | `FILE_TOO_LARGE` | Above 5 MB |
| `415` | `UNSUPPORTED_FILE_TYPE` | Not JPEG, PNG, WEBP, or PDF |
| `400` | `VALIDATION_FAILED` | No file part in the request |

### `GET /api/tickets/:id/attachments` — scoped

Metadata for one owned ticket, active and removed, newest upload first.

```json
{ "data": [ /* metadata objects */ ] }
```

### `GET /api/attachments/:id/download` — scoped

Streams the stored file for one active owned attachment.

```http
200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="battery-report.pdf"
Content-Length: 284119
```

`Content-Disposition: attachment` is unconditional, for every type including images.
Serving uploaded content inline from the application's own origin is how an upload becomes
script execution; forcing the download removes the question (BR-25, D-08).

The filename in the header is the sanitised original. The file on disk carries a generated
name that is never revealed.

| Status | Code | When |
| --- | --- | --- |
| `404` | `ATTACHMENT_NOT_FOUND` | Absent, or on a ticket owned by another requester |
| `404` | `ATTACHMENT_REMOVED` | Soft-removed — the file is not served (BR-28) |

### `DELETE /api/attachments/:id` — scoped

Soft removal. The row survives; the file becomes unreachable.

**Request**

```json
{ "reason": "Uploaded the wrong screenshot." }
```

`reason` is required and must be 3–500 characters after trimming (BR-27).

**Response `200`** — the metadata shape with `status: "REMOVED"`.

`DELETE` is the right verb even though the row survives: the contract describes what the
caller intends, not how the server stores it. If the storage strategy ever changes to a
hard delete, callers do not (D-08 sibling reasoning).

| Status | Code | When |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | Reason missing or outside 3–500 characters |
| `404` | `ATTACHMENT_NOT_FOUND` | Absent, or owned by another requester |
| `404` | `ATTACHMENT_REMOVED` | Already removed |

After removal the attachment stops counting toward the five-active limit (BR-29).

---

## 6. Ownership summary

Every scoped endpoint resolves ownership the same way: take the requester id from the
header, resolve the target's owning ticket, compare. Attachment routes resolve
`attachment → ticket → requester`; the flat `/api/attachments/:id` path does not weaken
this, because the check never depended on the URL shape.

Failure is always `404` with an identical body to a genuine miss. This is the property
Part 8 of the submission asks to see demonstrated.
