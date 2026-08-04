# TokTickIT Lab 1 — Submission

**Name:** `___`  **Student ID:** `___`  **Section:** `___`

> **How to use this file.** Fill in every `___`, paste the screenshots where the
> `[SCREENSHOT]` markers are, then export to a single PDF. The lab sheet warns
> that unnecessarily long submissions may be penalised — keep the pasted images
> readable but do not add commentary that isn't asked for.
>
> **Nothing below can be submitted until the four Pull Requests have been peer
> reviewed and merged.** `main` is empty until then, and Parts 1 and 2 both ask
> for evidence from `main`.

---

## Answer Part 1: Git Use with Engineering Workflow

### URL list

| What | URL |
| --- | --- |
| Repository | https://github.com/Kiatisakk/toktickit |
| GitHub Project | `___` |
| Issue 1 — Set up the TokTickIT project foundation | https://github.com/Kiatisakk/toktickit/issues/1 |
| Issue 2 — Implement the API health check | https://github.com/Kiatisakk/toktickit/issues/2 |
| Issue 3 — Create and seed IT request categories | https://github.com/Kiatisakk/toktickit/issues/3 |
| Issue 4 — Display the IT request category list | https://github.com/Kiatisakk/toktickit/issues/4 |
| PR #5 — `feature/1-project-foundation` → `lab1-staging` | https://github.com/Kiatisakk/toktickit/pull/5 |
| PR #6 — `feature/2-health-check` → `lab1-staging` | https://github.com/Kiatisakk/toktickit/pull/6 |
| PR #7 — `feature/3-category-seed` → `lab1-staging` | https://github.com/Kiatisakk/toktickit/pull/7 |
| PR #8 — `feature/4-category-list` → `lab1-staging` | https://github.com/Kiatisakk/toktickit/pull/8 |
| PR — `lab1-staging` → `main` | `___` |

### GitHub Project board

[SCREENSHOT] Kanban board showing all four Issues.

[SCREENSHOT] Final board with all four Issues in **Done**.

### Git workflow

[SCREENSHOT] Commit history on `main`, showing the four feature branches merged
into `lab1-staging` and then into `main`.

> `git log --graph --oneline --all` in the terminal, or the Insights → Network
> graph on GitHub, both work for this.

### Directory structure

[SCREENSHOT] The repository tree in the IDE. These must be visible:
`docs/lab-01/tests.md`, `docs/lab-01/reviewer.md`, `docs/lab-01/ai_use.md`,
`README.md`, and the test files under `tests/lab-01/`.

### README.md and .gitignore

[SCREENSHOT] Rendered `README.md`.

[SCREENSHOT] `.gitignore` contents.

### PR review evidence

[SCREENSHOT] Rendered `docs/lab-01/reviewer.md` — reviewer name, student ID,
GitHub username, and the PR links.

[SCREENSHOT] My partner's approval on my Pull Requests.

**What review comment did my partner give me, and how did I respond?**

`___`

[SCREENSHOT] My approval on my partner's Pull Requests.

**What review comment did I give my partner, and how did they respond?**

`___`

---

## Answer Part 2: Tests

[SCREENSHOT] Terminal output of `npm test` on `main`, showing all tests passing.

Expected: **13 tests across 5 files**, all green.

### docs/lab-01/tests.md

| Test File | Tool | Test Description |
| --- | --- | --- |
| `server/tests/lab-01/API-01.health.test.ts` | Supertest | Health endpoint returns 200 and expected JSON |
| `server/tests/lab-01/API-02.categories.test.ts` | Supertest | Categories endpoint returns the four seeded categories |
| `client/tests/lab-01/UI-01.heading.test.tsx` | Vitest | TokTickIT heading renders |
| `client/tests/lab-01/UI-02.loading-to-list.test.tsx` | Vitest | Loading state changes to category list |
| `client/tests/lab-01/UI-03.error-state.test.tsx` | Vitest | API failure displays a useful error message |

> The full rendered `docs/lab-01/tests.md` explains what each file asserts. Paste
> it here if you want the detail, or leave this table if you want it short.

---

## Answer Part 3: AI Use and Reflection

> Paste the rendered `docs/lab-01/ai_use.md` here — the LLM used, the table of
> key prompts, and your reflection. **Fill in every `My Reflection` line in that
> file first**; they ship as placeholders.

---

## Answer Part 4: App Demo

### Initial state

[SCREENSHOT] `http://localhost:5173` showing the app name and the
`[Check System]` button, with nothing else on the page.

### Success case, after clicking [Check System]

[SCREENSHOT] `System Status: Online` and the four categories.

> Open DevTools → Network before clicking, so the screenshot also shows the two
> HTTP requests (`/api/health` and `/api/categories`) that the brief asks for
> evidence of.

Reference behaviour, verified from the terminal:

```
$ curl -s http://localhost:3000/api/health
{"status":"ok","service":"TokTickIT API"}

$ curl -s http://localhost:3000/api/categories
[{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},{"id":3,"name":"Software"},{"id":4,"name":"Network"}]
```

### Failure case, after clicking [Check System]

[SCREENSHOT] `System Status: Offline` with the error message.

To reproduce: `docker compose stop`, then click `[Check System]` again. Restart
with `docker compose start`.

Verified from the terminal — the API stays up while the database is down, which
is why the page can name the database as the failing part:

```
$ curl -s http://localhost:3000/api/health
{"status":"ok","service":"TokTickIT API"}

$ curl -s -w " [HTTP %{http_code}]" http://localhost:3000/api/categories
{"error":"Unable to load categories from the database"} [HTTP 500]
```
