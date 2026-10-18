# Lab 4 AI Use -- Full Prompt Log

The companion to [`ai-use.md`](./ai-use.md), which carries what section 14
Part 4 asks for: the models used, selected prompts, and the reflection.
This file is everything else, and it is here rather than there so the
submitted document stays the length the labsheet means by "concise" while
nothing is thrown away.

A prompt cannot be reconstructed accurately weeks after it was typed, and the
ones that look minor are often the ones that stopped something going wrong.

---

Every prompt of the sprint so far. Kept complete because a prompt cannot be recovered
accurately once the session is over.

| # | Prompt | What it produced |
| --- | --- | --- |
| 1 | `@material/UTF-8_SE+Lab+4.pdf อัน 4 มาแล้ว` | Lab 4 arrived. The AI read the sheet, first checked that Lab 3 was fully released (release PR #69 on `main`), then listed six ambiguities in the handout that had to be settled before any specification could be written. |
| 2 | *"ควรใช้ stacked branches ไหม"*<br>"Should we use stacked branches?" | Answered from measured Lab 3 data rather than opinion: median 10.7 hours from opening to merge, and 9 of 12 Pull Requests drew findings. Conclusion: work in parallel first, stack only one deep, and never on the contract. It became a rule in `CLAUDE.md`. |
| 3 | *"เห็นด้วย เพิ่มกฎแล้ว /lab-sprint start Lab 4 …"*<br>"Agreed, rule added. /lab-sprint start Lab 4 …" | Three grill rounds settled twelve decisions before any specification was written: performed-by separate from the assignee; Action state Planned to Done or Cancelled; a three-condition resolution gate; Requester sees every Action; a follow-up closed by a following Action; any staff edits while Planned; a `version` integer for stale updates; an append-only status-history table; deltas from that history at midnight Asia/Bangkok; the staff cards; the Requester cards; and `/dashboard` as the landing page. The plan was then approved, with Sonnet 5.5 implementing and Opus 5.5 verifying. |
| 4 | *"เพิ่ม requestId"* and *"เพิ่มเงื่อนไขที่ 4: ห้ามมี Planned"*<br>"Add requestId" and "Add a fourth condition: no Planned Action" | Two answers after review of the contract. First, Action creation became idempotent on a client-generated `requestId` (unique per Ticket; a repeat returns the existing Action, a changed payload is `409 REQUEST_ID_CONFLICT`), because handout §8.5 asks for duplicates from network retry to be handled and disabling the button cannot cover a lost response (D-24, AC-48). Second, the resolution gate gained a fourth condition, no Planned Action, because Actions are frozen on a Resolved Ticket and a Planned one would otherwise stay planned forever in front of the Requester (D-03, AC-49). |
| 5 | *"go"* | After the contract merged, the eight implementation Issues #72–#79 were created and the two with no blockers were started in parallel by Sonnet 5.5 agents in separate worktrees. Issue #72 built Ticket versioning: an additive migration with the history backfill in SQL and a hand-written rollback script, a migration test run forward, back and forward again on a throwaway database, the version check on the three staff Ticket writes with a `409 STALE_UPDATE`, one history row per status change in the same transaction, and the Ticket forms' stale-update message. Each new test was checked by breaking the rule it guards and watching it fail. |
| 6 | *"go"* | After the contract merged (PR #71), the eight implementation Issues #72 to #79 were created, and the two with no blockers were started in parallel by Sonnet 5.5 agents in separate worktrees. This one built Issue #73: the `ActionTaken` model and migration, the Action state machine and validation as pure functions, and the five Actions endpoints (create idempotent on `requestId`, list, edit while Planned, complete, cancel), every write taking the Ticket row lock first (BR-16). It was checked by 125 new tests and by breaking each rule in turn to see its test fail. |
| 7 | *"do next"* | After #80 and #81 merged, the three Issues they unblocked, #74, #75 and #76, were started in parallel by Sonnet 5.5 agents in separate worktrees. This one built Issue #74, the Actions Taken area on Ticket Detail: a typed API client, one create and edit form that holds a single `requestId` across retries, short complete and cancel forms, a read-only view, a table that becomes cards below 768 px, and the Requester's read-only list. Stale and refused writes share one hook and the ui-spec section 8 wording. It was checked by 33 new tests and by breaking each rule in turn to see its test fail. |
| 8 | *"do next"* | After PRs #80 and #81 merged, the three Issues they unblocked, #74, #75 and #76, were started in parallel by Sonnet 5.5 agents in separate worktrees. This one built Issue #75, the resolution gate: the four conditions as pure functions, the status endpoint taking the Ticket row lock and deciding the gate inside its transaction so a resolve racing an Action write is serialised, `RESOLUTION_GATE_FAILED` naming every unmet condition at once, the trimmed summary stored, and the resolve dialog with its checklist, focus management and stale handling. It was checked by new unit, endpoint, concurrency and component tests, and by breaking each rule in turn (the lock, the planned-action condition, the summary, Escape, focus return) to see its test fail. |
| 9 | *"do next"* | After the versioning and Actions Taken Pull Requests (#80 and #81) merged, the three Issues they unblocked, #74, #75 and #76, were started in parallel by Sonnet 5.5 agents in separate worktrees. This one built Issue #76: the two dashboard endpoints (each card computed by the backend from stored data, deltas from the status history at midnight Asia/Bangkok with an injectable clock, drill-downs returned with each card), the `statusGroup=open` and `followUp=mine` filters sharing their predicates with the dashboard counts, the staff and Requester dashboard screens, `/dashboard` as the landing page and first navigation item, My Tickets and the queue reading their filters from the address, and an idempotent fixed-key demonstration seed. Every count was compared with separately written SQL, every drill-down with the list it opens, and each rule was broken in turn to see its test fail; whole-database comparisons were found to flake when another suite wrote at the same moment and now repeat. |
| 10 | *"beam merge laa then continue"* | After #84 merged, Issue #77 was started by a Sonnet 5.5 agent with Opus verifying. It built the Lab 4 browser suite: `actions-taken-flow`, `ticket-resolution`, `dashboards` and `responsive` specs under `e2e/lab-04/`, a console-error guard that fails any test on a `console.error`, uncaught exception or 5xx, a fixture that writes the demonstration set into the test database so the dashboard figures are exact, and 102 screenshots (34 states at three viewports). It also ran the Lab 3 specs that Issue #76 edited for the first time in a browser and fixed the one assertion the landing change broke. The suite found one real defect, the dashboards' Recent Tickets links being 24 px tall on mobile, which was fixed. It was checked by breaking a server gate rule and by injecting a `console.error`, and watching the matching spec fail. |
| 11 | *"beam merge laa do next issue and review beam pr 84 and 85"* | After #85 merged, Issue #78 (final regression and hardening) was started by a Sonnet 5.5 agent with Opus verifying, in parallel with two Sonnet agents reviewing the peer's own Pull Requests #84 and #85 in their repository. The #78 agent wrote the authorization suite for every Lab 4 endpoint, taking the endpoint list from the mounted Express router so that a route nobody classified fails the first test, plus the large-seed performance bounds, the legacy Resolved Ticket test, the Resolution Summary lifecycle test, the UI style tests, the status-control targets test and a Labs 1 to 3 browser regression spec. It found that the Actions Taken migration had no rollback script (the contract and `tests.md` both promised one) and wrote it with a test that rolls both migrations back and forward again; it gave four slow concurrency loop tests a per-round timeout; it made every test ID unique (the version-sending tests moved from UI-35 to a new UI-39) and added a mechanical check that `tests.md` and the test files agree on their IDs; it deleted an unused "Not built yet" placeholder screen; and it brought the README up to date for Lab 4. Each new test family was checked by breaking the rule it guards and watching it fail. |
| 12 | `start last issue #79` | The closing Issue was split in two. The records half (this Pull Request) was given to a Sonnet 5.5 agent with Opus 5.5 verifying: it walked the acceptance-criteria matrix in `tests.md` with a script, audited the API specification and the README against the routers, `errors.ts` and `server/prisma/accounts.ts`, brought `reviewer.md` up to date for both repositories (our Pull Request #86 and his #81, #86 and #87, none of which were recorded), selected the key prompts in `ai-use.md`, and re-ran the full server, client and browser suites for the final counts. The PDF and the release PR stay with the main session. Section 3 of `ai-use.md`, the reflection, was deliberately left unwritten. |

---

## Sub-agent prompts

Every prompt the main session (Opus 5.5) sent to a sub-agent during Lab 4, word for word, extracted from the session transcript rather than retyped. All sub-agents ran on Sonnet 5.5. "Follow-up" entries are messages sent to an agent already running, continuing its work. Each entry quotes the user prompt that led to it, so it can be matched to the table above.

Most implementation prompts point the agent at a brief file instead of repeating it; those briefs are reproduced after the prompts, under *Briefs the prompts refer to*.

| # | Sent (UTC) | Kind | Task | Length |
| --- | --- | --- | --- | --- |
| [S-01](#s-01) | 2026-10-02 15:44 | New agent | Write the Lab 4 engineering contract | 11,276 chars |
| [S-02](#s-02) | 2026-10-02 15:45 | Follow-up to S-01 | Plan mode is OFF — proceed with the full task now: write docs/lab-04/, create th | 1,882 chars |
| [S-03](#s-03) | 2026-10-02 15:47 | Follow-up to S-01 | The user has approved execution ("go"): the parent session has exited plan mode, | 2,056 chars |
| [S-04](#s-04) | 2026-10-02 16:31 | Follow-up to S-01 | Two changes to the Lab 4 contract on PR #71, decided by the user after review. W | 2,922 chars |
| [S-05](#s-05) | 2026-10-03 00:18 | New agent | Implement #72 versioning and status history | 2,185 chars |
| [S-06](#s-06) | 2026-10-03 00:18 | New agent | Implement #73 Actions Taken API | 2,158 chars |
| [S-07](#s-07) | 2026-10-03 09:34 | New agent | Fix Beam review on PR 80 | 2,753 chars |
| [S-08](#s-08) | 2026-10-03 09:34 | New agent | Fix Beam review on PR 81 | 3,035 chars |
| [S-09](#s-09) | 2026-10-03 09:34 | New agent | Review Beam PR 82 draft | 4,436 chars |
| [S-10](#s-10) | 2026-10-03 18:49 | New agent | Implement #74 Actions UI | 1,360 chars |
| [S-11](#s-11) | 2026-10-03 18:49 | New agent | Implement #75 resolution gate | 1,592 chars |
| [S-12](#s-12) | 2026-10-03 18:49 | New agent | Implement #76 dashboards | 1,916 chars |
| [S-13](#s-13) | 2026-10-03 18:49 | New agent | Re-review Beam PR 82 fixes | 3,635 chars |
| [S-14](#s-14) | 2026-10-06 16:50 | New agent | Fix Beam review on PR 82 | 2,139 chars |
| [S-15](#s-15) | 2026-10-06 16:50 | New agent | Fix Beam review on PR 83 | 1,572 chars |
| [S-16](#s-16) | 2026-10-06 16:50 | New agent | Fix Beam review on PR 84 | 2,035 chars |
| [S-17](#s-17) | 2026-10-06 16:51 | New agent | Draft review of Beam PR 83 | 3,998 chars |
| [S-18](#s-18) | 2026-10-07 13:28 | New agent | Re-review beambeambeam#83 | 3,825 chars |
| [S-19](#s-19) | 2026-10-08 07:12 | New agent | Implement Issue #77 e2e | 898 chars |
| [S-20](#s-20) | 2026-10-08 17:44 | New agent | Fix Beam's review on PR #85 | 3,931 chars |
| [S-21](#s-21) | 2026-10-11 18:10 | New agent | Implement Issue #78 hardening | 946 chars |
| [S-22](#s-22) | 2026-10-11 18:11 | New agent | Review beambeambeam#84 | 3,704 chars |
| [S-23](#s-23) | 2026-10-11 18:11 | New agent | Review beambeambeam#85 | 3,828 chars |
| [S-24](#s-24) | 2026-10-11 18:57 | New agent | Review beambeambeam#85 | 4,255 chars |
| [S-25](#s-25) | 2026-10-11 19:33 | Follow-up to S-21 | Heads-up from the main session: another agent ran `taskkill /F /IM node.exe` a s | 492 chars |
| [S-26](#s-26) | 2026-10-12 06:39 | New agent | Re-review beambeambeam#84 | 3,522 chars |
| [S-27](#s-27) | 2026-10-12 06:39 | New agent | Re-review beambeambeam#85 | 4,014 chars |
| [S-28](#s-28) | 2026-10-14 16:43 | New agent | Review beambeambeam#86 | 3,968 chars |
| [S-29](#s-29) | 2026-10-14 16:43 | New agent | Review beambeambeam#87 | 4,098 chars |
| [S-30](#s-30) | 2026-10-14 20:29 | New agent | Issue #79 records half | 708 chars |
| [S-31](#s-31) | 2026-10-15 10:02 | New agent | Re-review beambeambeam#86 | 4,219 chars |
| [S-32](#s-32) | 2026-10-15 10:02 | New agent | Re-review beambeambeam#87 | 4,211 chars |

### S-01

**Write the Lab 4 engineering contract** · 2026-10-02 15:44 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> เห็นด้วย เพิ่มกฎแล้ว /lab-sprint start Lab 4 @material/UTF-8_SE+Lab+4.pdf

<details><summary>Prompt sent (11,276 characters)</summary>

~~~~text
You are writing the Lab 4 engineering contract for the TokTickIT repository at C:\Users\kiati\Documents\toktickit (CPE 334). Work in that checkout directly; nobody else touches it while you work. This is a **documentation-only** PR: you write no application code and no tests.

Read first, in this order:
1. `CLAUDE.md` at the repo root — its GitHub workflow rules are binding.
2. **The approved plan: `C:\Users\kiati\.claude\plans\labsheet-c-users-kiati-documents-toktic-graceful-pancake.md`.** Every decision in its "Decisions settled in the grill" table was made by the user and is final. Do not reopen or reinterpret them; write them down precisely. If you believe one is contradictory or impossible, finish everything else and report it — do not silently change it.
3. The handout: `material/UTF-8_SE+Lab+4.pdf` (11 pages; read with the Read tool, pages "1-11"). Its §9 table fixes the 11 sections of specification.md; §10 and §12 fix the test file names; §14 is how the PDF is graded.
4. The Lab 3 contract as the model for structure, tone and detail: `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md`. Match their conventions (FR/BR/AC numbering, decision records D-NN with *Why* and *Rejected*, tests.md row format `| ID | AC / Rule | What it tests | Expected result | Test file | Result |` with Result `Planned`).
5. The current code, so the contract describes what exists accurately: `server/prisma/schema.prisma`, `server/src/tickets/domain.ts` (status matrix), `server/src/routes/staffTickets.ts`, `server/src/routes/tickets.ts`, `server/src/routes/comments.ts`, `server/src/routes/notes.ts`, `server/src/tickets/ticketQuery.ts` (queue filters the dashboard drill-downs will use), `client/src/routes/router.tsx`, `client/src/components/AppShell.tsx`.

## Starting state
- You are on branch `docs/lab4-specification`, created from `lab4-staging` (which equals `main` at `150a220`). One commit is already on it: the stacked-branches rule in `CLAUDE.md`. Keep it.
- Docker is not needed for this task.

## What to produce: `docs/lab-04/` — six files

- **specification.md** — the 11 sections of handout §9: Sprint Goal; Stakeholder Request (in your own words, not copied); Scope (included and the handout §4.2 exclusions, plus anything the decisions excluded); Functional Requirements (numbered FR for Actions Taken, workflow, dashboards, hardening); Business Rules (BR-01 and BR-02 exactly as the handout gives them, then the rest numbered — Action states, follow-up closure, edit rights, performedBy eligibility, resolution gate, versioning, status history, dashboard calculations including Asia/Bangkok day boundaries); UI Summary pointing at ui-spec.md; Data Changes (models, fields, relations, indexes, the migration and backfill exactly as the plan states, rollback approach, seed decisions); API Contract summary pointing at api-spec.md; Acceptance Criteria (AC-01 and AC-02 from handout §9.1 verbatim in meaning, then enough to cover the whole scope — Given/When/Then, observable, testable); Definition of Done (product-completion checklist); Assumptions and Decisions (every row of the plan's decisions table as a D-NN, plus at least two database-design decisions justified, as handout §5.1 requires). Restate the Lab 3 status transition matrix and add the resolution gate to it. Include a **dashboard metric table**: card name, exact calculation (as a precise description of the query), empty behaviour, drill-down destination and query parameters.
- **api-spec.md** — every new and changed endpoint with method, path, roles, request and response shapes, validation, status codes and error codes: Actions Taken (list and create under a ticket, update while PLANNED, complete, cancel with reason, follows-up link), the `version` field on every ticket and action write and `409 STALE_UPDATE`, the resolution gate on the status transition (`400 RESOLUTION_GATE_FAILED` with details per unmet condition; Resolution Summary carried with the transition), `GET /api/dashboard/requester`, `GET /api/dashboard/staff` (concise metrics, not ticket collections — handout §6.2), the new error codes, and an updated authorization matrix. State what is unchanged from Lab 3.
- **ui-spec.md** — the `/dashboard` landing page for every role and navigation change; both dashboards (cards, recent tickets list, quick actions, loading/empty/forbidden/failure states, responsive arrangement, accessible drill-down); the Actions Taken area on Ticket Detail (list, create, view/edit while PLANNED, complete, cancel, follow-up linking, read-only for Requesters); the resolve flow with gate feedback; the stale-update message; the screenshot inventory under `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/` with stable state names; responsive and accessibility rules "same as Labs 2 and 3".
- **tests.md** — planned tests at every level the handout §10 names (unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, end-to-end). Use the handout §12 file names: `server/tests/lab-04/actions-taken.api.test.ts`, `ticket-workflow.api.test.ts`, `requester-dashboard.api.test.ts`, `staff-dashboard.api.test.ts`; `client/tests/lab-04/StaffDashboard.test.tsx`, `RequesterDashboard.test.tsx`, `ActionsTaken.test.tsx`, `TicketWorkflow.test.tsx`; `e2e/lab-04/actions-taken-flow.spec.ts`, `ticket-resolution.spec.ts`, `dashboards.spec.ts`. Add others only where needed (e.g. a migration test, a stale-update test) and name the real file. Every test row names an exact file path. Include an AC→test traceability matrix where **every AC maps to at least one test**, a Labs 1–3 regression section, and a test that dashboard metrics match direct SQL counts (handout §14 Part 5). All Results read `Planned`.
- **reviewer.md** — skeleton only, using the **Lab 2/3 header form** exactly (copy the header from `docs/lab-03/reviewer.md`: the living-document paragraph, the Role/Name/Student ID/GitHub table — Kiatisak Markmeeshap 67070501005 @Kiatisakk; Supawit Marayat 67070501045 @beambeambeam — and the two-directions line), then empty "Reviews I received", "Reviews I gave", and "Coverage" headings.
- **ai-use.md** — skeleton: "# Lab 4 AI Use", the living-document paragraph, "## 1. Which AI I used" (say: Claude Code; Claude Opus 5.5 ran the grill and the plan and verifies; Claude Sonnet 5.5 sub-agents implement — this contract was written by one), "## 2. Selected key prompts" (empty table header), and "## 3. My reflection" carrying only a quoted line that it is deliberately left for the author to write by hand. **Never draft the reflection.** Also create `ai-use-log.md` beside it with the same table format as `docs/lab-03/ai-use-log.md`, rows 1–3 for these prompts by the user: (1) `@material/UTF-8_SE+Lab+4.pdf อัน 4 มาแล้ว` — Lab 4 arrived; read the sheet, checked Lab 3 was fully released first, listed six ambiguities. (2) `ควรใช้ stacked branches ไหม` — answered from measured Lab 3 data (median 10.7 h to merge, 9 of 12 PRs drew findings): parallel first, stack one deep, never on the contract; became a CLAUDE.md rule. (3) `เห็นด้วย เพิ่มกฎแล้ว /lab-sprint start Lab 4 …` — three grill rounds settled 12 decisions (list them briefly) before any spec was written; then the plan was approved with Sonnet 5.5 implementing and Opus 5.5 verifying.

Write concise documents. The handout says "Do not copy the entire handout"; resolve choices instead.

## Self-check before committing
- `ls docs/lab-04/` → specification.md, api-spec.md, ui-spec.md, tests.md, reviewer.md, ai-use.md, ai-use-log.md.
- Every AC in specification.md appears in tests.md's matrix with at least one test; every test ID appears once; no gaps in FR/BR/AC numbering.
- Every decision in the plan's table appears as a D-NN in specification.md §11.
- Render each file through GitHub and check tables render (no stray `|` paragraphs):
  `gh api -X POST markdown -f mode=gfm -f context=Kiatisakk/toktickit -F text=@docs/lab-04/<file>.md > "$TEMP/x.html"` then confirm `<table` appears for files with tables and `<p>| ` does not appear.
- Write files with the Write tool, not shell heredocs (heredocs break on quotes/backslashes on this machine).

## Issue, commits, PR, board
1. Create the contract Issue first: `gh issue create --title "Sprint 4 engineering contract" --label lab-04 --body "<what the contract covers, and acceptance criteria: the six documents exist and are internally consistent; every AC maps to a planned test; every decision from the grill is recorded>"`. Add it to the board: list cards first (`gh project item-list 3 --owner Kiatisakk --format json --limit 200`), then `gh project item-add 3 --owner Kiatisakk --url <issue url> --format json -q .id`. Move it to Specified (option `9a9ea150`).
   Board: project `PVT_kwHOCB2G0s4BfVCS`, status field `PVTSSF_lAHOCB2G0s4BfVCSzhZosUc`; options Started `b5c30f7b`, PR Review `ffb17e2a`. Command: `gh project item-edit --id <item> --project-id PVT_kwHOCB2G0s4BfVCS --field-id PVTSSF_lAHOCB2G0s4BfVCSzhZosUc --single-select-option-id <option>`.
2. Commit in logical steps (e.g. specification; api + ui; tests; registers), each message in the repo's style `docs(lab-04): …` ending with exactly:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01CBvvM7KaeqGUTY6Abj1dUb`
   After the first commit, move the card to Started.
3. **Stage by explicit path only.** Never stage `.agents/`, `AGENTS.md`, `Gemini_Review.md`, `skills-lock.json`, `latex/`, `.claude/`, `server/.env*`. Never `git add -A` or `git add .`.
4. Push and open ONE PR to **`lab4-staging`** titled `Sprint 4 engineering contract (#<issue>)`. Body: `Closes #<issue>.`, a short summary, a table of the decisions recorded, what the contract deliberately excludes, the CLAUDE.md rule riding along (one line), and a self-check section with what you verified. **No "🤖 Generated with Claude Code" line and no Claude session link in the PR body — the user asked for it to be left out.**
5. `gh pr edit <n> --add-reviewer beambeambeam --add-label lab-04`; link the Issue explicitly (a closing keyword does not link against a staging base):
   `gh api graphql -f query='{repository(owner:"Kiatisakk",name:"toktickit"){issue(number:<i>){id} pullRequest(number:<n>){id}}}'`
   `gh api graphql -f query='mutation($i:ID!,$p:[ID!]!){addCloseIssueReferences(input:{issueId:$i, pullRequestIds:$p}){clientMutationId}}' -f i=<issue id> -f 'p[]=<pr id>'`
   Verify `closingIssuesReferences` contains the Issue, then move the card to PR Review.
6. **Do not create the implementation Issues** — they are made after this contract merges. **Never merge, never close an Issue, never post on github.com/beambeambeam/toktickit, never force-push, never skip hooks.** `gh` GraphQL calls sometimes fail with `unexpected EOF`; if a chained command stops, check what ran before retrying so nothing is posted twice.

## Report back
The Issue and PR URLs; commit list; for each document a one-line summary with counts (FRs, BRs, ACs, D-NNs, test rows by level); confirmation of the self-checks with results; any plan decision you found contradictory and how you left it; anything unfinished. Be exact.
~~~~

</details>

### S-02

**message to a running agent** · 2026-10-02 15:45 UTC · Follow-up to S-01 · Sonnet 5.5

Triggered by the user prompt:

> เห็นด้วย เพิ่มกฎแล้ว /lab-sprint start Lab 4 @material/UTF-8_SE+Lab+4.pdf

<details><summary>Prompt sent (1,882 characters)</summary>

~~~~text
Plan mode is OFF — proceed with the full task now: write docs/lab-04/, create the Issue, commit, push, open the PR, move the card. The plan-mode text you saw was stale context from the parent session; the user approved execution.

Your 7 points are approved as you proposed them. Write each into the contract:
1. New queue-only parameter `followUp=mine` (additive API change; document it in api-spec and as a BR/FR) for the "My open follow-ups" card drill-down.
2. New `statusGroup=open` parameter on My Tickets (and accept it on the queue too, for symmetry) meaning not RESOLVED/CLOSED/CANCELLED; additive, documented.
3. State explicitly in the metric table that REOPENED appears in no staff status card and is reachable through the queue's status filter. (Note: REOPENED does count toward the Requester "Open" card, since it is not Resolved/Closed/Cancelled.)
4. The three staff PATCH endpoints accept "the named field plus `version`"; the status endpoint additionally accepts `resolutionSummary` (required only when the target is RESOLVED). State this as a change from Lab 3.
5. Lab 3's race refusal `400 INVALID_STATUS_TRANSITION` ("ticket moved") becomes `409 STALE_UPDATE`; say so as a change from Lab 3.
6. Reuse `Ticket.resolutionSummary`; no new column.
7. `/` redirects to `/dashboard`, and Dashboard is the first NAV_ITEMS entry for every role; sign-in lands on /dashboard. Note in tests.md that existing Lab 3 tests and E2E that expect /my-tickets after sign-in will need updating in the implementation Issue (a regression row).

Before writing, do read the Lab 3 docs you had not reached (docs/lab-03/*.md) for format conventions. Everything else in the original brief stands, including: stage by explicit path only, the Sonnet 5.5 commit trailer, no "Generated with" line in the PR body, never merge/close/post on the peer's repo. Report back as originally specified.
~~~~

</details>

### S-03

**message to a running agent** · 2026-10-02 15:47 UTC · Follow-up to S-01 · Sonnet 5.5

Triggered by the user prompt:

> go

<details><summary>Prompt sent (2,056 characters)</summary>

~~~~text
The user has approved execution ("go"): the parent session has exited plan mode, and your earlier stop is lifted. Carry out the full original task now — write docs/lab-04/, create the Issue, commit, push, open the PR, move the card — exactly as the original brief says.

Write your 7 gap fills into the contract as follows (approved by the user):
1. New queue-only parameter `followUp=mine` (additive) for the "My open follow-ups" card drill-down.
2. New `statusGroup=open` parameter on My Tickets (accept it on the queue too), meaning not RESOLVED/CLOSED/CANCELLED; additive. REOPENED counts toward the Requester "Open" card.
3. CHANGED from your proposal: add an 8th staff dashboard card **"Reopened"** (status REOPENED, drill-down `status=REOPENED`, an existing filter). Staff cards are therefore: New, Open, In Progress, Waiting for Requester, Reopened, My Assigned, Unassigned, My open follow-ups. Record the reason as a decision: a reopened ticket is one the requester came back about, so it must not be invisible on the dashboard.
4. The three staff PATCH endpoints accept "the named field plus `version`"; the status endpoint also accepts `resolutionSummary`, required only when the target is RESOLVED. State it as a change from Lab 3.
5. Lab 3's race refusal `400 INVALID_STATUS_TRANSITION` becomes `409 STALE_UPDATE`; state it as a change from Lab 3 and add a regression row in tests.md for updating the Lab 3 tests that expect 400.
6. Reuse `Ticket.resolutionSummary`; no new column.
7. `/` and sign-in land on `/dashboard`; Dashboard is the first navigation item for every role; AuthGuard's role-refusal redirect also goes to `/dashboard` (not `/my-tickets`). Add a regression row for Lab 3 tests/E2E that expect `/my-tickets` after sign-in.

Read docs/lab-03/*.md for format conventions before writing. Everything else in the original brief stands: stage by explicit path only; the Sonnet 5.5 commit trailer; no "Generated with" line in the PR body; never merge, close an Issue, or post on the peer's repo. Report back as originally specified.
~~~~

</details>

### S-04

**message to a running agent** · 2026-10-02 16:31 UTC · Follow-up to S-01 · Sonnet 5.5

Triggered by the user prompt:

> https://github.com/beambeambeam/toktickit/pull/80 เสดแล้วฝากรีวิวให้บีมด้วยนะใช้ caveman review

<details><summary>Prompt sent (2,922 characters)</summary>

~~~~text
Two changes to the Lab 4 contract on PR #71, decided by the user after review. Work on the same branch `docs/lab4-specification` (pull first: I pushed c5834ae, a reviewer.md entry — do not touch reviewer.md).

1. **Idempotent Action creation (replaces BR-35's "not idempotent").** Handout §8.5 requires duplicates from repeated clicking *or network retry* to be prevented or safely handled; disabling the button does not cover a lost response. Contract: the client generates one UUID `requestId` per intentional create and resends the same value on retry; `ActionTaken.requestId` with a unique constraint on (ticketId, requestId); a create whose key already exists returns the existing Action (200, not 201) and writes nothing; the same key with different fields returns `409 REQUEST_ID_CONFLICT`; a new intentional Action uses a new key. Update: BR-35 (rewrite), the Scope exclusion that lists server-side idempotency (remove it), §7 Data Changes (column + unique index), api-spec create request/response and error codes, ui-spec create form (key kept across retry, new key per new Action), an AC (Given/When/Then: same requestId twice → one Action; changed payload under same key → 409), and tests.md rows mapped to that AC (API and UI). Record it as a new decision D-24 with *Why* (handout §8.5, lost response) and *Rejected* (UI-only prevention).

2. **Fourth resolution-gate condition: no Planned Action.** A transition to Resolved also requires that the Ticket has **no Action in Planned state** — staff must Complete or Cancel remaining planned work first. Reason: with D-17 freezing Actions on resolved Tickets, a Planned Action left at resolution would stay Planned forever and show the Requester planned work on a closed Ticket. Update: D-03 (now four conditions; note the user added the fourth after review), BR-16, A-01 (rewrite — it no longer holds), the gate's `details` keys in api-spec (add one key for pending Planned Actions, still the single `RESOLUTION_GATE_FAILED` code listing every unmet condition), the ui-spec resolve dialog feedback, the status-matrix note if it lists gate conditions, the relevant AC(s), and tests.md (a workflow API test and a UI test for this condition, mapped in the matrix).

Then re-run your self-checks: numbering without gaps (FR/BR/AC/D), every AC in the matrix, unique test IDs, all seven files render through the GitHub markdown API with tables and no `<p>| `, and `git diff --name-only lab4-staging` still only CLAUDE.md and docs/lab-04/*. Append one row to docs/lab-04/ai-use-log.md for the user's decision (prompt: the two answers "เพิ่ม requestId" and "เพิ่มเงื่อนไขที่ 4: ห้ามมี Planned", outcome: what changed and why). Commit as `docs(lab-04): …` with the Sonnet 5.5 trailer, staging by explicit path, push to the same branch. Do not post comments on the PR and do not change the PR body. Report: commits, which sections changed, new counts, self-check results.
~~~~

</details>

### S-05

**Implement #72 versioning and status history** · 2026-10-03 00:18 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> go

<details><summary>Prompt sent (2,185 characters)</summary>

~~~~text
Implement GitHub Issue **#72 "Tickets carry a version and a status history"** in the TokTickIT repository (Kiatisakk/toktickit).

First read the common brief, which is binding: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`.

Your specifics:
- Branch: `feature/ticket-versioning`, from `origin/lab4-staging`.
- Board item: `PVTI_lAHOCB2G0s4BfVCSzg-PeM0`.
- **Migration timestamp: `20261003100000`** (the other agent uses a later one). Folder name e.g. `20261003100000_ticket_version_and_status_history`.
- The contract: D-07, D-08, D-16, D-20, D-21, D-23, BR on versioning and history, §7 Data Changes (version column, `TicketStatusChange` table, backfill exactly as written, rollback script), api-spec on the staff Ticket PATCH endpoints (named field plus `version`, `409 STALE_UPDATE`), and the AC rows listed in the Issue (AC-23, AC-24, AC-26, AC-35, AC-36, AC-42 for Ticket forms). The resolution gate itself is **not** yours (#75) — but every transition you touch must write its history row.
- The other agent is building Actions Taken (#73) in parallel. Do not touch Actions code. Expect a conflict only in `server/prisma/schema.prisma` and possibly `server/src/http/errors.ts` when the second PR merges; keep your edits there minimal and additive.
- **Your first commit carries a record owed from the last merge** (the "no separate docs PRs" rule): in `docs/lab-04/reviewer.md`, under "Reviews I received" after the PR #71 entry, add one paragraph: *He approved with `LGTM` at 16:54:20Z on 2026-10-02 and merged ten seconds later as `5419199`. Issue #70 was closed by hand. Recorded on the next feature branch, #72's.* Change the Coverage row for #71 to `| [#71](https://github.com/Kiatisakk/toktickit/pull/71) | received | 3 | Changes requested → Approved | Merged |`, and the row for beambeambeam#80 to state `Changes requested → Approved` / `Merged` (it was merged on 2026-10-02 at 16:48:36Z by the author's account, Kiatisakk, after the approval). Say in one line of the PR body that this record rides along.
- PR title: `Tickets carry a version and a status history (#72)`.
~~~~

</details>

### S-06

**Implement #73 Actions Taken API** · 2026-10-03 00:18 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> go

<details><summary>Prompt sent (2,158 characters)</summary>

~~~~text
Implement GitHub Issue **#73 "IT Staff record Actions Taken on a Ticket"** in the TokTickIT repository (Kiatisakk/toktickit).

First read the common brief, which is binding: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`.

Your specifics:
- Branch: `feature/actions-taken-api`, from `origin/lab4-staging`.
- Board item: `PVTI_lAHOCB2G0s4BfVCSzg-PeRo`.
- **Migration timestamp: `20261003110000`** (the other agent uses an earlier one). Folder name e.g. `20261003110000_actions_taken`.
- Server only: the `ActionTaken` model (§7 — including `requestId` with unique `(ticketId, requestId)`, `version`, `followsUpId` self-relation, `recordedById`/`performedById`, state Planned/Done/Cancelled, `cancelReason`), and every Actions endpoint in api-spec (create — idempotent on `requestId`, list, PATCH while Planned, complete, cancel), with the error codes it names. The UI is #74, not yours. The resolution gate is #75, not yours — but D-17 (`409 TICKET_NOT_ACTIONABLE` when the Ticket is Resolved, Closed or Cancelled) and BR-16's rule that **every Action write locks the Ticket row first** are yours.
- The other agent is adding Ticket `version` and a status-history table (#72) in parallel. **Action writes do not depend on the Ticket version** in your Issue: use your own Action `version` for Action stale-update checks, and do not reference the Ticket `version` column (it may not exist on your branch). If the contract says an Action write also touches the Ticket version, implement only what your branch's schema supports, and report it so the follow-up can wire it once both are merged.
- AC rows in the Issue: AC-01, AC-03 to AC-14, AC-25, AC-48, and AC-44 for the Actions endpoints. Test files per `tests.md`: `server/tests/lab-04/actions-taken.api.test.ts` (and `concurrency.api.test.ts` for CONC-02 if your rows include it).
- Expect a conflict only in `server/prisma/schema.prisma` and possibly `server/src/http/errors.ts` when the second PR merges; keep edits there minimal and additive.
- PR title: `IT Staff record Actions Taken on a Ticket (#73)`.
~~~~

</details>

### S-07

**Fix Beam review on PR 80** · 2026-10-03 09:34 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> Beam Review ล่ะ SpawnSonnet ไปแก้ได้เลยแล้วก็ https://github.com/beambeambeam/toktickit/pull/82 SpawnSonnet ไป Review อันนี้ให้บีมด้วย

<details><summary>Prompt sent (2,753 characters)</summary>

~~~~text
Fix @beambeambeam's review of PR #80 (https://github.com/Kiatisakk/toktickit/pull/80, Issue #72, branch `feature/ticket-versioning`). Read and follow `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md` first.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\agent-a48512cdd397ebf7f` (branch already checked out). Board item for #72: `PVTI_lAHOCB2G0s4BfVCSzg-PeM0`.

Review 5399433733, CHANGES_REQUESTED. Three line findings (reply to each by comment id):

1. #4172063199 `server/prisma/migrations/20261003100000_ticket_version_and_status_history/migration.sql:9` — "Prisma Migrate doesn't wrap SQL migrations in a transaction by default, so a later failure can leave this migration partially applied, contrary to §7. Add BEGIN/COMMIT and cover rollback."
   Notes: the migration has no `ALTER TYPE … ADD VALUE`, so it can run inside a transaction. Wrap it in BEGIN/COMMIT. "Cover rollback": the migration test already uses a scratch database — add a test that applies the migration with an injected failure after the backfill (or equivalent) and shows nothing was left behind (no `version` column, no `TicketStatusChange` table). Also consider `down.sql` — wrap it the same way.
   CAUTION: this migration is already applied to the shared `toktickit` and `toktickit_test` databases. Editing an applied migration changes its checksum. Never reset. If `prisma migrate deploy` or `status` complains about the modified migration, update only the `checksum` column of that one row in `_prisma_migrations` in both databases to the new file's SHA-256 (that is what Prisma stores) and say exactly what you ran; if anything else complains, stop and report instead.

2. #4172063204 `server/tests/lab-04/ticket-versioning-migration.test.ts:165` — "This fixed database name is dropped with FORCE, so a parallel run or existing database with that name gets terminated and erased. Use a unique per-run name." Use a per-run unique name (e.g. a random suffix), still with a recognisable prefix; drop only that exact name, in afterAll. The red-first rule is hard to apply to a test-infrastructure finding — say how you verified it instead (e.g. two runs at once both pass).

3. #4172063206 `client/src/routes/TicketDetail.tsx:172` — "Refetch failures are swallowed while the stale message claims the latest data loaded. Surface the reload failure so users know the controls still show stale data." Check ui-spec's stale-update wording, then make a failed reload show a distinct message (and do not claim fresh data). Red-first client test.

Do not touch Beam's other PRs or the other branch (`feature/actions-taken-api`) — another agent is fixing it right now.
~~~~

</details>

### S-08

**Fix Beam review on PR 81** · 2026-10-03 09:34 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> Beam Review ล่ะ SpawnSonnet ไปแก้ได้เลยแล้วก็ https://github.com/beambeambeam/toktickit/pull/82 SpawnSonnet ไป Review อันนี้ให้บีมด้วย

<details><summary>Prompt sent (3,035 characters)</summary>

~~~~text
Fix @beambeambeam's review of PR #81 (https://github.com/Kiatisakk/toktickit/pull/81, Issue #73, branch `feature/actions-taken-api`). Read and follow `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md` first.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\agent-a22fc93802c8ca959` (branch already checked out). Board item for #73: `PVTI_lAHOCB2G0s4BfVCSzg-PeRo`.

Review 5399435686, CHANGES_REQUESTED. Four line findings (reply to each by comment id):

1. #4172065232 `server/src/routes/actions.ts:230` — 🔴 "`followsUpId` accepts an Action dated after the new Action, reversing the follow-up chronology. Reject targets later than the new Action's effective `actionAt`."
   Notes: decide equal timestamps explicitly (same instant should probably be allowed, ordering is actionAt then id — check the contract). Apply on create AND on edit of a Planned Action (changing its `actionAt` or `followsUpId`). Use the contract's existing error shape for followsUpId validation (look at how other followsUpId refusals are answered in api-spec.md) and add the rule to specification.md BR list / api-spec.md and a tests.md row.

2. #4172065235 `server/src/routes/actions.ts:149` — 🟡 "the performer can be deactivated after this lookup but before the Action commits. Lock the User row through the write so eligibility cannot go stale."
   Notes: read the performer with `SELECT … FOR UPDATE` (or FOR SHARE) inside the same transaction, after the Ticket lock (keep lock order Ticket → User, and check the user-deactivation code path does not lock in the opposite order — say what you found). Covers create, edit, and complete if they set the performer. Prove it with a concurrency test in the style of `concurrency.api.test.ts` (deactivation racing creation: either the create sees the deactivated user and refuses, or the deactivation waits) and a mutation check (remove the lock → test fails).

3. #4172065238 `server/src/actions/validation.ts:149` — 🔴 "`Date` normalizes impossible dates such as February 30 into March instead of rejecting them. Validate the parsed calendar fields before accepting the timestamp." Reject with the field-level 400 the contract uses. Check whether Lab 3 has a date validator to reuse.

4. #4172065241 `server/src/actions/validation.ts:174` — 🔴 "a JSON key like `__proto__` resolves to an inherited object and is called as a validator, causing a 500 instead of a strict-body 400. Check own keys and use prototype-free maps." Red first with a raw JSON body containing `"__proto__"` and also `"constructor"` / `"toString"`. Then grep the rest of `server/src` for the same lookup-a-validator-by-body-key pattern (Lab 3's `messages.ts`, `onlyField` in `staffTickets.ts`, etc.) and report any other instance you find — fix it only if it is in code this PR added; otherwise just list it for me.

Do not touch Beam's PRs or the other branch (`feature/ticket-versioning`) — another agent is fixing it right now.
~~~~

</details>

### S-09

**Review Beam PR 82 draft** · 2026-10-03 09:34 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> Beam Review ล่ะ SpawnSonnet ไปแก้ได้เลยแล้วก็ https://github.com/beambeambeam/toktickit/pull/82 SpawnSonnet ไป Review อันนี้ให้บีมด้วย

<details><summary>Prompt sent (4,436 characters)</summary>

~~~~text
Draft a code review of @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/82 ("Create and view Actions Taken on Tickets (#74)", base `lab4-staging`, head `feature/74-create-view-actions-taken`, 93 files, +7602/−77). You DRAFT it; you do **not** post it. The main session verifies your findings and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md` — *Reviewing (when I am the reviewer)*.
- `C:\Users\kiati\Documents\toktickit\.claude\skills\lab-sprint\review-given.md`, `gotchas.md`, and `C:\Users\kiati\Documents\toktickit\.claude\skills\caveman-review\SKILL.md` (style: caveman — one line per finding, `🔴 bug:` / `🟡 risk:` / `🔵 nit:` / `❓ q:`, problem, fix; security/architecture findings get a short paragraph).
- His Issue: `gh issue view 74 --repo beambeambeam/toktickit` and its acceptance criteria. His contract: `docs/lab-04/` **on his `lab4-staging`** (his repo has its own contract, different from ours — review against HIS spec, api-spec, ui-spec, tests.md, not ours).
- A model of the review tone and depth: our earlier review of his #80, `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\review80.json`.

## Where to work
Clone his repo into a fresh folder in your scratchpad-like temp dir: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` (`gh repo clone beambeambeam/toktickit <dir>` then `gh pr checkout 82`). Do not touch `C:\Users\kiati\Documents\toktickit` or its worktrees — two other agents are working there.

## Running things — DATABASE CAUTION
Our local PostgreSQL (localhost:5433, DBs `toktickit`, `toktickit_test`) holds OUR schema and is in use by two other agents. **Never run his migrations, seed, or server tests against those databases, never reset anything.** Client tests (`client/`, jsdom) need no database: install and run them (`npx vitest run` in client, `npx tsc -b`), and `npm exec -- ultracite check` if his repo has it. If you need his server suite for a finding, create a dedicated database `beam82_review` on the same server (copy the credentials from `C:\Users\kiati\Documents\toktickit\server\.env.test`, point his `.env.test` DATABASE_URL at `beam82_review`), migrate that one only, and drop exactly `beam82_review` when done.

## What to check
1. Process: base `lab4-staging`; `lab-04` label (it currently has NO labels — that is a process finding); Issue linked (`closingIssuesReferences` shows #74 — fine); reviewer.md / tests.md / ai-use log updated in this PR as his CLAUDE/contract requires; card/board you cannot see — skip.
2. Every acceptance criterion of his #74: is it implemented and what test proves it? List AC → test.
3. Correctness against his contract: authorization (Requester read-only, staff-only writes), stale-update handling, idempotent create / repeated click, validation beside the field, follow-up linking, read-only Done/Cancelled, error codes matching his api-spec, accessibility (labels, buttons, focus), responsive layout claims, tests that actually assert the behaviour (look for tests that can't fail). 7.6k lines — part is probably generated artefacts/screenshots; say what share is code vs artefacts and whether anything committed shouldn't be (env files, node_modules, test-results, huge binaries).
4. **Verify each suspicion empirically** before keeping it (run the test, write a throwaway test in the scratch clone, read the server route the UI calls). Drop anything you could not confirm, or mark it `❓ q:`.

## Output
Write `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review82.json` in the exact shape of review80.json: `event` (your recommended verdict: REQUEST_CHANGES / COMMENT / APPROVE), a `body` (one-line opener, process findings with no line to hang on, inline tally), and `comments` each with `path`, `line` (line in the file's NEW state — verify it with `git show HEAD:<path> | sed -n '<line>p'`), `side: "RIGHT"`, `body`. Every line must be inside the PR diff (check with `gh pr diff 82 --repo beambeambeam/toktickit`), or the POST fails.

Report back: verdict and why; the findings list with, for each, how you confirmed it (command/test and result); the AC → test table; client/test counts you ran; anything you could not verify. Do NOT post anything to GitHub.
~~~~

</details>

### S-10

**Implement #74 Actions UI** · 2026-10-03 18:49 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> do next

<details><summary>Prompt sent (1,360 characters)</summary>

~~~~text
Implement GitHub Issue #74 of Kiatisakk/toktickit ("Actions Taken on Ticket Detail"). Branch `feature/actions-taken-ui` from `origin/lab4-staging`. Board item `PVTI_lAHOCB2G0s4BfVCSzg-PeVg`. Migration timestamp if you need one: `20261004120000`.

Read, in order, and follow:
1. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`
2. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\wave2-brief.md` (overrides the common brief where they differ)
3. `gh issue view 74` and the contract in `docs/lab-04/` — ui-spec's Actions Taken area is the main source; api-spec for the endpoints #73 built.

Notes specific to #74: the API exists (`server/src/routes/actions.ts`); this Issue is the client. Keep the create form's `requestId` across retries of the same submission and mint a new one only for a new submission (AC-48 in the UI). Follows-up is read-only in edit mode. The Requester sees the list read-only with no write controls. Stale Action writes use the same stale message wording as the Ticket forms (ui-spec §8). Layout claims at desktop/tablet/mobile (AC-43) are measured by #77's e2e, not jsdom — do not mark that row Pass; do make the CSS sound (no fixed widths, wrapping long text).
~~~~

</details>

### S-11

**Implement #75 resolution gate** · 2026-10-03 18:49 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> do next

<details><summary>Prompt sent (1,592 characters)</summary>

~~~~text
Implement GitHub Issue #75 of Kiatisakk/toktickit ("The resolution gate"). Branch `feature/resolution-gate` from `origin/lab4-staging`. Board item `PVTI_lAHOCB2G0s4BfVCSzg-PeY8`. Migration timestamp if you need one: `20261004100000`.

Read, in order, and follow:
1. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`
2. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\wave2-brief.md` (overrides the common brief where they differ)
3. `gh issue view 75` and the contract in `docs/lab-04/` (D-03, BR-16, the status matrix, `RESOLUTION_GATE_FAILED` and its `details` keys `doneAction`, `openFollowUp`, `plannedActions`, `resolutionSummary`).

Notes specific to #75: the gate is enforced in the backend inside the same transaction that takes the Ticket lock (`server/src/tickets/lock.ts`, `lockTicket`), so a resolve racing an Action write is serialised (AC-27) — write a concurrency test in the style of `server/tests/lab-04/concurrency.api.test.ts` and mutation-check it (remove the lock → the test fails). One response names every unmet condition at once. Every path into Resolved is gated, including direct API calls from every non-terminal status; the Requester's resolution indication does not bypass it. The status change still writes its version bump and its TicketStatusChange row (#72). The resolve dialog lists the unmet conditions in text and updates from a server refusal. UI-36 in tests.md is yours to finish.
~~~~

</details>

### S-12

**Implement #76 dashboards** · 2026-10-03 18:49 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> do next

<details><summary>Prompt sent (1,916 characters)</summary>

~~~~text
Implement GitHub Issue #76 of Kiatisakk/toktickit ("Role dashboards and the /dashboard landing page"). Branch `feature/role-dashboards` from `origin/lab4-staging`. Board item `PVTI_lAHOCB2G0s4BfVCSzg-Pedk`. Migration timestamp if you need one: `20261004110000`.

Read, in order, and follow:
1. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`
2. `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\wave2-brief.md` (overrides the common brief where they differ)
3. `gh issue view 76` and the contract in `docs/lab-04/` — the dashboard metric table in specification.md (each card's exact predicate, empty behaviour, drill-down), D-09 to D-15, api-spec's dashboard endpoints, ui-spec's dashboard sections.

Notes specific to #76: every card is computed by the backend and its drill-down link is returned by the API (BR-34); following a drill-down must list exactly what the card counted — test that equality directly for every card against the queue/My Tickets endpoint (AC-30), and test each count against a direct database count (AC-28). Deltas come from TicketStatusChange with the day boundary at midnight Asia/Bangkok — test both sides of the boundary with fixed timestamps, not the wall clock. `statusGroup=open` and `followUp=mine` filters (D-15) are new on the existing list endpoints. `/dashboard` becomes the landing page for every role, first in navigation (D-12): Lab 1–3 tests that assert the old landing route are updated only as far as D-16 requires, with the reason beside each. The seed (AC-37) must be idempotent and include every status, Tickets with 0/1/several Actions, an open follow-up, and both zero and non-zero metrics — run it twice and assert nothing duplicated. Fixed-timestamp tests: do not depend on the current date.
~~~~

</details>

### S-13

**Re-review Beam PR 82 fixes** · 2026-10-03 18:49 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> do next

<details><summary>Prompt sent (3,635 characters)</summary>

~~~~text
Draft the RE-review of @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/82 (Actions Taken UI, his Issue #74). You DRAFT; you do not post anything to GitHub. The main session checks and posts.

Context: our first review (review id 5400167296, Request changes, 12 line comments) is in `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review82.json`. He replied to every thread naming a fix commit, pushed (head now `1023107` or later), added the `lab-04` label and re-requested our review. Read his replies: `gh api repos/beambeambeam/toktickit/pulls/82/comments` (his are `in_reply_to_id` children of ours).

Procedure rules: `C:\Users\kiati\Documents\toktickit\CLAUDE.md` (Reviewing section) and `C:\Users\kiati\Documents\toktickit\.claude\skills\lab-sprint\review-given.md`. Caveman style (`C:\Users\kiati\Documents\toktickit\.claude\skills\caveman-review\SKILL.md`).

Work in the existing clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` — `git fetch` and check out the PR head (`gh pr checkout 82 --force` or reset the local branch to `origin`'s PR head). Do not touch `C:\Users\kiati\Documents\toktickit` or any of its worktrees: three implementation agents are working there.

DATABASE: our local PostgreSQL (localhost:5433, `toktickit`, `toktickit_test`) holds OUR schema and is busy with three agents. Never run his migrations, seed or server tests against those. If you need his server tests to confirm a server fix (Resolved now 409 `TICKET_TERMINAL`; `INTERNAL_ERROR` on list failure; `details.field` on `ACTION_ASSIGNEE_INELIGIBLE`; hash field order), create a dedicated database `beam82_review` on the same server (credentials from `C:\Users\kiati\Documents\toktickit\server\.env.test`), point his `.env.test` at it, migrate only that one, run only the relevant server test files, and drop exactly `beam82_review` afterwards. The machine is loaded: run targeted test files, not full suites, and use `--maxWorkers=2`.

For each of the 12 findings: is the fix actually in the code at the head, does a test now prove it (and would it fail without the fix — a quick mutation where cheap), and does the contract/tests.md/README now agree? Specifically check the Resolved contradiction is resolved in the documents both ways (BR-10's "terminal" wording vs AC-13/error table/ui-spec) — he said the API wording and OpenAPI now agree; check BR-10 too. For the screenshot provenance: `git cat-file -t <sha>` on the new source commit he cites, and confirm it is an ancestor of the PR head. Also skim the diff of all commits since `7e96a8a` for anything new that is wrong (new findings only if confirmed).

Process: label `lab-04` present; `closingIssuesReferences` still #74; did he update his `reviewer.md` with our review and `ai-use.md`/log for #74 (we asked in the body)?

Output `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview82.json` in the same shape (`event`, `body`, `comments` — comments only for NEW confirmed findings or a fix that is incomplete, on lines inside `gh pr diff 82`). Verdict: APPROVE only if every finding is verified fixed and nothing blocking is new; otherwise REQUEST_CHANGES naming exactly what remains. Body: one line per original finding — ✅ verified (how) or ❌ (what is missing).

Report back: verdict; the 12-line verification table with how each was checked; new findings with evidence; test counts you ran; anything not verified.
~~~~

</details>

### S-14

**Fix Beam review on PR 82** · 2026-10-06 16:50 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam review แล้วทั้ง 3 pr แล้วก็รีวิวให้บีมด้วย https://github.com/beambeambeam/toktickit/pull/83

<details><summary>Prompt sent (2,139 characters)</summary>

~~~~text
Fix @beambeambeam's review of PR #82 (https://github.com/Kiatisakk/toktickit/pull/82, Issue #74 Actions Taken UI, branch `feature/actions-taken-ui`). Read and follow `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md` first; also `...\scratchpad\wave2-brief.md` beside it for file ownership.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\agent-a1f3c75e2295d0e74` (branch checked out; `git pull --ff-only` first — the main session pushed `ec355be` there). Board item `PVTI_lAHOCB2G0s4BfVCSzg-PeVg`. Two other agents are fixing PR #83 and #84 at the same time in other worktrees.

Review 5405306621 (verdict COMMENT, but treat findings as to-fix: card to Fixing, then back to PR Review). Two line findings:

1. #4176963071 `client/src/components/ActionForm.tsx:291` — "fields stay editable after Save captures the request body, so success closes the form and drops edits made in flight. Disable controls while busy (also in `ActionStepForm`)." Red first: a test that types into a field while the save is pending and shows the edit is lost (or that the field is enabled while busy). Fix: disable the inputs (a `<fieldset disabled>` is the simple route) while busy, in both forms, keeping focus sensible.

2. #4176963074 `client/src/components/ActionsTaken.tsx:126` — "an in-flight write can resolve after another row opens a form; this closes the newer form and discards its draft. Guard by the submitted mode or block mode changes while busy." Red first: a test with a held write response, open another row's form, release the response, assert the newer form and its draft survive. Pick one fix and say which (guarding the close by the mode that submitted is less intrusive than blocking all row buttons, but check how ui-spec describes busy state).

Record the round in `docs/lab-04/reviewer.md` (verdict Comment, 2 findings). If `reviewer.md` does not yet have PR #82/#83/#84 sections on this branch, add only #82's. Gates: client `tsc -b`, `vitest run`; ultracite. Server suite only if you touch server code (you should not).
~~~~

</details>

### S-15

**Fix Beam review on PR 83** · 2026-10-06 16:50 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam review แล้วทั้ง 3 pr แล้วก็รีวิวให้บีมด้วย https://github.com/beambeambeam/toktickit/pull/83

<details><summary>Prompt sent (1,572 characters)</summary>

~~~~text
Fix @beambeambeam's review of PR #83 (https://github.com/Kiatisakk/toktickit/pull/83, Issue #76 dashboards, branch `feature/role-dashboards`). Read and follow `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md` first; also `...\scratchpad\wave2-brief.md` beside it.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\agent-ad7f9fa8d05a91e22` (branch checked out; `git pull --ff-only` first). Board item `PVTI_lAHOCB2G0s4BfVCSzg-Pedk`. Two other agents are fixing PR #82 and #84 at the same time.

Review 5405297014 (verdict COMMENT; treat as to-fix: card to Fixing, then back to PR Review). One line finding:

#4176956476 `client/src/routes/MyTickets.tsx:55` — "The digit-only check accepts 0 and unsafe integers, but the API requires positive safe IDs and returns 400. Keep only positive safe integers; apply the same guard to queue categoryId and ownerId."
Red first: tests that `?categoryId=0` and `?categoryId=99999999999999999999` (and the queue's categoryId/ownerId) are ignored, not sent. Fix with one shared helper (e.g. `positiveSafeIntegerParam`) used by both screens; check the server's own rule for these ids (`server/src/tickets/ticketQuery.ts`) so the client rule matches it exactly, and check whether any other URL filter on these screens has the same gap.

Record the round in `docs/lab-04/reviewer.md` (verdict Comment, 1 finding). If the file lacks a PR #83 section on this branch, add only #83's. Gates: client `tsc -b`, `vitest run`; ultracite.
~~~~

</details>

### S-16

**Fix Beam review on PR 84** · 2026-10-06 16:50 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam review แล้วทั้ง 3 pr แล้วก็รีวิวให้บีมด้วย https://github.com/beambeambeam/toktickit/pull/83

<details><summary>Prompt sent (2,035 characters)</summary>

~~~~text
Fix @beambeambeam's review of PR #84 (https://github.com/Kiatisakk/toktickit/pull/84, Issue #75 resolution gate, branch `feature/resolution-gate`). Read and follow `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md` first; also `...\scratchpad\wave2-brief.md` beside it.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\agent-a69a660313c4c9f53` (branch checked out; `git pull --ff-only` first). Board item `PVTI_lAHOCB2G0s4BfVCSzg-PeY8`. Two other agents are fixing PR #82 and #83 at the same time (client-only, but they may run tests).

Review 5405295367 (verdict COMMENT; treat as to-fix: card to Fixing, then back to PR Review). One line finding:

#4176955245 `server/src/routes/staffTickets.ts:488` — "A concurrent status change can hit this gate refusal before the locked version check, returning `400 RESOLUTION_GATE_FAILED` instead of `409 STALE_UPDATE`. Check the locked version before evaluating the gate."
Verify by reading the transaction in the status route: inside `lockTicket`, the order must be (1) lock, (2) compare the locked row's version with the request's, refuse `409 STALE_UPDATE` with nothing written, (3) only then the matrix and the gate. Red first: an API test where the request carries an old `version` and the Ticket's Actions do not satisfy the gate — the answer must be 409 STALE_UPDATE, not 400 (no concurrency needed to show the ordering; add a concurrent variant only if cheap). Also check the same ordering for the other status targets and for any other route that evaluates a rule before the version check; report what you find. Update api-spec.md if it states an evaluation order, and tests.md.

Record the round in `docs/lab-04/reviewer.md` (verdict Comment, 1 finding). If the file lacks a PR #84 section on this branch, add only #84's. Gates: server `tsc --noEmit`, `vitest run` (shared-DB flakes: rerun the file alone and report both); client `tsc -b` and vitest if touched; ultracite.
~~~~

</details>

### S-17

**Draft review of Beam PR 83** · 2026-10-06 16:51 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam review แล้วทั้ง 3 pr แล้วก็รีวิวให้บีมด้วย https://github.com/beambeambeam/toktickit/pull/83

<details><summary>Prompt sent (3,998 characters)</summary>

~~~~text
Draft a code review of @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/83 ("Edit and assign pending Actions Taken safely (#75)", base `lab4-staging`, head `feature/75-edit-and-assign-pending-action-taken-safely`, 62 files, +5740/−345). You DRAFT; you do not post anything to GitHub.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md` — *Reviewing (when I am the reviewer)*.
- `C:\Users\kiati\Documents\toktickit\.claude\skills\lab-sprint\review-given.md`, `gotchas.md`, and `C:\Users\kiati\Documents\toktickit\.claude\skills\caveman-review\SKILL.md` (caveman style: one line per finding, `🔴 bug:` / `🟡 risk:` / `🔵 nit:` / `❓ q:`, problem, fix; security/architecture findings get a short paragraph).
- His Issue: `gh issue view 75 --repo beambeambeam/toktickit` and its acceptance criteria. His contract `docs/lab-04/` on his `lab4-staging` — review against HIS contract, not ours.
- Our previous reviews of him as models of depth and tone: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review82.json` and `rereview82.json`.

## Where to work
The existing clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82`: `git fetch origin`, then `gh pr checkout 83 --force`. Do not touch `C:\Users\kiati\Documents\toktickit` or its worktrees — three agents are working there.

## DATABASE CAUTION
Our PostgreSQL (localhost:5433, `toktickit`, `toktickit_test`) holds OUR schema and is busy. Never run his migrations, seed or server tests against those. For his server tests, create a dedicated database `beam83_review` on the same server (credentials from `C:\Users\kiati\Documents\toktickit\server\.env.test`), point his `.env.test` at it, migrate only that, run targeted files only (`--maxWorkers=2`), and drop exactly `beam83_review` afterwards. `pnpm` is not on PATH: last time the fixture's `execFileSync("pnpm", ...)` needed a temporary local patch to call `node_modules` binaries directly — revert any such patch with `git checkout` before finishing.

## What to check
1. Process: base `lab4-staging`; `lab-04` label (present); **`closingIssuesReferences` is EMPTY — his Issue #75 is not linked** (a process finding in the body: link with `addCloseIssueReferences`); reviewer.md / tests.md / ai-use log updated as his contract requires.
2. Every acceptance criterion of his #75: implemented, and which test proves it. AC → test table.
3. Correctness against his contract — this Issue is about editing and assigning PENDING actions SAFELY: version/stale handling (409 VERSION_CONFLICT per his spec), the Ticket-then-action lock order, assignee eligibility rechecked under lock (deactivation race), what is editable in which action status (Planned/In Progress vs Completed/Cancelled → ACTION_TERMINAL), Resolved/Closed/Cancelled Ticket refusal (we made him fix this on #82 — check it holds for edit/assign too), immutable event/history rows for each edit, authorization (Requester cannot write; staff/admin can), strict body (unknown/inherited keys like `__proto__`), validation beside the field in the UI, focus management, double-submit, retained drafts, tests that can actually fail.
4. **Verify each suspicion empirically** (run the test, a throwaway test, or a mutation) before keeping it. Drop anything unconfirmed, or mark it `❓ q:`. A clean PR deserves APPROVE — do not invent findings.

## Output
Write `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review83.json` in the same shape as review82.json (`event`, `body`, `comments` with `path`, `line` in the NEW file, `side: "RIGHT"`, `body`). Every line must be inside `gh pr diff 83 --repo beambeambeam/toktickit` — check each.

Report back: verdict and why; each finding with how you confirmed it; the AC → test table; test counts run; anything not verified. Post nothing.
~~~~

</details>

### S-18

**Re-review beambeambeam#83** · 2026-10-07 13:28 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> fix conflict and re-review pr 83 beam if passed merge it

<details><summary>Prompt sent (3,825 characters)</summary>

~~~~text
You re-review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/83 ("Edit and assign pending Actions Taken safely", his Issue #75), now at head `9cbb6b6`. We reviewed it before (review 5432256905, REQUEST_CHANGES at head 571690e). DRAFT only — do NOT post anything to GitHub, do not merge, do not resolve threads. The main session verifies and posts.

## Our previous findings and his replies
1. actions-taken-edit.tsx (was L357/L379) 🟡 focus lost after "Refresh and review" (button disappears while focused). He says fixed in d837355: successful refresh focuses the "Latest saved values" heading.
2. actions-taken-edit.tsx (was L186/L206) 🟡 server field error doesn't move focus. He says fixed in cf2fa29: focuses first affected control after the form enables it.
3. actions-taken-history.tsx ❓ bare "Assignee ID 7". He says b39a8a5: history now shows names from the current assignee list (snapshot stores id only).
4. server/tests/lab-04/actions-edit.api.test.ts (was L590/592) 🟡 no test proves the Ticket lock on edit — deleting `await lockTicket(database, ticketId)` from `editAction` in repositories/actions.ts left all 7 tests green. He says 7ca8895 adds a test that observes a blocked Ticket SELECT FOR UPDATE before committing a concurrent resolution.
Process: Issue #75 not linked (he says linked now — check `gh pr view 83 --repo beambeambeam/toktickit --json closingIssuesReferences`); ai-use.md missing #75 entry (he says added in a5abb9b). Read all his replies: `gh api repos/beambeambeam/toktickit/pulls/83/comments` and `gh pr view 83 --repo beambeambeam/toktickit --json comments`.

## How
- Work in the existing clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` (beambeambeam/toktickit). `git fetch` and check out the PR head `9cbb6b6` (detached). Read `git diff 571690e..9cbb6b6` for what changed since our review, and check nothing new is broken.
- Verify each fix in CODE, not replies: run his relevant tests and do a mutation check per fix (revert the fix → the test goes red → restore; confirm with `git diff --quiet`, and confirm your edit actually applied). For #4 specifically: delete the lockTicket call in editAction again and confirm the new test fails.
- Database: our Docker Postgres `toktickit-db` on localhost:5433 holds OUR databases `toktickit`/`toktickit_test` — never touch, reset or drop them. Run his server tests against a throwaway database: either a private PostgreSQL cluster on another port (as done last time on 5499, with PostgreSQL 18 binaries) or a new database you create with a unique name like `beam83_rr_<random>` on 5433 and drop afterwards. Read his repo's README/env files to see how his tests pick their DB. Clean up whatever you create.
- Run his Lab 4 client tests and `tsc` for the client; run the server suites relevant to Actions edit. Report real counts.
- Never commit or push to his repo.

## Output
Return: per finding, Fixed / Not fixed / Partly, with the evidence (test name, mutation result). Process items checked. Any NEW problem in 571690e..9cbb6b6 (severity 🔴/🟡/🔵/❓, file:line in the new head, line must be inside `gh pr diff 83 --repo beambeambeam/toktickit`). Your verdict recommendation (APPROVE or REQUEST_CHANGES) — approve unless there is a real defect against his Issue's acceptance criteria. Also a draft review body in caveman style (terse, one line per item, ✅ per verified fix, like "✅ Focus after refresh: ... ; reverting fails <test>"), saved to `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview83.json` as {"event": ..., "body": ..., "comments": [...]} with comments only for genuinely new findings. List what you could not verify.
~~~~

</details>

### S-19

**Implement Issue #77 e2e** · 2026-10-08 07:12 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam merge laa then continue

<details><summary>Prompt sent (898 characters)</summary>

~~~~text
You implement GitHub Issue #77 of Kiatisakk/toktickit (CPE 334 Lab 4): "End-to-end journeys and visual evidence for Lab 4". Read `gh issue view 77` first.

Your brief is `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\e2e77-brief.md` — read it in full; it points to the common brief, which you also read in full. The brief overrides the common brief where they differ.

Work only in the existing worktree `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-e2e` on branch `feature/lab4-e2e`. Open the PR to `lab4-staging`, link it to Issue #77, request @beambeambeam, label `lab-04`, move the card to PR Review — all as the common brief says. Never merge, never close Issues, never reset databases, never force-push, never kill processes you did not start.

Report exactly what passed and what failed, with counts.
~~~~

</details>

### S-20

**Fix Beam's review on PR #85** · 2026-10-08 17:44 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam review

<details><summary>Prompt sent (3,931 characters)</summary>

~~~~text
You fix @beambeambeam's review (5458186644, CHANGES_REQUESTED) on our PR https://github.com/Kiatisakk/toktickit/pull/85 (Issue #77, Lab 4 e2e journeys and screenshots). Board item for #77: `PVTI_lAHOCB2G0s4BfVCSzg-PehQ`.

Read the procedure first and follow it exactly: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\fix-brief-common.md`. Also read `...\scratchpad\e2e77-brief.md` (same folder) — its Database, Lab 2/3 screenshots and gates sections apply. Ignore the fix brief's note about another agent running in parallel: you are alone.

Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-e2e`, branch `feature/lab4-e2e` (head 2cd804e). Env files already present.

## The two findings (both in `e2e/lab-04/support.ts`, the console guard that proves AC-47)
1. comment 4220224157, L71: "🟡 risk: the matcher accepts every 4xx as a designed refusal, so unexpected 401/422/429 responses bypass AC-47. Match only expected endpoint/status pairs."
2. comment 4220224171, L77: "🟡 risk: every `ERR_FAILED` console error is counted as intentional, and the request handler at L123 also ignores it, so unrelated fetch failures bypass AC-47. Allow only URLs the test deliberately aborts."

Both appear real. Fix design: make tolerance explicit and per-test. A test that deliberately provokes a refusal or aborts a request declares it (e.g. `guard.expectRefusal(method, urlPattern, status)` / `guard.expectAbort(urlPattern)`, or register it in the same helper that sets up the route); everything not declared fails the test. The browser's console error for a declared 4xx/abort is tolerated only when it can be tied to a declared request (match on URL in the console message / location, or on the response/requestfailed event). An expectation declared but never observed should also fail (so stale allowances don't accumulate) — implement that if it is straightforward.

Red first: before the fix, write the regression proof — e.g. a small spec (or a test inside an existing Lab 4 spec) that triggers an undeclared 4xx (such as a 422 from a route stub, or a real 401 call) and an undeclared aborted fetch, and assert the guard reports them (use `test.fail()` or catch the guard's verdict, whatever is cleaner and stays in the suite). Show it failing on the current guard. Then fix, then update every existing caller that relies on a designed refusal or abort to declare it.

## Gates
- Full `e2e/lab-04` on desktop, tablet and mobile plus the Lab 3 specs #76 edited (`e2e/lab-03/authentication.spec.ts`, `user-administration.spec.ts`), after `npm run e2e:prepare`. Report counts per project and any flake with its rerun.
- `npx tsc --noEmit -p e2e` (or however e2e is typechecked in this repo), ultracite check.
- After runs: `git status --short artifacts/lab-02 artifacts/lab-03` must be empty — restore with `git checkout --` if the Lab 3 specs rewrote them. Lab 4 screenshots that changed only because of timestamps/ticket numbers: do not commit them unless a screenshot's state really changed (say which).
- Mutation checks: remove one declaration from a caller → that test fails; and revert the matcher to the old any-4xx rule → your regression test fails. Restore; `git diff --quiet` on the source.
- Update `tests.md` E2E-13 (and any row whose wording described the old lenient rule) and `docs/lab-04/reviewer.md` with this round (follow the existing PR entries' form; add #85 to Coverage as received).

Reply on both threads with what changed and the commit sha. Do not resolve threads. Card to Fixing at start, back to PR Review at the end, re-request beambeambeam. Never merge, never close Issues, never force-push, never post on beambeambeam's repo, never reset databases, never kill processes you did not start.

Report: per finding, real or not, the red-first evidence, the fix, the commits, gate counts, mutation results, reply ids.
~~~~

</details>

### S-21

**Implement Issue #78 hardening** · 2026-10-11 18:10 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam merge laa do next issue and review beam pr 84 and 85

<details><summary>Prompt sent (946 characters)</summary>

~~~~text
You implement GitHub Issue #78 of Kiatisakk/toktickit (CPE 334 Lab 4): "Final regression and hardening". Read `gh issue view 78` first.

Your brief is `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\hardening78-brief.md` — read it in full; it points to the common brief, which you also read in full. The brief overrides the common brief where they differ.

Work only in the existing worktree `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-hardening` on branch `feature/lab4-hardening`. Open the PR to `lab4-staging`, link it to Issue #78, request @beambeambeam, label `lab-04`, move the card to PR Review — all as the common brief says. Never merge, never close Issues, never reset databases, never force-push, never kill processes you did not start, never post on github.com/beambeambeam/toktickit.

Report exactly what passed and what failed, with counts.
~~~~

</details>

### S-22

**Review beambeambeam#84** · 2026-10-11 18:11 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam merge laa do next issue and review beam pr 84 and 85

<details><summary>Prompt sent (3,704 characters)</summary>

~~~~text
You review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/84 ("Progress, complete, and cancel Actions Taken", his Issue #76), head `3811098`, base `lab4-staging`, ~43 files. DRAFT ONLY — do not post anything to GitHub, do not merge, do not resolve threads. The main session verifies and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md`, section "Reviewing (when I am the reviewer)" — one finding per line, all in one review.
- Style: caveman — `<🔴 bug|🟡 risk|🔵 nit|❓ q>: <problem>. <fix>.` One line per finding, exact symbol names in backticks, the *why* only when not obvious. Drop throat-clearing.
- His Issue: `gh issue view 76 --repo beambeambeam/toktickit`, and his contract in `docs/lab-04/` on his repo (specification, api-spec, ui-spec, tests.md). Review against HIS acceptance criteria and contract, not ours.
- Our earlier reviews of his PRs, for continuity and to see what he already fixed: `gh api repos/beambeambeam/toktickit/pulls/82/reviews`, `.../pulls/83/reviews`.

## Where
- Clone: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` (his repo). Another agent may use a different clone for his PR #85 — do not use any other folder. `git fetch origin pull/84/head:pr84 && git checkout pr84` (detached is fine). Leave the clone clean at the end (revert mutations, generated files).
- Database: run his server tests on a **private PostgreSQL cluster on port 5498** (PostgreSQL 18 binaries were used before for port 5499; find them, `initdb` into a temp dir in the scratchpad, start, create the DBs his env expects). NEVER touch our Docker DB on localhost:5433 (`toktickit`, `toktickit_test`). Stop the cluster and delete its data dir at the end. `pnpm` may be missing from PATH; work around without committing anything (earlier: `npx prisma` with `shell: true` in a helper, reverted after).

## How
1. Read `gh pr diff 84 --repo beambeambeam/toktickit` against his Issue's acceptance criteria. Check lock order, version/stale checks, state machine (Planned → Done|Cancelled), terminal-Ticket refusals, follow-up rules, authorization, validation, UI states (busy, errors, focus), accessibility, docs updated (tests.md rows, ai-use.md entry, reviewer.md), Issue linked (`gh pr view 84 --repo beambeambeam/toktickit --json closingIssuesReferences`), label `lab-04`.
2. Verify every finding before keeping it: reproduce with a throwaway test or a run, or point to the exact line and contract clause. For each important server rule, a mutation check (remove the rule → does any test fail?). An untested rule is a 🟡 finding on the test file.
3. Run his server and client tests that this PR touches, and `tsc`. Report real counts.
4. Every inline comment's line must be inside the PR diff (RIGHT side, new-file line number). Check each against `gh pr diff` hunks before finalising.

## Output
- Save the draft to `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review-beam84.json` as `{"event": "APPROVE"|"REQUEST_CHANGES"|"COMMENT", "body": "...", "comments": [{"path","line","side":"RIGHT","body"}]}`. Body: one-line verdict, tally, process items without a line, what was verified and how, what was NOT verified. Request changes only for a real defect against his acceptance criteria or a missing process item (Issue link, ai-use entry); otherwise approve with comments.
- Report: each finding with its evidence (how you confirmed it), severity rationale, test counts, mutation results, what you could not verify, and confirmation the cluster is gone and the clone is clean.
~~~~

</details>

### S-23

**Review beambeambeam#85** · 2026-10-11 18:11 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam merge laa do next issue and review beam pr 84 and 85

<details><summary>Prompt sent (3,828 characters)</summary>

~~~~text
You review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/85 ("Deliver the Requester dashboard and exact drill-down", his Issue #78), head `ace9bc8`, base `lab4-staging`, ~63 files. DRAFT ONLY — do not post anything to GitHub, do not merge, do not resolve threads. The main session verifies and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md`, section "Reviewing (when I am the reviewer)" — one finding per line, all in one review.
- Style: caveman — `<🔴 bug|🟡 risk|🔵 nit|❓ q>: <problem>. <fix>.` One line per finding, exact symbol names in backticks, the *why* only when not obvious.
- His Issue: `gh issue view 78 --repo beambeambeam/toktickit`, and his contract in `docs/lab-04/` on his repo. Review against HIS acceptance criteria and contract (metric definitions, drill-down must reproduce each card's count exactly, day boundary/time zone, empty states, Requester sees only own tickets).
- Our earlier reviews of his PRs: `gh api repos/beambeambeam/toktickit/pulls/82/reviews`, `.../pulls/83/reviews`.

## Where
- Make a NEW clone: `git clone https://github.com/beambeambeam/toktickit C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam85` (another agent uses the `beam82` clone for his PR #84 — do not touch it). `git fetch origin pull/85/head:pr85 && git checkout pr85`. Install dependencies there.
- Check whether his #85 is stacked on his #84 (`git merge-base`, `gh pr view 85 --json commits`); if so, review only #85's own commits and say so.
- Database: run his server tests on a **private PostgreSQL cluster on port 5497** (PostgreSQL 18 binaries were used before for a cluster on 5499; find them, `initdb` into a temp dir in the scratchpad, start, create the DBs his env expects). NEVER touch our Docker DB on localhost:5433 (`toktickit`, `toktickit_test`). Stop the cluster and delete its data dir at the end. `pnpm` may be missing from PATH; work around without committing anything.

## How
1. Read `gh pr diff 85 --repo beambeambeam/toktickit` against his Issue's acceptance criteria. Key: for every Requester card, does the drill-down list return exactly the rows the count counts (write an independent SQL count and compare against the API on seeded data)? Ownership scoping (a Requester never sees another's tickets via cards or drill-down params — try tampering query params). Time-zone/day-boundary correctness. Loading/empty/failure/forbidden states, focus, accessibility, responsive. Docs: tests.md rows, ai-use.md entry, reviewer.md; Issue linked (`closingIssuesReferences`); label `lab-04`.
2. Verify every finding before keeping it: reproduce with a throwaway test or a run, or cite the exact line and contract clause. Mutation-check important rules (remove the rule → does any test fail?); an untested rule is a 🟡 finding on the test file.
3. Run his server and client tests this PR touches, and `tsc`. Report real counts.
4. Every inline comment's line must be inside the PR diff (RIGHT side, new-file line number); check each against the `gh pr diff` hunks.

## Output
- Save the draft to `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review-beam85.json` as `{"event": ..., "body": "...", "comments": [{"path","line","side":"RIGHT","body"}]}`. Body: one-line verdict, tally, process items without a line, what was verified and how, what was NOT verified. Request changes only for a real defect against his acceptance criteria or a missing process item; otherwise approve with comments.
- Report: each finding with evidence, severity rationale, test counts, mutation results, what you could not verify, and confirmation the cluster is gone (and leave the clone clean of mutations).
~~~~

</details>

### S-24

**Review beambeambeam#85** · 2026-10-11 18:57 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> ok sorry beam tell me to review this TwT can you continue

<details><summary>Prompt sent (4,255 characters)</summary>

~~~~text
You review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/85 ("Deliver the Requester dashboard and exact drill-down", his Issue #78), head `ace9bc8`, base `lab4-staging`, ~63 files. He asked us (the user) to review it. DRAFT ONLY — do not post anything to GitHub, do not merge, do not resolve threads. The main session verifies and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md`, section "Reviewing (when I am the reviewer)" — one finding per line, all in one review.
- Style: caveman — `<🔴 bug|🟡 risk|🔵 nit|❓ q>: <problem>. <fix>.` One line per finding, exact symbol names in backticks, the *why* only when not obvious.
- His Issue: `gh issue view 78 --repo beambeambeam/toktickit`, and his contract in `docs/lab-04/` on his repo. Review against HIS acceptance criteria and contract (metric definitions, drill-down must reproduce each card's count exactly, day boundary/time zone, empty states, Requester sees only own tickets). Quote the contract line you rely on — verify the quoted text exists.
- Our earlier reviews of his PRs: `gh api repos/beambeambeam/toktickit/pulls/82/reviews`, `.../83/reviews`, `.../84/reviews` (we just requested changes on #84 for lost success feedback/focus after a terminal transition and untested server rules — look for the same patterns here).

## Where
- Existing clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam85`, checked out clean at `ace9bc8`. A previous attempt was stopped midway; its edits were reverted. Do not use the `beam82` clone. `node_modules` may need `corepack pnpm install --frozen-lockfile --ignore-scripts` (ignore-scripts avoids installing git hooks; if hooks appear in `.git/hooks`, remove them at the end).
- Check whether his #85 is stacked on his #84 (`git merge-base`, `gh pr view 85 --repo beambeambeam/toktickit --json commits`); if so, review only #85's own commits and say so.
- Database: a **private PostgreSQL 18 cluster on port 5497** (`C:\Program Files\PostgreSQL\18\bin`): `initdb` into `scratchpad\pg5497\data`, start with `pg_ctl -D <data> -o "-p 5497" -l <log> start`, create the DBs his env expects. NEVER touch our Docker DB on localhost:5433 (`toktickit`, `toktickit_test`). At the end, `pg_ctl -D <data> stop -m fast`, confirm nothing listens on 5497, delete the folder. `pnpm` may be missing from PATH; work around without committing (revert any helper edit).

## How
1. Read `gh pr diff 85 --repo beambeambeam/toktickit` against his acceptance criteria. Key: for every Requester card, does the drill-down list return exactly the rows the count counts (independent SQL count vs the API on seeded data)? Ownership scoping (try tampering drill-down query params as another Requester). Time-zone/day-boundary correctness. Loading/empty/failure/forbidden states, focus, accessibility, responsive. Docs: tests.md rows, ai-use.md entry, reviewer.md; Issue linked (`closingIssuesReferences`); label `lab-04`.
2. Verify every finding before keeping it: reproduce with a throwaway test or a run, or cite the exact line and contract clause. Mutation-check the important rules (remove the rule → does any test fail?); an untested rule is a 🟡 finding on the test file.
3. Run his server and client tests this PR touches, and `tsc`. Report real counts.
4. Every inline comment's line must be inside the PR diff (RIGHT side, new-file line number); check each against the `gh pr diff` hunks with a parser.

## Output
- Save the draft to `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review-beam85.json` (UTF-8) as `{"event": ..., "body": "...", "comments": [{"path","line","side":"RIGHT","body"}]}`. Body: one-line verdict, tally, process items without a line, what was verified and how, what was NOT verified. Request changes for a real defect against his acceptance criteria or own contract, or a missing process item; otherwise approve with comments.
- Report: each finding with evidence, severity rationale, test counts, mutation results, what you could not verify, and confirmation the cluster is gone and the clone is clean (`git status` empty, no hooks).
~~~~

</details>

### S-25

**message to a running agent** · 2026-10-11 19:33 UTC · Follow-up to S-21 · Sonnet 5.5

Triggered by the user prompt:

> pr 85 ทำต่อจากอันเดิมไหมนะ

<details><summary>Prompt sent (492 characters)</summary>

~~~~text
Heads-up from the main session: another agent ran `taskkill /F /IM node.exe` a short while ago, which may have killed node processes you started (vitest runs, Playwright web servers, dev:test). If a run of yours ended abruptly or with odd failures, rerun it before trusting its result, and say in your report which runs were affected. Don't kill anything yourself to recover; if ports 3000/5173 are held by a server you did not start, check whether it points at the test DB before reusing it.
~~~~

</details>

### S-26

**Re-review beambeambeam#84** · 2026-10-12 06:39 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> re-review beam if ok then merge

<details><summary>Prompt sent (3,522 characters)</summary>

~~~~text
You re-review classmate @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/84 (his Issue #76, Actions progress/complete/cancel), now at head `8b13c6a`. We reviewed it at `3811098` (review 5484501760, REQUEST_CHANGES, 8 inline comments). DRAFT ONLY — do not post, merge or resolve anything on GitHub.

## Our previous findings
Read them and his replies: `gh api repos/beambeambeam/toktickit/pulls/84/comments` (ours are by Kiatisakk; his replies have `in_reply_to_id`) and `gh pr view 84 --repo beambeambeam/toktickit --json comments`. Main one: after Complete/Cancel, `if (!canProgress) return null` in `actions-taken-controls.tsx` unmounted the success `role="status"` region, focus dropped to `<body>` (his ui-spec L94/L95), and two UI tests passed on a single render. Also three untested server rules in `server/src/repositories/actions.ts` `transitionAction`: the `action.assigneeId !== actionSnapshot.assigneeId` check, `actor-inactive` (`actor === null || !actor.isActive`), and the completion-time assignee recheck (`startsAction || completesAction`). Plus 2 nits and 1 question.

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` only (another agent uses `beam85`). `git fetch origin pull/84/head:pr84b && git checkout pr84b`. If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`. A copy of pnpm.exe may be in scratchpad `bin\`.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5498**: initdb into `scratchpad\pg5498\data`, `pg_ctl -D <data> -o "-p 5498" -l <log> start`. Never touch localhost:5433. At the end `pg_ctl -D <data> stop -m fast`, confirm nothing listens on 5498, delete the folder.

## HARD RULE
NEVER run `taskkill /IM node.exe` or kill any process by image name — the user runs a dev server and another agent runs tests. Only kill a process by the PID you started yourself.

## How
1. `git diff 3811098..8b13c6a` — what changed. Check each fix in CODE, not replies. For each previous finding: Fixed / Not fixed / Answered (for the question/nits, an answer with a reason is acceptable).
2. Mutation per fix: revert the fix (or delete the rule again) → the new/updated test fails → restore; check `git diff --quiet`. Specifically: delete each of the three server rules again and confirm a test now fails; make the success region unmount again and confirm the UI test fails.
3. Check nothing new is broken in the delta; run his server and client tests touched, and `tsc`. Real counts.
4. Process: Issue still linked, `lab-04` label, `reviewer.md` records our review and his replies, `tests.md` updated for new tests.
5. New findings only if real and inside the PR diff (RIGHT side; verify line against `gh pr diff` hunks).

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview-beam84.json` (UTF-8): `{"event": "APPROVE"|"REQUEST_CHANGES", "body": ..., "comments": [...]}`. Body in caveman style: one-line verdict, a ✅/❌ line per previous finding with the mutation evidence, process line, "Ran:" counts, "Not run:" line. Approve unless a previous blocking finding is not fixed or a new real defect against his acceptance criteria exists.
Report: per finding verdict + evidence, counts, mutation results, new findings, not verified, cleanup confirmation (cluster gone, clone `git status` clean, no `.git/hooks` non-sample files).
~~~~

</details>

### S-27

**Re-review beambeambeam#85** · 2026-10-12 06:39 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> re-review beam if ok then merge

<details><summary>Prompt sent (4,014 characters)</summary>

~~~~text
You re-review classmate @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/85 (his Issue #78, Requester dashboard and exact drill-down), now at head `9da4a61`. We reviewed it at `ace9bc8` (review 5484645894, REQUEST_CHANGES, 14 inline comments). DRAFT ONLY — do not post, merge or resolve anything on GitHub.

## Our previous findings
Read them and his replies: `gh api repos/beambeambeam/toktickit/pulls/85/comments` (ours by Kiatisakk; his replies have `in_reply_to_id`), and `gh pr view 85 --repo beambeambeam/toktickit --json comments`. Summary: 🔴 Requester sign-in still navigated to `/tickets` (`login-page.tsx` L70/L144) though his Issue AC L20 makes Dashboard the Requester landing; 🟡 bad `from`/`through` URL date crashed My Tickets (`RangeError`); 🟡 scope note in Bangkok time but rows in viewer time; 🟡 Refresh and Retry buttons lose focus (disabled while focused; alert unmounts on success); 🟡 nothing invalidates `["requester-dashboard", …]` after writes; 🟡 no test row on/just outside `from`/`through` (gte/lte→gt/lt survived in `requester-dashboard.ts` and `buildTicketWhere`); 🟡 Waiting count ownership untested (dropping `...requester` survived); 🟡 `dashboard-rules.test.ts` tests helpers production does not use; 🟡 tests.md RULE-03 / API-29 claimed boundaries/isolation as Pass; 🔵 x3 (formatter copies, dead helpers, aria-label hiding "Refreshing…"). Also greptile's two bot comments (same as the 🔴 and the date crash).

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam85` only (another agent uses `beam82`). `git fetch origin pull/85/head:pr85b && git checkout pr85b`. If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`. A copy of pnpm.exe may be in scratchpad `bin\`.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5497**: initdb into `scratchpad\pg5497\data`, `pg_ctl -D <data> -o "-p 5497" -l <log> start`. Never touch localhost:5433. At the end `pg_ctl -D <data> stop -m fast`, confirm nothing listens on 5497, delete the folder.

## HARD RULE
NEVER run `taskkill /IM node.exe` or kill any process by image name — the user runs a dev server and another agent runs tests. The previous agent did that and killed other people's processes. Only kill a process by the PID you started yourself.

## How
1. `git diff ace9bc8..9da4a61` — what changed. Check each fix in CODE, not replies. Per previous finding: Fixed / Not fixed / Answered (nits and reasoned disagreements can be Answered; verify the reasoning).
2. Mutation per fix: revert it (or re-apply the old mutation: gte/lte→gt/lt in both places, drop `...requester` on the waiting count) → a test now fails → restore; `git diff --quiet`. For the landing: confirm sign-in as a Requester now navigates to `/dashboard` (test or code + test), and that a test fails if it goes back to `/tickets`. For the date crash: a bad date no longer throws (test).
3. Check nothing new is broken in the delta; run his touched server and client tests and `tsc`. Real counts.
4. Process: Issue linked, `lab-04` label, `reviewer.md` records our review and his replies, `tests.md` rows now truthful.
5. New findings only if real and inside the PR diff (RIGHT side; verify lines against `gh pr diff` hunks).

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview-beam85.json` (UTF-8): `{"event": "APPROVE"|"REQUEST_CHANGES", "body": ..., "comments": [...]}`. Body in caveman style: one-line verdict, a ✅/❌ line per previous finding with the mutation evidence, process line, "Ran:" counts, "Not run:" line. Approve unless a previous blocking finding is not fixed or a new real defect against his acceptance criteria exists.
Report: per finding verdict + evidence, counts, mutation results, new findings, not verified, cleanup confirmation (cluster gone, clone clean, no non-sample hooks).
~~~~

</details>

### S-28

**Review beambeambeam#86** · 2026-10-14 16:43 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam already merge and you need to review beam pr

<details><summary>Prompt sent (3,968 characters)</summary>

~~~~text
You review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/86 ("Enforce the final Ticket lifecycle and resolution gate", his Issue #77), head `dd9f7df`, base `lab4-staging`, 61 files, 22 commits. The user was asked to review it. DRAFT ONLY — do not post, merge or resolve anything on GitHub. The main session verifies and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md`, section "Reviewing (when I am the reviewer)" — one finding per line, all in one review.
- Style: caveman — `<🔴 bug|🟡 risk|🔵 nit|❓ q>: <problem>. <fix>.` One line per finding, exact symbols in backticks, the why only when not obvious.
- His Issue: `gh issue view 77 --repo beambeambeam/toktickit`, and his contract in `docs/lab-04/` (specification, api-spec, ui-spec, tests.md). Review against HIS acceptance criteria and contract; quote the contract line you rely on and verify the quote exists.
- Our earlier reviews of his PRs (#82–#85 on his repo: `gh api repos/beambeambeam/toktickit/pulls/<n>/reviews`). Recurring patterns we found: focus/feedback lost when a control unmounts or disables itself; server rules no test kills (mutation survivors); tests.md rows claiming more than the tests prove; client caches not refreshed after writes. Look for them here.

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` only (another agent uses `beam85`). Branch `p86` is already fetched: `git checkout p86` (verify it is `dd9f7df`). If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`; a copy of pnpm.exe may be in scratchpad `bin\`. Run `prisma generate` in server if needed.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5498**: `initdb -E UTF8 --locale=C` into `scratchpad\pg5498\data` (UTF8 matters — a WIN1252 cluster gave 500s on Unicode last time), `pg_ctl -D <data> -o "-p 5498" -l <log> start`, create the DBs his env expects. Never touch localhost:5433. At the end `pg_ctl -D <data> stop -m fast`, confirm nothing listens on 5498, delete the folder.

## HARD RULE
NEVER kill processes by image name (`taskkill /IM node.exe` etc.) — the user runs a dev server. Only kill a PID you started.

## How
1. `gh pr diff 86 --repo beambeambeam/toktickit` against his acceptance criteria. Key areas for a lifecycle/resolution gate: every transition in his status matrix (allowed and refused), the gate's conditions and its error shape, lock order and version/stale checks under concurrency, terminal states, who may do what, UI (resolve dialog, focus trap/return, gate feedback, stale message, busy states), docs updated, Issue linked, label (`lab-04` is currently MISSING on this PR — a process item).
2. Verify every finding: reproduce with a throwaway test or run, or cite the exact line and contract clause. Mutation-check the important server rules (remove each gate condition, each matrix edge, the version check, the lock) — an unkilled mutant is a 🟡 on the relevant test file.
3. Run his server and client tests this PR touches, and `tsc`. Real counts.
4. Every inline comment line must be inside the PR diff (RIGHT side); check against `gh pr diff` hunks with a parser.

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review-beam86.json` (UTF-8): `{"event": ..., "body": ..., "comments": [{"path","line","side":"RIGHT","body"}]}`. Body: one-line verdict, tally, process items, what was verified and how, what was NOT verified. Request changes for a real defect against his acceptance criteria/contract or a missing process item; otherwise approve with comments.
Report: each finding with evidence and severity rationale, counts, mutation results, not verified, and cleanup (cluster gone, clone `git status` clean incl. regenerated `routeTree.gen.ts`, no non-sample hooks).
~~~~

</details>

### S-29

**Review beambeambeam#87** · 2026-10-14 16:43 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> beam already merge and you need to review beam pr

<details><summary>Prompt sent (4,098 characters)</summary>

~~~~text
You review classmate @beambeambeam's Pull Request https://github.com/beambeambeam/toktickit/pull/87 ("Deliver the Staff dashboard and My Actions drill-down", his Issue #79), head `c22833e`, base `lab4-staging`, 69 files, 14 commits. The user was asked to review it. DRAFT ONLY — do not post, merge or resolve anything on GitHub. The main session verifies and posts.

## Read first
- `C:\Users\kiati\Documents\toktickit\CLAUDE.md`, section "Reviewing (when I am the reviewer)" — one finding per line, all in one review.
- Style: caveman — `<🔴 bug|🟡 risk|🔵 nit|❓ q>: <problem>. <fix>.` One line per finding, exact symbols in backticks, the why only when not obvious.
- His Issue: `gh issue view 79 --repo beambeambeam/toktickit`, and his contract in `docs/lab-04/`. Review against HIS acceptance criteria and contract (staff card definitions, each drill-down must return exactly the rows its card counts, My Actions scoping to the signed-in staff member, deltas/day boundary, empty/loading/failure/forbidden states, Requester refused). Quote the contract line you rely on and verify the quote exists.
- Our earlier reviews of his PRs (#82–#85: `gh api repos/beambeambeam/toktickit/pulls/<n>/reviews`). On #85 (Requester dashboard) we found: sign-in landing not wired, bad URL dates crashing a list, Refresh/Retry losing focus, no boundary rows in tests (gte/lte→gt/lt survived), ownership filter untested, tests.md overclaiming. Check whether the Staff dashboard repeats any of these.

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam85` only (another agent uses `beam82`). `git fetch origin pull/87/head:p87 && git checkout p87` (verify `c22833e`). If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`; a copy of pnpm.exe may be in scratchpad `bin\`. `prisma generate` in server if needed.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5497**: `initdb -E UTF8 --locale=C` into `scratchpad\pg5497\data` (UTF8 matters), `pg_ctl -D <data> -o "-p 5497" -l <log> start`, create the DBs his env expects. Never touch localhost:5433. At the end `pg_ctl -D <data> stop -m fast`, confirm nothing listens on 5497, delete the folder.

## HARD RULE
NEVER kill processes by image name (`taskkill /IM node.exe` etc.) — the user runs a dev server. Only kill a PID you started.

## How
1. `gh pr diff 87 --repo beambeambeam/toktickit` against his acceptance criteria. For every staff card: independent SQL count vs the API vs the drill-down list on seeded data (include rows owned by another staff member, unassigned rows, and rows exactly on any time boundary). Role scoping (Requester refused; staff A never sees staff B's "My" rows via tampered query params). UI states, focus, accessibility, cache refresh after writes. Docs: tests.md rows, ai-use.md, reviewer.md; Issue linked; label (`lab-04` is currently MISSING on this PR — a process item).
2. Verify every finding: reproduce with a throwaway test or run, or cite the exact line and contract clause. Mutation-check important rules (each card's filter, boundary operators, ownership) — an unkilled mutant is a 🟡 on the test file.
3. Run his server and client tests this PR touches, and `tsc`. Real counts.
4. Every inline comment line must be inside the PR diff (RIGHT side); check against `gh pr diff` hunks with a parser.

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\review-beam87.json` (UTF-8): `{"event": ..., "body": ..., "comments": [{"path","line","side":"RIGHT","body"}]}`. Body: one-line verdict, tally, process items, what was verified and how, what was NOT verified. Request changes for a real defect against his acceptance criteria/contract or a missing process item; otherwise approve with comments.
Report: each finding with evidence and severity rationale, counts, mutation results, not verified, and cleanup (cluster gone, clone clean incl. `routeTree.gen.ts`, no non-sample hooks).
~~~~

</details>

### S-30

**Issue #79 records half** · 2026-10-14 20:29 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> start last issue #79

<details><summary>Prompt sent (708 characters)</summary>

~~~~text
You do the records half of GitHub Issue #79 of Kiatisakk/toktickit (CPE 334 Lab 4, "Lab 4 report, submission and release"). Your full brief is `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\report79-brief.md` — read it in full first, then the files it lists.

Work only in the worktree `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-report` on branch `docs/lab4-report`. Never write anything in `ai-use.md` §3 (the author's reflection). Never merge, close Issues, reset databases, force-push, post on beambeambeam's repository, or kill processes by image name.

Report exactly what passed and what failed, with counts.
~~~~

</details>

### S-31

**Re-review beambeambeam#86** · 2026-10-15 10:02 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> re-review ให้บีมหน่อย

<details><summary>Prompt sent (4,219 characters)</summary>

~~~~text
You re-review classmate @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/86 (his Issue #77, final Ticket lifecycle and resolution gate), now at head `1e4c0ea`. We reviewed it at `dd9f7df` (review 5522907404, REQUEST_CHANGES, 16 inline comments: 12 🟡, 4 🔵). DRAFT ONLY — do not post, merge or resolve anything on GitHub.

## Our previous findings
Read ours and his replies: `gh api repos/beambeambeam/toktickit/pulls/86/comments --paginate` (ours by Kiatisakk; his replies have `in_reply_to_id`), plus `gh pr view 86 --repo beambeambeam/toktickit --json comments`. In short: focus lost after the resolve confirm dialog closes and gate reasons outside the live region (ui-spec L95); status history not shown to Requesters though specification.md L101 says they read it; history fetches only page 1 oldest-first; browser-zone date formatter; stale `server/openapi.yaml` (status route roles, gate 409s, Admin notes/read-only text); undocumented `mustChangePassword` eligibility rule (admin reset strands the owner); untested: `InProgress` counted as pending, foreign-Requester history read, history pagination `skip`, Ticket lock and user locks (a different-actor race — Resolve by staff A vs Create Action by staff B — produced Resolved-with-pending-Action 24/25 with the lock removed), Closed keeping `resolvedAt`; tests.md API-20 citing one edge; tests.md #77 criteria recorded Not met (tablet/mobile/320px/200% zoom/visual) and no concurrency E2E; AUTH-01 citing the wrong 404; `updateTicketStatus` called with 4 args (tests not type-checked); client mutants surviving (`canOperate` role, no 409 refetch, no setQueryData, no history invalidate, `statusReasons` not cleared).

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam82` only (another agent uses `beam85`). `git fetch origin pull/86/head:p86b && git checkout p86b` (verify `1e4c0ea`). If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`; pnpm.exe copy may be in scratchpad `bin\`. `prisma generate` in server.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5498**, `initdb -E UTF8 --locale=C` into `scratchpad\pg5498\data`, `pg_ctl -D <data> -o "-p 5498" -l <log> start`. Never touch localhost:5433. At the end stop it, confirm nothing listens on 5498, delete the folder.

## HARD RULE
Never kill processes by image name. Only a PID you started. The user's dev server runs on 3000/5173.

## How
1. `git diff dd9f7df..1e4c0ea`. For each previous finding: Fixed / Not fixed / Answered (a reasoned disagreement or a scope deferral can be Answered — judge whether the reasoning holds against HIS Issue #77 acceptance criteria and contract; quote the clause).
2. Mutation per fix: re-apply the old mutant (remove Ticket lock — and run his new different-actor race if he added one; drop user locks; count only Planned; foreign Requester history; skip=0; Closed clears resolvedAt; client mutants) → a test now fails → restore; `git diff --quiet`. For focus: confirm a test asserts focus after the dialog closes and fails if the fix is removed.
3. Check the delta for new breakage; run his touched server and client tests and `tsc` (including tests, if he now type-checks them). Real counts.
4. Process: Issue #77 linked, `lab-04` label (now present), `reviewer.md` records our review and his replies, `ai-use.md` entry, `tests.md` truthful.
5. New findings only if real and inside the PR diff (RIGHT side; verify against `gh pr diff` hunks).

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview-beam86.json` (UTF-8): `{"event": "APPROVE"|"REQUEST_CHANGES", "body": ..., "comments": [...]}`. Caveman body: one-line verdict, ✅/❌ line per previous finding with mutation evidence, process line, "Ran:" counts, "Not run:" line. Approve unless a previous finding that is a real defect against his acceptance criteria/contract is not fixed or answered soundly, or a new real defect exists.
Report: per finding verdict + evidence, counts, mutations, new findings, not verified, cleanup confirmation.
~~~~

</details>

### S-32

**Re-review beambeambeam#87** · 2026-10-15 10:02 UTC · New agent · Sonnet 5.5

Triggered by the user prompt:

> re-review ให้บีมหน่อย

<details><summary>Prompt sent (4,211 characters)</summary>

~~~~text
You re-review classmate @beambeambeam's PR https://github.com/beambeambeam/toktickit/pull/87 (his Issue #79, Staff dashboard and My Actions drill-down), now at head `17fecae`. We reviewed it at `c22833e` (review 5522498888, REQUEST_CHANGES, 11 inline comments: 1 🔴, 7 🟡, 3 🔵). DRAFT ONLY — do not post, merge or resolve anything on GitHub.

## Our previous findings
Read ours and his replies: `gh api repos/beambeambeam/toktickit/pulls/87/comments --paginate` (ours by Kiatisakk; his replies have `in_reply_to_id`) and `gh pr view 87 --repo beambeambeam/toktickit --json comments`. In short: 🔴 `staff-dashboard.api.test.ts` statically imports `findStaffDashboard`, which loads `src/db/client.ts` bound to the ambient `DATABASE_URL` before `users-admin-fixture.ts` sets the test URL (L172) and dynamically imports the client (L179), so the fixture's `deleteMany` wipes the developer's DB — same in `requester-dashboard.api.test.ts`; 🟡 surviving mutants (urgent preview without active filter; `take: 6` on urgent and My Actions previews — five-row cap untested); e2e drill-down asserts only the URL, not card count == list total (AC-20); My Actions page beyond the end shows "No assigned actions"; focus lost on every My Actions page change (no placeholderData, PaginationNav unmounts); API-31 parity has no staff test; tests.md records #79 criteria (staff axe, 320px/200% zoom, perf, visual, Admin UI/E2E) not run; 🔵 stale invalidation keys in `action-mutation-cache.ts`; bad `recently-updated` window silently unfiltered; UI-05/Known gaps understating coverage. Process: `lab-04` label (now present), no `ai-use.md` #79 entry, no `reviewer.md` #87 entry.

## Where
Clone `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\beam85` only (another agent uses `beam82`). `git fetch origin pull/87/head:p87b && git checkout p87b` (verify `17fecae`). If node_modules is broken: `corepack pnpm install --frozen-lockfile --ignore-scripts`; pnpm.exe copy may be in scratchpad `bin\`. `prisma generate` in server. A parity test from the first review is at scratchpad `zz-parity87.test.ts.txt` — reuse it as a throwaway if his repo still lacks one.
Database: private PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`) on **port 5497**, `initdb -E UTF8 --locale=C` into `scratchpad\pg5497\data`, `pg_ctl -D <data> -o "-p 5497" -l <log> start`. Never touch localhost:5433. At the end stop it, confirm nothing listens on 5497, delete the folder.

## HARD RULE
Never kill processes by image name. Only a PID you started. The user's dev server runs on 3000/5173.

## How
1. `git diff c22833e..17fecae`. For each previous finding: Fixed / Not fixed / Answered (judge reasoned disagreements against HIS Issue #79 acceptance criteria and contract; quote the clause).
2. For the 🔴: reproduce the original scenario (ambient `DATABASE_URL` pointing at a separate DB with a sentinel row, test URL elsewhere) on both test files and confirm the sentinel survives now; then reintroduce a static import and confirm whatever guard he added catches it (or the sentinel dies — then it's Not fixed).
3. Mutation per fix: re-apply each surviving mutant → a test now fails → restore; `git diff --quiet`. Focus/pagination fixes: a test asserts them and fails when the fix is removed.
4. Check the delta for new breakage; run his touched server and client tests and `tsc`. Real counts.
5. Process: Issue #79 linked, `lab-04` label, `reviewer.md` and `ai-use.md` entries, `tests.md` truthful.
6. New findings only if real and inside the PR diff (RIGHT side; verify against `gh pr diff` hunks).

## Output
Save `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\rereview-beam87.json` (UTF-8): `{"event": "APPROVE"|"REQUEST_CHANGES", "body": ..., "comments": [...]}`. Caveman body: one-line verdict, ✅/❌ line per previous finding with evidence, process line, "Ran:" counts, "Not run:" line. Approve unless a previous real defect is not fixed or soundly answered, or a new real defect exists.
Report: per finding verdict + evidence, counts, mutations, new findings, not verified, cleanup confirmation.
~~~~

</details>

### Briefs the prompts refer to

Each brief was written once, in a single save before the first agent that reads it was started, and never edited afterwards, so the text below is what every agent that read it saw.

#### `lab4-brief-common.md`

Read by S-05, S-06, S-10, S-11, S-12

<details><summary>Brief (6,994 characters)</summary>

~~~~markdown
# Common brief — Lab 4 implementation agents

You implement one GitHub Issue of TokTickIT (CPE 334 Lab 4). Another agent is implementing a different Issue **at the same time**, in a different worktree, against the **same PostgreSQL databases**. Read this whole file before starting.

## Read first

1. `CLAUDE.md` at the repo root — the GitHub workflow rules are binding.
2. `.claude/skills/lab-sprint/issue.md` and `.claude/skills/lab-sprint/gotchas.md` in the **main checkout** `C:\Users\kiati\Documents\toktickit` (the `.claude/` folder is untracked, so it is not in your worktree). They are the step-by-step procedure and the traps that cost failed runs before.
3. Your Issue (`gh issue view <n>`) and the merged contract in `docs/lab-04/` — `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`. The contract is final: implement it as written. If something in it is impossible or contradictory, implement the rest and report the conflict; do not silently change the rule.
4. The existing code you extend. Reuse before writing: Lab 3's `server/src/tickets/domain.ts` (status matrix), `server/src/routes/staffTickets.ts` (staff PATCH endpoints and `onlyField`), `server/src/http/errors.ts`, `server/src/auth/scope.ts`, `server/src/tickets/messages.ts` (body validation pattern), the Lab 3 test suites under `server/tests/lab-03/` and `client/tests/lab-03/` as models.

## Your worktree

You run in an isolated git worktree. Before anything else:
- Copy the two env files from the main checkout (they are untracked and **never committed**): `C:\Users\kiati\Documents\toktickit\server\.env` and `...\server\.env.test` into your worktree's `server/`.
- Install dependencies in the worktree: `npm install` at its root.
- Create your branch from the latest staging: `git fetch origin && git checkout -b <your branch> origin/lab4-staging`.

## The shared database — rules that keep two agents from breaking each other

- Dev DB `toktickit` and test DB `toktickit_test` on localhost:5433 are shared with the other agent. **Never run `prisma migrate reset`.** `migrate dev` will probably complain about a migration it does not know (the other agent's): do not reset. Generate your SQL with `prisma migrate diff` from the staging schema (`git show origin/lab4-staging:server/prisma/schema.prisma`) to yours, write it into `server/prisma/migrations/<your timestamp>_<name>/migration.sql` using **the timestamp given in your prompt**, then `npx prisma migrate deploy` and `npx dotenv -e .env.test -- npx prisma migrate deploy`. Run `npx prisma generate` before typechecking (Prisma 7 does not do it on migrate).
- Your migration must only add (columns with defaults, new tables, indexes) — never drop or rewrite anything the other agent or earlier labs rely on.
- Test fixtures use a prefix unique to your suite, and clean up only rows with that prefix. Never delete rows wholesale.
- If a full-suite run fails in a suite **unrelated to your change**, the other agent may be running its tests at the same moment. Rerun that file alone, and report both results.

## Gates (all of them, on your final commit)

- server: `npx tsc --noEmit -p .` and `npx vitest run`
- client: `npx tsc -b` (not only `tsconfig.app.json` — a test-file type error broke the build once) and `npx vitest run`
- root: `npm exec -- ultracite fix <files you touched>` then `npm exec -- ultracite check server client`
- Red first: each test is seen failing for the right reason before the code that makes it pass. For tests written after their code, **mutation-check**: break the one rule, see that test fail, restore. Record the mutations you tried.
- A Lab 1–3 test that fails because the contract (D-16) deliberately changed behaviour is updated only as far as the change requires, with the reason beside it. Any other failure is a bug to fix, not a test to update.

## Documents in the same PR

- `docs/lab-04/tests.md`: the rows your Issue makes pass go from `Planned` to `Pass — <what the test actually asserts>`. Only rows that genuinely pass. Leave the rest.
- `api-spec.md` / `ui-spec.md` / `specification.md`: change only where your code settled something the contract left open; say what in the PR.
- `docs/lab-04/ai-use-log.md`: append one row for the user's prompt that started this work: *"go"* (after the contract merged) — outcome: the eight implementation Issues #72–#79 were created and the two with no blockers were started in parallel by Sonnet 5.5 agents in separate worktrees; then what your Issue built. Continue the existing numbering. **Never write in `ai-use.md` §3.**

## Commits, PR, board

- Commit in logical steps; message style `feat(lab-04): …` / `test(lab-04): …` / `docs(lab-04): …`, each ending with exactly:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CBvvM7KaeqGUTY6Abj1dUb`
- **Stage by explicit path only.** Never stage `.agents/`, `AGENTS.md`, `Gemini_Review.md`, `skills-lock.json`, `latex/`, `.claude/`, `server/.env*`, `playwright-report/`, `test-results/`. Never `git add -A` / `git add .`.
- Board: project `PVT_kwHOCB2G0s4BfVCS`, field `PVTSSF_lAHOCB2G0s4BfVCSzhZosUc`. Options: Specified `9a9ea150`, Started `b5c30f7b`, PR Review `ffb17e2a`. Move at the moment: Specified after reading the Issue and contract; Started right after your first commit; PR Review after the PR is open and linked.
  `gh project item-edit --id <your item> --project-id PVT_kwHOCB2G0s4BfVCS --field-id PVTSSF_lAHOCB2G0s4BfVCSzhZosUc --single-select-option-id <option>`
- PR to **`lab4-staging`**. Body: `Closes #<n>.`, summary, *Acceptance criteria, and what proves each*, *Decisions the contract left open*, *Verification* with real counts, mutation checks and any flake with its rerun. **No "🤖 Generated with Claude Code" line and no Claude session link in the PR body.**
- `gh pr edit <pr> --add-reviewer beambeambeam --add-label lab-04`, then link explicitly (a keyword does not link against a staging base):
  `gh api graphql -f query='{repository(owner:"Kiatisakk",name:"toktickit"){issue(number:<n>){id} pullRequest(number:<pr>){id}}}'`
  `gh api graphql -f query='mutation($i:ID!,$p:[ID!]!){addCloseIssueReferences(input:{issueId:$i, pullRequestIds:$p}){clientMutationId}}' -f i=<issue id> -f 'p[]=<pr id>'`
  Verify `closingIssuesReferences` contains your Issue before moving the card to PR Review.
- `gh` GraphQL sometimes fails with `unexpected EOF`: check what ran before retrying.

## Hard limits

Never merge any PR. Never close an Issue. Never post on github.com/beambeambeam/toktickit. Never reset a database. Never force-push. Never skip hooks. Never kill a process you did not start (the user may be running `npm run dev`).

## Report back

PR URL; commits; server and client counts (and flakes with reruns); the mutation checks and their outcomes; which `tests.md` rows you moved to Pass; anything in the contract you had to decide or found contradictory; anything unfinished. Exact — failures said as failures.
~~~~

</details>

#### `fix-brief-common.md`

Read by S-07, S-08, S-14, S-15, S-16, S-20

<details><summary>Brief (3,412 characters)</summary>

~~~~markdown
# Common brief — fixing Beam's review of one of our Lab 4 PRs

You fix the findings @beambeambeam left on one of our PRs in `Kiatisakk/toktickit`. Another agent is fixing the other PR at the same time, in another worktree, against the **same PostgreSQL databases**.

## Read first
1. `C:\Users\kiati\Documents\toktickit\CLAUDE.md` — binding, especially *Authoring (when the PR is mine)*.
2. `C:\Users\kiati\Documents\toktickit\.claude\skills\lab-sprint\review-received.md` (the procedure) and `gotchas.md` beside it.
3. The original implementation brief: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md` — its *shared database*, *Gates*, *Commits* and *Hard limits* sections still apply in full.
4. The contract in `docs/lab-04/` for anything the finding touches.

## Where you work
**The existing worktree given in your prompt**, on the branch already checked out there. Do not create a new branch or worktree. `git pull --ff-only` first (nothing should be new). `server/.env` and `server/.env.test` are already present.

## Procedure
1. Move the card to **Fixing** at once (option `d59bbde2`, project `PVT_kwHOCB2G0s4BfVCS`, field `PVTSSF_lAHOCB2G0s4BfVCSzhZosUc`).
2. For each finding: verify it against the code. If it is real, **red first** — a regression test that fails on the current code for the right reason, then the fix, then green. If you believe it is not real, prove it (a test or a run), and say so with the evidence; do not fix-by-assertion or dispute-by-assertion.
3. If a fix adds or changes a rule the contract states (a validation rule, an error code, a locking step), update `specification.md` / `api-spec.md` in the same commit range and add/adjust the `tests.md` row. Say it in the PR body.
4. Gates from the common brief, all of them, on the final commit. Report real counts; a failure in a suite unrelated to your change is rerun alone and both results reported.
5. Commit in logical steps (`fix(lab-04): …`, `test(lab-04): …`, `docs(lab-04): …`), each ending with exactly:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01CBvvM7KaeqGUTY6Abj1dUb`
   Stage by explicit path only. Push to the same branch (plain `git push`, never force).
6. **Reply on every thread** with what changed and the commit sha (or the evidence for disagreeing):
   `gh api repos/Kiatisakk/toktickit/pulls/<pr>/comments/<comment id>/replies -f body="…"`
   **Do not resolve any thread** — the main session resolves after verifying.
7. Record the round in `docs/lab-04/reviewer.md` on this branch (read the existing entries first and follow their form): reviewer, date, verdict, each finding, what was done with the commit, Coverage row. Commit and push it.
8. Card back to **PR Review** (`ffb17e2a`) and `gh pr edit <pr> --add-reviewer beambeambeam`.

## Hard limits
Never merge. Never close an Issue. Never post on github.com/beambeambeam/toktickit. Never reset or drop the shared databases `toktickit` / `toktickit_test`. Never force-push. Never skip hooks. Never kill a process you did not start. Never edit `ai-use.md` §3.

## Report back
Per finding: real or not, the regression test and that you saw it fail first, the fix, the commit. Gate counts. Reply ids posted. Spec/tests.md changes. Anything unfinished — failures stated as failures.
~~~~

</details>

#### `wave2-brief.md`

Read by S-10, S-11, S-12, S-14, S-15, S-16

<details><summary>Brief (2,393 characters)</summary>

~~~~markdown
# Wave 2 — what differs from the common brief

Read the common brief first: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`. Everything in it applies, with these changes.

## Three agents now, not two
#74 (Actions UI), #75 (resolution gate) and #76 (dashboards) run at the same time, each in its own worktree, all against the same databases. `lab4-staging` now contains #72 (versioning + status history, PR #80) and #73 (Actions API, PR #81) — build on them, reuse `server/src/tickets/lock.ts`, `version.ts`, `statusHistory.ts`, `server/src/actions/*`, `server/src/routes/actions.ts`.

**Who owns which shared file**, to keep the three merges small:
- `client/src/routes/TicketDetail.tsx`: #74 adds only a mount point for its own `ActionsTaken` component; #75 changes only the resolve flow (in `StaffTicketControls.tsx` and a new resolve-dialog component). Neither rewrites TicketDetail beyond that.
- `server/prisma/seed*` and the demo data: #76 only.
- `client/src/App.tsx` / routing / navigation: #76 only.
- `server/src/http/errors.ts`: add your codes at the end of the object, under a comment naming your Issue.
- `client/src/lib/api.ts`: add your functions at the end, under a comment naming your Issue.

## Migrations
Only if your Issue needs one, and only additive. Timestamps: #75 `20261004100000`, #76 `20261004110000`, #74 `20261004120000`. Before writing one, check `git log origin/lab4-staging -- server/prisma/migrations` and the contract §7 for what already exists (e.g. the Resolution Summary column may or may not be there yet — check, do not assume).

## The prompt to log in `docs/lab-04/ai-use-log.md`
The user's prompt that started this wave was *"do next"* (after #80 and #81 merged). Outcome: the three Issues unblocked by them, #74, #75 and #76, were started in parallel by Sonnet 5.5 agents in separate worktrees; then what your Issue built. Use row number **#74 → 7, #75 → 8, #76 → 9** (the merge will interleave them; that is expected).

## Stale `tests.md` rows
Rows earlier work left partial and that your Issue makes pass are yours to move: UI-36 belongs to #75. Leave rows owned by #77/#78 (e2e, MIG-03/04, SEC-*) alone.

## Report back
As in the common brief, plus: the list of files you touched outside your Issue's own new files, so the merges can be planned.
~~~~

</details>

#### `e2e77-brief.md`

Read by S-19, S-20

<details><summary>Brief (4,875 characters)</summary>

~~~~markdown
# Issue #77 — what differs from the common brief

Read the common brief first: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`. Everything in it applies, with these changes.

## You are alone now
#72–#76 are merged into `lab4-staging`. No other agent runs at the same time, but the user may run `npm run dev` — never kill a process you did not start, and if port 3000 or 5173 is taken by the user's server, say so rather than killing it (Playwright's `reuseExistingServer` is on locally; check whether a reused server is pointed at the test DB before trusting a run).

## Worktree and branch already exist
- Worktree: `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-e2e`, branch `feature/lab4-e2e` (pushed, tracking origin). It already holds one commit recording PR #84's outcome in `reviewer.md` — keep it; this PR carries it (say so in one line in the PR body).
- `server/.env` and `server/.env.test` are already copied. Run `npm install` at the root. Do not create another branch.
- The card is already in **Started** (item `PVTI_lAHOCB2G0s4BfVCSzg-PehQ`).

## Database
Docker Desktop was just restarted. Before any DB work: `docker compose ps`; if `toktickit-db` is not up, `docker compose up -d` and wait until it is healthy (poll `docker compose ps`, not a blind sleep). If the Docker daemon itself is not reachable after a few minutes, stop and report — do not install or start another PostgreSQL.
`npm run e2e:prepare` (`db:test:setup`) wipes journey rows in `toktickit_test`, migrates and seeds it — that is the established Lab 3 procedure and is allowed. Never touch the dev DB `toktickit` beyond what the demo seed already does, never `migrate reset`.

## What to build (Issue #77, contract `docs/lab-04/ui-spec.md` §11–§12, `tests.md` E2E/VIS/RESP/STYLE rows)
1. `e2e/lab-04/actions-taken-flow.spec.ts`, `ticket-resolution.spec.ts`, `dashboards.spec.ts`, following the Lab 3 specs in `e2e/lab-03/` (fixtures, sign-in helpers, console-error guard, screenshot helper, viewport projects in `playwright.config.ts`). Reuse their helpers; do not fork them.
2. Journeys: record an Action (create → complete), resolve a Ticket through the gate (refusal shown, then success), view both dashboards and drill down — **no console error** (AC-47).
3. Screenshots into `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/` with exactly the stable names ui-spec §11 lists, at desktop, tablet and mobile unless §11 says otherwise (AC-43). If a listed state cannot be produced honestly (e.g. a loading state too fast to catch), hold the request with Playwright routing, as Lab 3 did if it did; never fake a state the app cannot show. Report any name you could not capture.
4. §12 rows marked *Browser* are asserted in the e2e (tokens read from the live browser, surfaces, no clipped text at any viewport).
5. **Lab 2 and Lab 3 screenshots are submitted and must be byte-identical after your runs.** After every full run: `git status --short artifacts/lab-02 artifacts/lab-03`; if anything changed, `git checkout -- artifacts/lab-02 artifacts/lab-03` and say so. Better: run only the Lab 4 specs plus the Lab 3 specs that #76 edited (below) so the old screenshots are not rewritten; if the Lab 3 specs write screenshots, restore them afterwards.
6. **Lab 3 e2e specs edited by #76** (landing moved to `/dashboard`) have never been run in a browser. Find them (`git log --oneline origin/lab4-staging -- e2e/lab-03`), run them, fix only what the deliberate landing change requires.

## Gates
Common-brief gates, plus: the full Playwright run for `e2e/lab-04` on all three viewport projects, and the edited Lab 3 specs; report pass/fail counts per project, and any flake with its rerun. Mutation-check at least: (a) inject a `console.error` in a dashboard component → the no-console-error guard fails; (b) break one screenshot-state precondition (e.g. the gate refusal) → its spec fails. Restore and confirm with `git diff --quiet`.

## Documents
- `tests.md`: E2E-*, VIS-*, and any RESP/STYLE rows your specs genuinely prove, `Planned` → `Pass — <what it asserts>`. Leave #78-owned rows (MIG-03/04, SEC-*, hardening) alone.
- `ai-use-log.md`: append the next row (continue the numbering) for the user's prompt *"beam merge laa then continue"*: after #84 merged, Issue #77 was started by a Sonnet 5.5 agent with Opus verifying; then what it built.
- `artifacts/lab-04/README.md` if Lab 3 had an equivalent (provenance: commit, how to regenerate). Check `artifacts/lab-03/`.

## Report back
As in the common brief, plus: the screenshot list actually produced (count per folder per viewport), any §11 name missing and why, confirmation that `artifacts/lab-02` and `artifacts/lab-03` are unchanged, and the Lab 3 specs you ran with their results.
~~~~

</details>

#### `hardening78-brief.md`

Read by S-21

<details><summary>Brief (5,489 characters)</summary>

~~~~markdown
# Issue #78 — what differs from the common brief

Read the common brief first: `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\57067f86-54ab-4852-9ea1-d6819342418d\scratchpad\lab4-brief-common.md`. Everything in it applies, with these changes.

## Situation
#72–#77 are merged into `lab4-staging`. You are the only agent writing to our databases. (Two other agents are reviewing a classmate's repository on their own private PostgreSQL clusters on other ports; they never touch 5433.) The user may run `npm run dev` — never kill a process you did not start.

## Worktree and branch already exist
- `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-hardening`, branch `feature/lab4-hardening` (pushed). It holds one commit recording PR #85's outcome in `reviewer.md` — keep it; say in one line in the PR body that it rides here.
- `server/.env` and `server/.env.test` are copied. Run `npm install` at the root.
- Card already in **Started** (item `PVTI_lAHOCB2G0s4BfVCSzg-Pej8`).

## Database
Docker Desktop was just started. Poll `docker compose ps` (from the MAIN checkout `C:\Users\kiati\Documents\toktickit`, not the worktree — running `docker compose up -d` from a worktree creates a second project with a conflicting container name) until `toktickit-db` is healthy. If the daemon is unreachable after a few minutes, stop and report.

## What to do (Issue #78: `gh issue view 78`)
Work through `docs/lab-04/tests.md`: every row still `Planned` or `Partial` that #78 owns, i.e. all except the ones #79 (report/release) owns. #79 owns nothing in tests.md except possibly the final results-summary table at the bottom — fill that table too with real counts from your final run, since you run the final regression.
1. **SEC-01..SEC-07** (AC-44, AC-07, AC-03, BR-12): one API test file enumerating **every** Lab 4 endpoint (Actions create/list/edit/complete/cancel, staff status with resolve, both dashboards, the new list filters) for no session → 401, wrong role → 403, gated user → 403 `PASSWORD_CHANGE_REQUIRED`, etc., exactly as the rows say. Enumerate endpoints from the router, not from memory — a test that iterates a hand list can miss one; consider asserting the list matches the mounted routes. Any endpoint that does not refuse is a real defect: fix it, red first.
2. **MIG-05, MIG-09..11, WF-13, UI-31, STYLE-01..06, PERF-01..03, E2E-12**, and any row reading `Partial` (e.g. MIG-03/04): make them pass honestly or, if a row cannot be proved, report it — never mark Pass without a test that asserts it. PERF rows: follow the row's stated bound; seed the large set only in the test DB, under a unique prefix, and clean up.
3. **Concurrency suite timeouts**: four loop tests in the Lab 4 concurrency suite time out at Vitest's default 5 s under shared-DB load (they pass at 60 s). Fix properly — set an explicit per-test timeout justified by the loop size, or shrink the loop while keeping what it proves; do not hide a real deadlock. Show the full server suite green at the **default** command `npx vitest run` (no `--testTimeout` flag).
4. **UI-35 label clash**: "UI-35" is used both by a #72 client test (in `client/tests/lab-04/`) and by tests.md's dialog-focus row. Make every test ID unique and every tests.md ID point at the test that proves it (`grep -rn "UI-35"`). Do a mechanical check across all IDs: every ID in tests.md is unique, every ID cited in a test file exists in tests.md.
5. **Handout §8.5** sweep: no console errors, broken links, placeholder text ("TODO", "Lorem", "coming soon", `href="#"`), unfinished controls in `client/src`. Fix what you find.
6. **README**: setup, seed (`db:seed`, `db:seed:demo`), migration, test (unit, e2e incl. `e2e:prepare`, `e2e:seed-dashboard`), and demonstration instructions current for Lab 4. Verify each command you document by running it (except destructive ones, which you read).
7. Labs 1–3 suites (server and client) pass; any change to an old test only where D-16 requires it, reason beside it.

## Gates
Common-brief gates, plus: full Playwright run of `e2e/lab-03` and `e2e/lab-04` on all three projects after `npm run e2e:prepare` (and `e2e/lab-02` if it still runs in this config), with counts per project and flakes with reruns. **Lab 2 and Lab 3 screenshots are submitted**: after any run, `git status --short artifacts/lab-02 artifacts/lab-03` must be empty — `git checkout --` them. Do not commit Lab 4 screenshots that changed only by timestamp or ticket number.
Mutation checks: at least one per new SEC test family (remove an auth guard → its row fails), one for a PERF bound, and the UI-35 uniqueness check (introduce a duplicate → the check fails). Restore; `git diff --quiet`.

## Documents
- `tests.md` rows → `Pass — <what the test actually asserts>`.
- `ai-use-log.md`: next row for the user's prompt *"beam merge laa do next issue and review beam pr 84 and 85"*: after #85 merged, #78 started by a Sonnet 5.5 agent (Opus verifying), in parallel with two Sonnet agents reviewing beambeambeam#84 and #85; then what #78 did.
- `specification.md`/`api-spec.md` only where a defect fix changes a stated rule.

## Report back
As in the common brief, plus: the endpoint list SEC tests enumerate and how it is kept complete, every defect found and fixed (with the red-first evidence), rows moved to Pass, rows that could not be proved, the full counts (server default command, client, e2e per project), and confirmation that artifacts/lab-02 and lab-03 are unchanged.
~~~~

</details>

#### `report79-brief.md`

Read by S-30

<details><summary>Brief (7,019 characters)</summary>

~~~~markdown
# Issue #79, records half — brief

You bring the Lab 4 records current and audited, in one Pull Request. The PDF and the release are NOT yours (the main session does them after this merges).

## Read first
1. `C:\Users\kiati\Documents\toktickit\CLAUDE.md` — binding. Especially *Living documents*, *Linking a PR to its Issue*, *Every PR asks Beam for review*.
2. `C:\Users\kiati\Documents\toktickit\.claude\skills\lab-sprint\report.md` — the *Records* section is your procedure, step by step. Also `gotchas.md` beside it.
3. `gh issue view 79` — acceptance criteria.
4. The handout's grading table for the PDF (so the records support it): `C:\Users\kiati\AppData\Local\Temp\claude\C--Users-kiati-Documents-toktickit\9f1dafbf-0b05-4b60-b11a-9bb6a5b9f066\scratchpad\lab4-handout.txt`, from line 2805 (Parts 1–9) and section 14 / Product Definition of Done.

## Where
Worktree `C:\Users\kiati\Documents\toktickit\.claude\worktrees\lab4-report`, branch `docs/lab4-report` (from `origin/lab4-staging` at `a5b90c9`, not yet pushed). `server/.env*` copied. `npm install` at the root. This is the end-of-sprint report branch, so it has its own PR (CLAUDE.md allows exactly this).
Docker: `toktickit-db` should be up; check with `docker compose ps` run from the MAIN checkout `C:\Users\kiati\Documents\toktickit` (never `up` from a worktree). If down, `docker compose up -d` from the main checkout and poll until healthy.
The user's own dev server may be running on 3000/5173 against the dev DB `toktickit` (just seeded with demo data — leave it alone). Never kill processes by image name; never kill a process you did not start. Never reset or wipe the dev DB. `npm run e2e:prepare` (test DB only) is allowed.

## Board
Card item `PVTI_lAHOCB2G0s4BfVCSzg-Pen4` is in Specified. Move to Started (`b5c30f7b`) at your first commit; to PR Review (`ffb17e2a`) once the PR is open and linked. Project `PVT_kwHOCB2G0s4BfVCS`, field `PVTSSF_lAHOCB2G0s4BfVCSzhZosUc`.

## The work (report.md *Records*, steps 1–7)
1. No `| Planned |` row and no `Partial`/`Not run` row in `docs/lab-04/tests.md` that the code can honestly pass. Check that every test file a row names exists.
2. Every AC in `specification.md` maps to a passing test (walk the AC→test matrix mechanically with a script; report gaps).
3. Audit `specification.md`, `api-spec.md`, `ui-spec.md`, and the README against the CODE: every endpoint's method/path/roles/scope/status codes vs the routers; every error code vs `server/src/http/errors.ts`; every BR vs its implementation; credentials vs `server/prisma/accounts.ts`; the screenshot inventory vs `artifacts/lab-04/screenshots/`. Fix the documents where they disagree with the code (or, if the code is wrong against an approved rule, report it — do not change product code in this PR without telling the main session).
4. `reviewer.md` lists every PR on BOTH repositories that belongs to Lab 4 (our #71 and #80–#86; beambeambeam's Lab 4 PRs #80–#87). Use the loop in report.md for ours and the equivalent for his repo. Missing right now and to be added:
   - **Our PR #86** (Issue #78): reviewed by @beambeambeam 2026-10-14, **Approved** `LGTM` at 15:52:25Z with no line comments, merged by him at 15:52:34Z (`a5b90c9`); Issue #78 closed by hand. Coverage row: received, 0, Approved, Merged.
   - **beambeambeam#86** (his Issue #77, "Enforce the final Ticket lifecycle and resolution gate"): our review 5522907404, 2026-10-15, **Changes requested**, 16 line comments (12 🟡, 4 🔵, no 🔴). Read them with `gh api repos/beambeambeam/toktickit/pulls/86/comments` and summarise in the same table form as the existing beambeambeam#84/#85 entries. Status: open, awaiting his fixes.
   - **beambeambeam#87** (his Issue #79, "Deliver the Staff dashboard and My Actions drill-down"): our review 5522498888, 2026-10-15, **Changes requested**, 11 line comments (1 🔴 test-isolation bug: a static import binds `prisma` to the ambient `DATABASE_URL` so the fixture's `deleteMany` hits the developer's DB — same in his merged `requester-dashboard.api.test.ts`; 7 🟡; 3 🔵). Same form. Status: open.
   - Then re-run the GitHub check for both repos so nothing else is missing; render with `gh api -X POST markdown` and confirm tables render and links to his PRs point at his repo.
   - If either of his PRs gets a new commit or our re-review while you work, record only what has actually happened; leave a one-line "awaiting re-review" otherwise.
5. `ai-use.md`: §1 names every model that wrote code or docs, including the Sonnet 5.5 sub-agents and Opus 5.5 verifying, and states plainly where commit trailers name a model. §2 selects 6–10 prompts from `ai-use-log.md` that changed what got built, each with what it changed. The full log stays in `ai-use-log.md` (append the row for this prompt: *"start last issue #79"* — the records half of #79 by a Sonnet 5.5 agent, Opus verifying).
6. **§3 (My Reflection) is the user's. Never write, draft, or suggest text for it.** Leave its placeholder exactly as it is.
7. `tests.md` *Final Results* counts must match a full run you do now on this branch: server `npx vitest run` (default command), client `npx vitest run`, and the Playwright suite (`npm run e2e:prepare` then `npx playwright test`) with per-project counts. Flakes: rerun alone, report both. After Playwright: `git status --short artifacts/` — restore Lab 2/3 screenshots with `git checkout --`; do not commit Lab 4 screenshots that changed only by timestamp/ticket number.

## Commits and PR
- `docs(lab-04): …` commits, each ending with exactly:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CBvvM7KaeqGUTY6Abj1dUb`
- Stage by explicit path only. Never stage `latex/`, `.agents/`, `AGENTS.md`, `Gemini_Review.md`, `skills-lock.json`, `.claude/`, `server/.env*`, `agent/`, `material/`, `playwright-report/`, `test-results/`.
- PR `docs/lab4-report` → `lab4-staging`. Title like "Lab 4 records: audit, reviewer register, AI use (Issue #79)". Body: `Part of #79` (the release and PDF follow), what was audited and what changed, real counts, and one line saying §3 of ai-use.md is left for the author. **No "🤖 Generated with Claude Code" line and no session link in the body.**
- `gh pr edit <pr> --add-reviewer beambeambeam --add-label lab-04`. Link the PR to Issue #79 with `addCloseIssueReferences` (CLAUDE.md shows the exact GraphQL) and verify `closingIssuesReferences` = [79]. Hmm — careful: merging into staging does not close the Issue anyway, so linking is safe and is what Part 1 checks.

## Hard limits
Never merge. Never close an Issue. Never post on github.com/beambeambeam/toktickit. Never force-push. Never skip hooks. Never reset a database. Never kill processes by image name.

## Report back
PR URL and commits; every document change with the reason (code vs doc disagreement found); AC→test gaps; rows changed; the full counts (server, client, e2e per project) and flakes; reviewer.md check results for both repos; anything you could not resolve.
~~~~

</details>
