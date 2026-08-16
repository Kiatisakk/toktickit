# Lab 1 — Automated Tests

All Lab 1 tests live under a `tests/lab-01/` folder. There are two, because the
API tests and the UI tests need different runtimes: the API tests run in Node
against a real database, the UI tests run in jsdom with `fetch` mocked.

Run everything from the repository root:

```bash
npm test
```

**14 tests across 5 files.** The API tests require a running, migrated and
seeded database — see [the README](../../README.md#setup).

## Test files

| Test File | Tool | Test Description |
| --- | --- | --- |
| `server/tests/lab-01/API-01.health.test.ts` | Supertest | Health endpoint returns 200 and expected JSON |
| `server/tests/lab-01/API-02.categories.test.ts` | Supertest | Categories endpoint returns the four seeded categories |
| `client/tests/lab-01/UI-01.heading.test.tsx` | Vitest | TokTickIT heading renders |
| `client/tests/lab-01/UI-02.loading-to-list.test.tsx` | Vitest | Loading state changes to category list |
| `client/tests/lab-01/UI-03.error-state.test.tsx` | Vitest | API failure displays a useful error message |

## Every test case

### API-01 — `GET /api/health` · Supertest · 2 cases

Supertest drives the exported Express app directly, so no port is bound and no
database is involved.

| # | Test case | What it proves |
| --- | --- | --- |
| 1 | returns HTTP 200 | The endpoint exists and answers |
| 2 | reports status ok for the TokTickIT API service | The body is exactly `{ "status": "ok", "service": "TokTickIT API" }` — asserted whole, so an extra field would fail |

### API-02 — `GET /api/categories` · Supertest · 4 cases

An **integration test**: it queries PostgreSQL through Prisma, because proving
the layers work together is the point of Lab 1.

| # | Test case | What it proves |
| --- | --- | --- |
| 1 | returns HTTP 200 | The endpoint answers |
| 2 | returns the four seeded categories | Account and Access, Hardware, Software, Network — read from the database, in that order |
| 3 | returns exactly an id and a name for every category | `displayOrder` decides the sort but is not part of the contract, so it must not leak into the response |
| 4 | orders by displayOrder rather than by id | Swaps two categories' positions **without touching their ids** and asserts the response order follows. Ordering is proven, not assumed |

### UI-01 — Landing page · Vitest · 3 cases

| # | Test case | What it proves |
| --- | --- | --- |
| 1 | renders the TokTickIT heading | The product name is on screen |
| 2 | offers a Check System button | The only control the brief asks for is present |
| 3 | shows no system status before the button is clicked | The page does **not** fetch on mount — the brief requires the status to appear only after a click |

### UI-02 — Success path · Vitest · 2 cases

`fetch` is mocked. These describe how the page reacts to the API, not whether
the API works; API-02 covers that.

| # | Test case | What it proves |
| --- | --- | --- |
| 1 | shows a loading state and then the categories from the API | The categories request is held open with a pending promise so the loading state is genuinely observable, rather than asserting on a race. Also checks the button is disabled while in flight |
| 2 | renders whatever the API returns rather than a hard-coded list | Returns a category that is **not** in the seed (`Printer`) and expects it on screen — this is what proves the list is not hard-coded |

### UI-03 — Failure paths · Vitest · 3 cases

| # | Test case | What it proves |
| --- | --- | --- |
| 1 | reports Offline with a useful message when the API is unreachable | `System Status: Offline` plus "Unable to connect to TokTickIT API", and no category list |
| 2 | names the database when the API is up but the categories fail | A stopped database must not look like an unreachable API. The two messages differ on purpose, and each is asserted separately |
| 3 | lets the user retry after a failure | The button is enabled again, so a failed check is not a dead end |

## Why the failure messages differ

Telling a stopped database apart from an unreachable API is the reason the page
calls both endpoints instead of one. UI-03 cases 1 and 2 are what stop that
distinction being quietly lost.

## Running a subset

```bash
npm test -w server -- API-01                          # one file
npm test -w client -- UI-03                           # one file
npm test -w server -- API-02 -t "orders by displayOrder"   # one case
```

`-t` filters on the text inside `it()` and `describe()`.
