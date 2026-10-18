# Lab 4 Peer Review Record

A living document. Each Pull Request adds its own entry as part of that Pull Request,
while the conversation is still open — reconstructing this from GitHub afterwards was what
Lab 1 cost, and expanded-then-collapsed review threads are easy to miss.

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Author, repository owner | Kiatisak Markmeeshap | 67070501005 | [@Kiatisakk](https://github.com/Kiatisakk) |
| Peer reviewer | Supawit Marayat | 67070501045 | [@beambeambeam](https://github.com/beambeambeam) |

Review runs in both directions with the same partner: he reviews the Pull Requests in
[Kiatisakk/toktickit](https://github.com/Kiatisakk/toktickit), and I review his in
[beambeambeam/toktickit](https://github.com/beambeambeam/toktickit).

---

## Reviews I received

### PR #71 — Sprint 4 engineering contract (Issue #70)

[PR #71](https://github.com/Kiatisakk/toktickit/pull/71) · reviewed 2026-10-02 · **3 line comments**, verdict **Changes requested**.

Three findings, all real, all about the contract contradicting itself rather than the handout.

*Action edits could race a resolution.* The gate held the Ticket lock and so did Action creation, but an edit can also turn Follow-Up Required on, and the lock was stated for creation only. The fourth gate condition added after the user's review (no Planned Action) already blocks this particular case, because only a Planned Action can be edited — but the rule should not depend on that. Every Action write now takes the Ticket lock and re-checks that the Ticket accepts Actions under it; AC-27 covers edits as well as creation, and CONC-03 races an edit against a resolve.

*Cancelling a closing Action was promised to reopen its follow-up.* Only a Done Action closes a follow-up, and Done is terminal, so the outcome could never happen — and API-11 already said so, which made the contract disagree with its own test. BR-09, D-22 and the cancel response now state the true consequence.

*The edit form offered an immutable field.* It reused the create form, including the Follows-up selector, while BR-10 fixes the link at creation and `PATCH` refuses `followsUpId`. The field is now read-only in edit mode.

He approved with `LGTM` at 16:54:20Z on 2026-10-02 and merged ten seconds later as `5419199`. Issue #70 was closed by hand. Recorded on the next feature branch, #72's.

### PR #80 — Ticket versioning and status history (Issue #72)

[PR #80](https://github.com/Kiatisakk/toktickit/pull/80) · reviewed 2026-10-03 (review 5399433733) · **3 line comments**, verdict **Changes requested**. Fixes in `9edda8a` and `171253a`; each thread answered.

*The migration was not transactional.* Prisma Migrate does not wrap a SQL migration in a transaction, so a failure after the backfill could leave it half-applied, contrary to specification section 7. Real. The file now opens with `BEGIN;` and ends with `COMMIT;` (`down.sql` already did); there is no `ALTER TYPE ... ADD VALUE` in it, which is what would have forbidden that. New test MIG-12 asserts both statements and runs the file on the scratch database with a division by zero injected before the commit, then shows no `version` column, no `TicketStatusChange` table and every earlier row intact; it failed first on the missing `BEGIN;`. Honest limit: the behavioural half alone passes on the old file, because the driver sends a multi-statement string as one implicit transaction. The migration was already applied to the shared databases; `prisma migrate status` and `deploy` do not verify applied checksums, so nothing in `_prisma_migrations` was touched.

*The scratch database name was fixed and dropped with FORCE.* Real: a parallel run or a database with that name would be terminated and erased. The name now carries 12 random hex characters after the same prefix, is created without a prior drop and dropped by that exact name in `afterAll`. Verified by running the suite twice at once; both passed.

*A failed reload after a stale write was swallowed.* Real: the control said "We've loaded the latest version" even when that fetch had failed. The reload now reports whether it worked; the stale message waits for it, and a failure shows a distinct alert saying the data may be out of date and to reload the page. ui-spec section 8 states it. The new client test failed first (the alert never appeared).

**Outcome.** He approved on 2026-10-03 14:11 UTC ("LGTM", review on the fixed head) and merged it into `lab4-staging` himself eleven seconds later (`618e29e`). Issue #72 was closed by hand, since a merge into a staging branch closes nothing.

---

### PR #81 — Actions Taken API (Issue #73)

[PR #81](https://github.com/Kiatisakk/toktickit/pull/81) · reviewed 2026-10-03 · **4 line comments**, verdict **Changes requested** (review 5399435686).

Four findings, all real; each was reproduced with a failing test before it was fixed.

| File | Finding | What was done |
| --- | --- | --- |
| routes/actions.ts L230 🔴 | `followsUpId` accepts an Action dated after the new Action, reversing the follow-up chronology | A target dated after the new Action's effective time is refused `400`, `details.followsUpId`; the same instant is allowed (the list breaks ties by id and the target is the older row). The same order is kept when `actionAt` is edited (`details.actionAt`), in both directions: before the Action it follows up, and after any Action that follows it. BR-10, AC-13 and api-spec.md say so; API-12 and API-17 cover it |
| routes/actions.ts L149 🟡 | The performer can be deactivated after the eligibility lookup but before the Action commits | The performer's row is read `FOR SHARE` inside the writing transaction, after the Ticket lock, on create and on edit. `FOR SHARE` rather than `FOR UPDATE` because it must block the deactivation's `UPDATE` but need not make two writes naming one performer queue. Lock order is Ticket then User; the user-edit endpoint locks only User rows and never a Ticket, so there is no cycle. CONC-05 holds a pending deactivation and starts the write; removing the lock fails it |
| actions/validation.ts L149 🔴 | `Date` normalises impossible dates such as 30 February into March | The calendar and clock fields are checked before the instant is accepted: a real day of the month (leap years included), hour below 24, minute and second below 60, an offset of the same shape. Refused `400`, `details.actionAt`; BR-14 says so. Month 13 and minute 60 were already refused by `Date`; 30 February, 29 February in a common year, 31 April and hour 24 were not |
| actions/validation.ts L174 🔴 | A body key such as `__proto__` resolves to an inherited object and is called as a validator, giving a 500 | Validators are looked up in a `Map` and results are kept in prototype-free records, so no body key reaches anything inherited. `__proto__`, `constructor`, `toString` and `hasOwnProperty` are each refused by name on all four writes. `constructor` and `toString` had answered a 400 with an empty `details`; `__proto__` was a 500 |

Lab 3's `onlyField`, `users/validation.ts` and `ticketQuery.ts` were searched for the same lookup-by-body-key pattern: none calls a looked-up value, so none can 500 this way.

**Second round.** On 2026-10-03 14:11 UTC, right after merging #80, he requested changes again with one line: "Fix merge request conflict". #80 and #81 had both added to `schema.prisma` (the `User` and `Ticket` relations and a new model each), `errors.ts` (both added `STALE_UPDATE`), `ai-use-log.md` (both took row 5) and this file. `lab4-staging` was merged into the branch: both models and every relation kept, the duplicate error key removed, this PR's log row renumbered 6.

**Outcome.** He approved with `LGTM` at 2026-10-03 14:39:34Z and merged it himself twelve seconds later (`d29f919`). Issue #73 was closed by hand.

### PR #82 — Actions Taken UI (Issue #74)

[PR #82](https://github.com/Kiatisakk/toktickit/pull/82) · reviewed 2026-10-04 (review 5405306621) · **2 line comments**, verdict **Comment**; both were treated as findings to fix.

Both are real; each was reproduced with a failing test before the fix.

| File | Finding | What was done |
| --- | --- | --- |
| ActionForm.tsx L291 | Fields stay editable after Save captures the request body, so a success that closes the form drops edits made in flight | Both Action forms wrap their fields in a `<fieldset disabled>` while the write is busy; a failure enables them again with the text kept, and when the form is still there with no field to point at, focus returns to Save (the disabled control had dropped it). ui-spec section 6 says so. Three tests (create and complete fields disabled while pending, enabled again on a refusal) |
| ActionsTaken.tsx L126 | A write can answer after another row opens a form, and the late success closes the newer form and discards its draft | Chose to guard the close by the mode that submitted, not to block row buttons: the late answer still updates the list but only closes the form whose mode matches; ui-spec names only the submit control as busy, so blocking every row button would add a state the contract does not have. Test holds a write, opens another row's form, types, releases, and asserts the newer form and draft survive |

**Outcome.** He approved with `LGTM` at 2026-10-07 09:39:26Z on the fixed head and merged it himself eight seconds later (`627d3da`). Issue #74 was closed by hand. Merging it into `lab4-staging` then put #83 and #84 in conflict with it; see below.

### PR #83 — Role dashboards and URL-driven filters (Issue #76)

[PR #83](https://github.com/Kiatisakk/toktickit/pull/83) · reviewed 2026-10-06 (review 5405297014) · **1 line comment**, verdict **Comment**; treated as a finding to fix. Fix in the commit recorded in the thread reply.

*The id filters accepted `0` and unsafe integers.* Real. The screens read `categoryId` (and the queue `ownerId`) with `/^\d+$/`, so `?categoryId=0` and `?categoryId=99999999999999999999` were sent, and the API (`readPositiveInt` in `server/src/tickets/ticketQuery.ts`: digits only, `Number.isSafeInteger`, at least 1) answers 400. Four new client tests failed first for that reason (`categoryId=0` and the 20-digit value, on My Tickets and on the queue). One shared helper, `client/src/lib/positiveSafeIntegerParam.ts`, now applies the server's rule to `categoryId` on both screens and `ownerId` on the queue; a refused value is ignored, not sent. The other URL filters (`status`, `requestedPriority`, `itPriority`, `statusGroup`, `followUp`, `unassigned`) are matched against fixed lists, so they had no such gap. UI-17 and UI-18 in `tests.md` carry the new cases.

**Merge conflict after #82.** #82 merged first and both Pull Requests had appended at the same places: the end of `client/src/lib/api.ts` and `client/src/styles/components.css`, one row each in `ai-use-log.md` and this file's Coverage table, and the UI rows in `tests.md` (#82 had moved UI-19 to UI-30 to Pass, this one UI-01 to UI-18). `lab4-staging` was merged into the branch: both appended blocks kept, each `tests.md` row taken from the side that made it pass (no row was changed by both), both log rows kept.

**Outcome.** He approved with `LGTM` at 2026-10-07 10:53:34Z and merged it himself ten seconds later (`e99bb1e`). Issue #76 was closed by hand. Merging it put #84 in conflict a second time; see below.

### PR #84 — Resolution gate (Issue #75)

[PR #84](https://github.com/Kiatisakk/toktickit/pull/84) · reviewed 2026-10-06 (review 5405295367) · **1 line comment**, verdict **Comment**; treated as a finding to fix.

| File | Finding | What was done |
| --- | --- | --- |
| routes/staffTickets.ts L488 | A concurrent status change can hit the gate refusal before the locked version check, answering `400 RESOLUTION_GATE_FAILED` instead of `409 STALE_UPDATE` | Real. The version was compared only before the transaction; under the lock the gate ran with no comparison, so a request that went stale while queued was judged against the newer Actions. `lockTicket` now returns the `version` it read under the lock and the route compares it, refusing `409 STALE_UPDATE` with nothing written, before the gate. CONC-06 holds the Ticket lock, commits a version bump, and sends a resolve (no Done Action) that was queued behind it; it was `400 RESOLUTION_GATE_FAILED` first. api-spec.md says the version is compared again under the lock |

The same ordering was checked elsewhere. The owner and IT-priority writes evaluate no rule after the version check and write conditionally on the version. Action edit, complete and cancel compare the version under the lock before state and actionability; Action create has no version.

**Merge conflict after #82.** #82 merged first and both Pull Requests had appended at the same places: the end of `client/src/lib/api.ts` and `client/src/styles/components.css`, one row each in `ai-use-log.md` and this file's Coverage table, and the UI rows in `tests.md` (#82 had moved UI-38 to Pass, this one UI-32 to UI-37 and the resolve-dialog half of UI-36). `lab4-staging` was merged into the branch: both appended blocks kept, each `tests.md` row taken from the side that changed it (no row was changed by both), both log rows kept.

**Second merge conflict, after #83.** #83 merged next and had inserted at the same places: `components.css` (both blocks placed before #74's), the next row of `ai-use-log.md`, this file, and two `tests.md` rows (UNIT-05 moved to Pass here, UNIT-06 there). `lab4-staging` was merged into the branch: both CSS blocks kept, each row taken from the side that made it pass, log rows kept in order 7, 8, 9.

**Outcome.** He approved with `LGTM` at 2026-10-07 17:27:50Z and merged it himself ten seconds later (`13c5594`). Issue #75 was closed by hand. Recorded on the next feature branch, #77's.

### PR #85 — End-to-end journeys and screenshots (Issue #77)

[PR #85](https://github.com/Kiatisakk/toktickit/pull/85) · reviewed 2026-10-08 (review 5458186644) · **2 line comments**, verdict **Changes requested**.

| File | Finding | What was done |
| --- | --- | --- |
| e2e/lab-04/support.ts L71 | 🟡 The matcher accepts every 4xx as a designed refusal, so an unexpected 401/422/429 bypasses AC-47 | Real. `console-guard.spec.ts` was written first and failed on the old guard for all seven cases (an undeclared 401, 403, 404, 409, 422, 429 and an aborted fetch were all tolerated). The guard now keeps raw events and decides at the end: a 4xx passes only if the test declared `guard.expectRefusal(method, url, status)`, and the browser's console line only if its URL and status match a declaration. Every journey that provokes a refusal now declares it (400 inactive performer, 409 stale Action, 404 other Requester's ticket, 409 not actionable, 400 resolution gate, 409 stale ticket, 403 stubbed dashboards); a declaration that never happens fails the test. Removing one declaration fails its test; changing one status fails it twice (undeclared and never happened). The run also showed the app ships no favicon: the browser's `/favicon.ico` 404, previously swallowed by the any-4xx rule, is now the one named standing allowance |
| e2e/lab-04/support.ts L77 | 🟡 Every `ERR_FAILED` console error is counted as intentional, and the request handler also ignores it, so unrelated fetch failures bypass AC-47 | Real, same cause. `ERR_FAILED` is now tolerated only for a URL a test declared with `guard.expectAbort(url)` (the two failure-state stubs for the dashboards); any other failed request, and its console line, is reported. `ERR_ABORTED` (the browser cancelling what a navigation left in flight) is still not a failure |

**Outcome.** Fixes pushed to the same branch; both threads answered, then resolved after the fix was checked again here (restoring the any-4xx rule failed 8 of the guard tests). He approved with `LGTM` at 2026-10-10 07:05:12Z and merged it himself nine seconds later (`33eca2e`). Issue #77 was closed by hand. Recorded on the next feature branch, #78's.


### PR #86 — Final regression and hardening (Issue #78)

[PR #86](https://github.com/Kiatisakk/toktickit/pull/86) · reviewed 2026-10-14 · **0 line comments**, verdict **Approved** (`LGTM`, no findings).

Nothing was raised, so there was nothing to answer and no thread to resolve. The Pull Request carried the `lab-04` label and was linked to its Issue by hand (`closingIssuesReferences` = [78]; a closing keyword does not link against a staging base).

**Outcome.** He approved at 15:52:25Z on 2026-10-14 and merged it himself nine seconds later (`a5b90c9`). Issue #78 was closed by hand at 16:43Z, since a merge into a staging branch closes nothing. Recorded on the end-of-sprint report branch (`docs/lab4-report`), because no feature branch follows it.

---

## Reviews I gave

### beambeambeam#80 — Sprint 4 engineering contract (his Issue beambeambeam/toktickit#73)

[beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) · reviewed 2026-10-02 · **8 line comments**, verdict **Changes requested**. Caveman format at the user's request.

A detailed contract — lock ordering, an idempotent create, and drill-down filters defined to reproduce each card's count — and every test file its `tests.md` cites was checked to exist on his branch. Changes were requested for three process problems, stated in the review body because they have no line:

- the Pull Request targets `main`, and no `lab4-staging` exists on his repository, so the feature → staging → main history Part 1 grades would be skipped;
- `docs/lab-04/reviewer.md` and `ai-use.md` are missing, though §12 of the handout lists six files;
- no `lab-04` label, and `Closes beambeambeam/toktickit#73` stops linking once the base is a staging branch.

**Line findings.**

| File | Finding |
| --- | --- |
| specification.md L98 🟡 | Headings drift from the handout's eleven sections; §11 Assumptions and Decisions is missing |
| specification.md L51 🟡 | A Completed action can never carry Follow-Up Required, so the gate clause about one is dead, and the follow-up note is erased before completion |
| specification.md L141 🟡 | Four ACs describe the contract process, not product behaviour |
| specification.md L25 ❓ | Where `reviewer.md` and `ai-use.md` will be created |
| specification.md L3 🔵 | "approved" on an unreviewed PR |
| api-spec.md L244 🟡 | Three error codes for one gate, with no defined precedence when several conditions fail |
| ui-spec.md L96 🟡 | No screenshot inventory for the three folders the handout fixes |
| tests.md L90 🔵 | One test ID bundles about eight behaviours |

Our own contract (this PR) was checked against the same list before it was opened for review: eleven handout headings, ACs in Given/When/Then form, one gate error code listing every unmet condition, and a screenshot inventory.

**Outcome.** He replied on all eight threads within the hour, each naming the commit that fixed it, and fixed the three process problems too: created `lab4-staging`, retargeted the Pull Request, added the `lab-04` label and the two missing registers, and linked his Issue. Re-reviewed at `7717a45` against the files rather than the replies, plus a mechanical check (AC-01 to AC-25 without gaps, every AC in his crosswalk, no duplicate or undefined test ID). **Approved** 2026-10-02 16:46:21Z. Merged 2026-10-02 16:48:36Z by the author's account, Kiatisakk, after the approval.

---

### beambeambeam#81 — Domain guidance and clearer PR summaries (no Issue)

[beambeambeam#81](https://github.com/beambeambeam/toktickit/pull/81) · approved 2026-10-02 · **0 line comments**, verdict **Approved** (`LGTM`).

A documentation-only Pull Request on his side: a domain-modelling guidance file (`docs/agents/domain.md`), an `AGENTS.md` edit and a wording change to the pull request template (42 lines added, 5 removed). It belongs to no Lab 4 Issue ("Related Issues: None") and changes no behaviour, so there were no acceptance criteria to read it against. The automated reviewer (Greptile) left one non-blocking remark about work done before the glossary exists. I raised no line findings.

**Outcome.** **Approved** 2026-10-02 18:05:31Z (`LGTM`), then merged by us eleven seconds later at 18:05:42Z (`ab279fa`) after confirming no `DO NOT MERGE` label. It carries no `lab-04` label and no Issue; it is listed because it landed on his `lab4-staging`.

---

### beambeambeam#82 — Create and view Actions Taken (his Issue beambeambeam/toktickit#74)

[beambeambeam#82](https://github.com/beambeambeam/toktickit/pull/82) · reviewed 2026-10-03 (review 5400167296) · **12 line comments**, verdict **Changes requested**. Caveman format. Drafted by a Sonnet 5.5 agent in a separate clone of his repository, which never touched our databases; each finding was checked against his code and his contract before posting, and two were reworded as a result.

The slice is mostly sound: lock order, replay before the terminal check, the Requester 403/404 split and an additive migration all follow his contract. In the body: no `lab-04` label, and `ai-use.md` not updated for this Issue.

| File | Finding |
| --- | --- |
| repositories/actions.ts L51 🔴 | His contract contradicts itself on Resolved: BR-10 says only Closed and Cancelled are terminal, but AC-13, the error table and ui-spec reject Action writes on Resolved too. The code allows creation on Resolved, so a Resolved Ticket can hold a pending Action. Pick one side and make the documents agree |
| actions.api.test.ts L436 🔴 | The test asserts `201` on Resolved, pinning the side AC-13 rejects |
| tests.md L85 🟡 | API-05 is marked Pass while its result says "permits Resolved", against its own Expected cell |
| action-rules.ts L61 🟡 | A blank assignee option passes validation and silently assigns the creator |
| actions-taken-section.tsx L86 🟡 | Add disables itself while focused, so focus drops to `body` when the form opens |
| actions-taken-list.tsx L43 🟡 | A global `min-height: 6rem` leaves dead space under every short field |
| services/actions.ts L109 🟡 | `ACTION_LIST_FAILURE` is in neither api-spec nor OpenAPI; the bare `catch` loses the cause |
| artifacts/lab-04/README.md L5 🟡 | Screenshot provenance cites a commit that does not exist in his repository |
| services/actions.ts L29 🔵 | `ACTION_ASSIGNEE_INELIGIBLE` has no `details.field`, so the error is not shown beside the select |
| action-payload.ts L16 🔵 | Hashed field order differs from api-spec §3 |
| actions-taken-list.tsx L163 🔵 | Two sibling `h3`s per saved row; headings are only timestamps |
| tests.md L113 ❓ | MIG-01 is Pass but its script is manual and wired into no test run |

Not verified by us: his server suite, migration script and e2e (they need his database), and his claim of 132 client tests (the full run did not finish under load; the 25 Lab 4 client tests and `tsc -b` passed).

**Outcome.** He replied on the threads and pushed fixes. Re-reviewed at `1023107` against the code, not the replies: all twelve fixed, each confirmed by reverting the fix and watching its test fail (server 12/12 and Lab 4 client 27/27 on a throwaway database); Resolved is now refused on Action creation with `409 TICKET_TERMINAL`. One non-blocking leftover was raised inline: BR-10 and AC-05 still say "nonterminal" where the rest of his contract now says Resolved is closed. **Approved** 2026-10-03 19:04:00Z (review 5402317544). Merged 2026-10-03 19:06:41Z by the author's account, Kiatisakk, after the approval.

---

### beambeambeam#83 — Edit and assign pending Actions Taken safely (his Issue beambeambeam/toktickit#75)

[beambeambeam#83](https://github.com/beambeambeam/toktickit/pull/83) · reviewed 2026-10-06 (review 5432256905) · **4 line comments**, verdict **Changes requested**. Caveman format. Drafted by a Sonnet 5.5 agent in a separate clone, run against a temporary PostgreSQL that was removed afterwards; checked before posting, and one finding was lowered from 🔴 to 🟡 because it costs focus, not data.

Changes requested for two process problems stated in the body: the Pull Request is not linked to its Issue (a closing keyword does not link against a staging base), and `ai-use.md` has no entry for this Issue although its `tests.md` and description say AI helped. The server side holds: lock order, strict body, version check, assignee re-check and the edit history each failed a test when removed, and edits are refused on a Resolved Ticket, the gap raised on #82.

| File | Finding |
| --- | --- |
| actions-taken-edit.tsx L357 🟡 | "Refresh and review" removes itself while focused, so focus falls to `body` (reproduced in a throwaway test) |
| actions-taken-edit.tsx L186 🟡 | A server field error is shown beside its field but focus stays on Save (reproduced in a throwaway test) |
| actions-edit.api.test.ts L590 🟡 | No test proves the Ticket lock on edit: removing it left all seven tests green, yet two `tests.md` rows are Pass on that evidence |
| actions-taken-history.tsx L120 ❓ | History shows a bare "Assignee ID 7"; asked whether the name is meant to be shown |

Not verified by us: his two-browser e2e, his full suites, and focus in a real browser (the two focus findings were reproduced in jsdom only).

**Outcome.** He replied on all four threads and on the two process items: Issue #75 linked, `ai-use.md` entry added. A Sonnet 5.5 agent re-reviewed `9cbb6b6` against the code, reverting each fix to see its test fail: focus after refresh, focus on a server field error, assignee names in history (shown from current lookups, falling back to "Former assignee (User #id)"), and a new test that sees the edit block on the Ticket `FOR UPDATE` lock; deleting the lock again now fails it. One mutation was repeated in this session and also failed its test. The agent's doubt that the review heading could steal focus later was checked against the code and does not hold: every failed save sets `failure`, and a successful one closes the form. **Approved** 2026-10-07 (review 5443306339); then merged by us at 13:50:35Z (`a19fd46`) after confirming no `DO NOT MERGE` label. Not run: his e2e, full suites and lint.


---

### beambeambeam#84 — Progress, complete and cancel Actions Taken (his Issue beambeambeam/toktickit#76)

[beambeambeam#84](https://github.com/beambeambeam/toktickit/pull/84) · reviewed 2026-10-12 (review 5484501760) · **8 line comments**, verdict **Changes requested**. Caveman format. Drafted by a Sonnet 5.5 agent on a private PostgreSQL that was removed afterwards; the draft proposed approval, and the verdict was raised after the first finding was checked here against his ui-spec.

The server rules held: lock order, version checks, state edges, terminal-Ticket refusal and the event history; 14 of 18 mutants of `transitionAction` were killed by his tests, and 4 of 4 in his request validator.

| File | Finding |
| --- | --- |
| actions-taken-controls.tsx L316 🟡 | `if (!canProgress) return null` unmounts the success status the moment an Action turns Completed or Cancelled, so the message vanishes and focus falls to `body`, against his ui-spec L94 (announce async success) and L95 (focus returns sensibly after a dialog closes) |
| actions-edit-ui.test.tsx L796 🟡 | The two lifecycle UI tests pass on a single render of that message |
| repositories/actions.ts L475 🟡 | The snapshot-assignee check is untested: deleting it left all 19 API tests green |
| actions.api.test.ts L1090 🟡 | `ACCOUNT_INACTIVE` for the acting user is untested (same mutation result) |
| actions.api.test.ts L791 🟡 | The assignee recheck on completion is untested (same mutation result) |
| actions-taken-controls.tsx L281 🔵 | Query key copied by hand instead of `ticketActionsQueryOptions(...).queryKey` |
| actions-taken-controls.tsx L385 🔵 | A disabled Complete button's reason is not linked to it |
| actions-taken-controls.tsx L531 ❓ | Whether Complete or Cancel should wait while an edit draft is open |

**Outcome.** He fixed all eight, answering the question by locking the lifecycle buttons while a draft is open. Re-reviewed at `8b13c6a` in code: each fix was reverted and its test failed (three server rules, three client behaviours); restoring the early `return null` was repeated here and failed two UI tests. **Approved** 2026-10-12 (review 5487381598), then merged by us at 06:59:48Z (`7f566c4`) after confirming no `DO NOT MERGE` label. Not run: his e2e, full server suite and lint.

---

### beambeambeam#85 — Requester dashboard and exact drill-down (his Issue beambeambeam/toktickit#78)

[beambeambeam#85](https://github.com/beambeambeam/toktickit/pull/85) · reviewed 2026-10-12 (review 5484645894) · **14 line comments**, verdict **Changes requested**. Caveman format. Drafted by a Sonnet 5.5 agent on a private PostgreSQL that was removed afterwards. (A first attempt was stopped when it looked as if no review had been requested; he had asked in person, so it was restarted from scratch.)

His server diff matched his contract: counts, the inclusive seven-day window, ordering, the role guard and validation. The findings were in the client and in what the tests prove.

| File | Finding |
| --- | --- |
| landing-page.tsx L26 🔴 | A Requester's sign-in still navigates to `/tickets` (`login-page.tsx` L70 and L144), though his Issue makes the Dashboard the Requester landing; the e2e opened `/dashboard` directly |
| my-tickets-page.tsx L274 🟡 | A malformed `from`/`through` in the URL throws `RangeError` and breaks My Tickets |
| my-tickets-page.tsx L271 🟡 | The scope note is in Bangkok time, the rows in the viewer's |
| requester-dashboard-page.tsx L162, L189 🟡 | Refresh and Retry disable themselves while focused, so focus is lost |
| dashboard-query-options.ts L15 🟡 | No write invalidates the Requester dashboard query (read from code) |
| requester-dashboard.api.test.ts L215, L243 🟡 | No row on a window boundary (`gte`/`lte` → `gt`/`lt` survived) and no foreign Waiting row (dropping the ownership filter survived) |
| dashboard-rules.test.ts L31 🟡 | Tests helpers production does not use |
| tests.md L80, L109 🟡 | RULE-03 and API-29 claimed boundary and isolation proofs the tests did not give |
| 3 × 🔵 | Third copy of the Bangkok formatter; dead helpers; an `aria-label` hiding "Refreshing…" |

**Outcome.** He fixed or answered all fourteen (the cache finding by refetching on every visit instead of invalidating per writer, which covers every writer). Re-reviewed at `9da4a61` in code, each fix reverted to see its test fail, including the four boundary mutations and the ownership filter; restoring the `/tickets` redirect was repeated here and failed the sign-in test. **Approved** 2026-10-12 (review 5487498566) with two 🔵 notes (the zone printed twice in the "Updated" note; stale counts in REG-03). Merging #84 then put it in conflict with his `lab4-staging`; he merged staging into the branch (`6d1c7ea`, conflicts in docs and the generated API client). That merge was checked here: no conflict markers, client and server `tsc` clean, client suite 186/186 (server suite not re-run). Approved again (review 5488864893) and merged by us at 2026-10-12 09:32:28Z (`6ad32a5`) after confirming no `DO NOT MERGE` label.

---

### beambeambeam#86 — Enforce the final Ticket lifecycle and resolution gate (his Issue beambeambeam/toktickit#77)

[beambeambeam#86](https://github.com/beambeambeam/toktickit/pull/86) · reviewed 2026-10-14 18:41 UTC, i.e. 2026-10-15 local (review 5522907404) · **16 line comments** (12 🟡, 4 🔵, no 🔴), verdict **Changes requested**. Checked on a clean checkout of `dd9f7df` with a private PostgreSQL.

No finding breaks the transition matrix, the gate or its error shape on the server. The body names three process items: no `lab-04` label, no `ai-use.md` entry for his Issue, and his Issue is linked correctly. Greptile's two comments (a reset owner keeps active Tickets; history beyond 20 events unreachable) were folded into the inline items below.

| File | Finding |
| --- | --- |
| staff-ticket-detail-page.tsx L639 🟡 | After Confirm the dialog closes and focus goes to a button already disabled by `setSelectedStatus("")`, so focus falls to `body` on success and on `RESOLUTION_GATE_FAILED`; the reasons list is also outside the `aria-live` region (reproduced in a throwaway jsdom test) |
| staff-ticket-detail-page.tsx L863 🟡 | Status history is mounted only on the staff page; his specification and ui-spec say a Requester reads their own status history, and the API already allows it |
| ticket-status-history-section.tsx L37 🟡 | Always requests page 1 of 20, oldest first, so event 21 onward is unreachable while the header counts every change (same as Greptile P2) |
| ticket-status-history-section.tsx L10 🔵 | Times use the browser zone with no label, where ui-spec requires Asia/Bangkok, labelled |
| openapi.yaml L399 🟡 | OpenAPI still says the status route is for IT Staff only, lists none of the new error shapes, and two role descriptions are false after the guard changes |
| ticket-workflow.ts L69 🟡 | Owner eligibility now also requires `!mustChangePassword`, which `docs/lab-04` never says; an Administrator reset leaves the Ticket assigned to an owner who then cannot move it (same as Greptile P1) |
| ticket-workflow.api.test.ts L326 🟡 | Mutation survivor: counting only Planned and dropping In Progress leaves all 58 tests green |
| ticket-workflow.api.test.ts L508 🔵 | `updateTicketStatus` is called with 4 of 5 arguments (TS2554), unnoticed because the server `tsconfig` does not include tests |
| ticket-workflow.api.test.ts L562 🟡 | Mutation survivor: any Requester can read any Ticket's history and every test passes; no foreign-Requester history read exists |
| ticket-workflow.api.test.ts L599 🔵 | Mutation survivor: forcing `skip = 0` passes; no test sends `page` or `pageSize` |
| ticket-workflow.api.test.ts L695 🟡 | Mutation survivor: deleting `lockTicket` leaves every test green because the race uses one actor; a different-actor race left an invalid Resolved Ticket in 24 of 25 runs, 0 at baseline |
| tests.md L100 🟡 | API-20 cites one invalid edge and the unit matrix, not the test that exercises the 16 valid edges; clearing `resolvedAt` on Closed passes |
| tests.md L123 🟡 | The Issue's 320 px and 200% zoom criteria are recorded as not run, so the card cannot reach Done |
| tests.md L127 🔵 | AUTH-01 cites a 404 that is the indication `PUT`, not the history `GET` |
| tests.md L133 🟡 | The Issue asks for lifecycle and concurrency E2E coverage; the row records none |
| ticket-workflow.test.tsx L281 🟡 | Five mutation survivors in the two status-detail client files (Administrator controls, refetch on 409, cache update on success, history invalidation, clearing reasons) |

Not verified by us: Playwright, responsive and zoom checks, axe, screenshots and the production build. His server suite (203 passed, 5 skipped) and client suite (194 of 194 with a raised timeout) matched his numbers; `lab-03/auth.api.test.ts` could not start in the review environment.

**Outcome.** He answered every thread with a commit. Re-reviewed at `1e4c0ea` in code (a Sonnet 5.5 agent drafted, I checked): 15 of 16 fixed or soundly answered, and each fix was reverted to see its test fail (17 mutants, all as stated, among them the different-actor race, which now fails without `lockTicket`). Ran: ticket-workflow API 22/22, 14 related server files 133 tests, the touched client files, `tsc` clean for client and server source. **Approved** 2026-10-15 10:33:53Z (review 5531762186) with two 🔵 left open: the four-argument `updateTicketStatus` call (TS2554) is still there, and his `reviewer.md` row says it was fixed. Merged by us at 10:34:02Z (`78be599`) after confirming no `DO NOT MERGE` label. Not run: full suites, Playwright, lint, `openapi:check`.

---

### beambeambeam#87 — Deliver the Staff dashboard and My Actions drill-down (his Issue beambeambeam/toktickit#79)

[beambeambeam#87](https://github.com/beambeambeam/toktickit/pull/87) · reviewed 2026-10-14 18:12 UTC, i.e. 2026-10-15 local (review 5522498888) · **11 line comments** (1 🔴, 7 🟡, 3 🔵), verdict **Changes requested**. Checked on a private PostgreSQL; his four staff server files (24 tests) passed there, and 24 mutants of his real predicates were run, 21 killed.

His behaviour matched the contract: every staff card, preview and drill-down agreed with independent SQL for IT Staff A, B and the Administrator. The body names two process items: no `lab-04` label and no `ai-use.md` entry for his Issue.

| File | Finding |
| --- | --- |
| staff-dashboard.api.test.ts L7 🔴 | A static `import` of the repository binds `prisma` to the ambient `DATABASE_URL` before the fixture swaps it, so the fixture's `deleteMany` runs against the developer's database: a sentinel `User` was deleted and four fixture users left behind. His already merged `requester-dashboard.api.test.ts` has the same pattern |
| staff-dashboard.api.test.ts L465 🟡 | Two mutants survive: the Urgent preview without the active filter, and with `take: 6` |
| staff-dashboard.api.test.ts L468 🟡 | `take: 6` on the My Actions preview survives; only 3 pending Actions are seeded, so the cap of five is untested |
| staff-dashboard.spec.ts L33 🟡 | The drill-down journey asserts the URL only, not that the card's number equals the list's total |
| staff-my-actions-page.tsx L105 🟡 | An out-of-range page answers `items: []` with `totalItems: 25` and the UI says "No assigned actions" (same as Greptile P2) |
| staff-my-actions-page.tsx L143 🟡 | Focus is lost on every page change: no `placeholderData`, so the pagination control unmounts |
| dashboard-query-options.ts L34 🔵 | Two invalidations match no query key now in use; staff status, owner and priority writes invalidate neither dashboard |
| ticket-search.ts L94 🔵 | A drill-down link with a bad date window silently becomes an unfiltered queue, with no notice |
| tests.md L111 🟡 | API-31 (card against list parity) has no staff test; I ran one over 128 Tickets and all counts agreed, and asked for a committed version |
| tests.md L122 🔵 | UI-05 says Queue filter UI is not run, but his PR adds four Queue tests |
| tests.md L435 🟡 | The Issue's axe, 320 px, 200% zoom, performance and Administrator criteria are recorded as not run |

Not verified by us: any browser or E2E run, axe, zoom, screenshots, lint, and `lab-03/auth.api.test.ts`.

**Outcome.** Three more rounds before the merge.

| Round | Head | Verdict | What was checked |
| --- | --- | --- | --- |
| Re-review, 2026-10-15 10:35Z (review 5531778638) | `17fecae` | **Approved**, two 🔵 | All 11 fixed or answered. The 🔴 reproduced both ways: with the dynamic import a sentinel User in a separate ambient database survived; with the static import put back it was deleted. Server mutants 4/4 killed, client 7/8 (the survivor is hidden by the page clamp and harmless). The two 🔵: nothing stops a static import coming back; the Ticket Detail calls to `invalidateStaffWorkQueries` were untested. Merging #86 then put this PR in conflict. |
| Third pass, 2026-10-16 13:12Z (review 5548238842) | `54fa40e` | **Changes requested**, one 🟡 | He rebased onto `78be599` and answered both 🔵: a fixture guard that fails setup when Prisma is not on the test database (`ae697c0`; the full server suite ran with it and no fixture tripped it), and a Ticket Detail test that fails when either call is replaced (checked here). The rebase was checked with a trial merge of the old head: the same 11 files conflict, every other file matches. New: his performance test read Tickets without `orderBy`, so its expected `myActions` of 400 depended on row order; it failed 2 runs in 3 with `402 !== 400`, and passed 3/3 with the line added. The 13 earlier threads were resolved here after checking. Also noted, not blocking: at the default worker count 5 of 7 full client runs had one or two `findBy*` timeouts, a different test each time; 255/255 with four workers. |
| Final, 2026-10-18 21:28Z (review 5565048968) | `74a7adf` | **Approved** | The one-line `orderBy` fix: the file passed 8/8 three times; full server suite 237 passed, 5 skipped, 0 failed; server `tsc` clean. |

Merged by us at 2026-10-18 21:28:24Z (`225ad8c`) after confirming no `DO NOT MERGE` label and the head commit. Not run by us in any round: Playwright, axe, screenshots, lint, and `lab-03/auth.api.test.ts` (it cannot start in the review environment).

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [#71](https://github.com/Kiatisakk/toktickit/pull/71) | received | 3 | Changes requested → Approved | Merged |
| [#80](https://github.com/Kiatisakk/toktickit/pull/80) | received | 3 | Changes requested → Approved | Merged |
| [#81](https://github.com/Kiatisakk/toktickit/pull/81) | received | 4 + merge conflict | Changes requested ×2 → Approved | Merged |
| [#82](https://github.com/Kiatisakk/toktickit/pull/82) | received | 2 | Comment → Approved | Merged |
| [#83](https://github.com/Kiatisakk/toktickit/pull/83) | received | 1 + merge conflict | Comment → Approved | Merged |
| [#84](https://github.com/Kiatisakk/toktickit/pull/84) | received | 1 + merge conflict ×2 | Comment → Approved | Merged |
| [#85](https://github.com/Kiatisakk/toktickit/pull/85) | received | 2 | Changes requested → Approved | Merged |
| [#86](https://github.com/Kiatisakk/toktickit/pull/86) | received | 0 | Approved | Merged |
| [beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) | given | 8 | Changes requested → Approved | Merged |
| [beambeambeam#81](https://github.com/beambeambeam/toktickit/pull/81) | given | 0 | Approved | Merged |
| [beambeambeam#82](https://github.com/beambeambeam/toktickit/pull/82) | given | 12 | Changes requested → Approved | Merged |
| [beambeambeam#83](https://github.com/beambeambeam/toktickit/pull/83) | given | 4 + 2 process | Changes requested → Approved | Merged |
| [beambeambeam#84](https://github.com/beambeambeam/toktickit/pull/84) | given | 8 | Changes requested → Approved | Merged |
| [beambeambeam#85](https://github.com/beambeambeam/toktickit/pull/85) | given | 14 | Changes requested → Approved | Merged |
| [beambeambeam#86](https://github.com/beambeambeam/toktickit/pull/86) | given | 16 + 2 nits | Changes requested → Approved | Merged |
| [beambeambeam#87](https://github.com/beambeambeam/toktickit/pull/87) | given | 11 + 2 nits + 1 | Changes requested → Approved → Changes requested → Approved | Merged |
