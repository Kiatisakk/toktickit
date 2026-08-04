# Lab 1 — Peer Review Record

> **TO FILL IN.** Every field below marked `___` needs your reviewer's real
> details. Peer review is mandatory for all Pull Requests, and this file is
> graded.

## My reviewer

The person who reviewed **my** Pull Requests.

| Field | Value |
| --- | --- |
| Name | `___` |
| Student ID | `___` |
| GitHub username | `___` |

### Pull Requests they reviewed for me

| PR | Title | Link | Approved |
| --- | --- | --- | --- |
| #5 | Set up the TokTickIT project foundation | https://github.com/Kiatisakk/toktickit/pull/5 | `___` |
| #6 | Implement the API health check | https://github.com/Kiatisakk/toktickit/pull/6 | `___` |
| #7 | Create and seed IT request categories | https://github.com/Kiatisakk/toktickit/pull/7 | `___` |
| #8 | Display the IT request category list | https://github.com/Kiatisakk/toktickit/pull/8 | `___` |

### Their review comments, and how I responded

> **TO FILL IN.** Quote the actual comment and your actual reply. One entry per
> comment is enough; two or three substantive ones across the four PRs is a
> good showing.

| PR | Their comment | My response |
| --- | --- | --- |
| `___` | `___` | `___` |

## Whose work I reviewed

The person whose Pull Requests **I** reviewed.

| Field | Value |
| --- | --- |
| Name | `___` |
| Student ID | `___` |
| GitHub username | `___` |
| Their repository | `___` |

### Pull Requests I reviewed for them

| PR | Title | Link | I approved |
| --- | --- | --- | --- |
| `___` | `___` | `___` | `___` |

### My review comments, and how they responded

| PR | My comment | Their response |
| --- | --- | --- |
| `___` | `___` | `___` |

---

## Where to find things to comment on

Each of my four Pull Requests ends with a section flagging a decision that
could reasonably have gone the other way. Those are genuine questions, not
rhetorical ones:

- **#5** — PostgreSQL published on host port 5433 instead of 5432; `CONTEXT.md`
  and `docker-compose.yml` are additions beyond the brief's required structure.
- **#6** — `GET /api/health` does not query the database. The brief pulls both
  ways on this; the reasoning is in the PR and in `CONTEXT.md`.
- **#7** — `db:migrate` chains `prisma generate`, which is arguably outside the
  Issue's scope.
- **#8** — The two API calls run sequentially rather than through `Promise.all`.
