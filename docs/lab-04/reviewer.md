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

### PR #82 — Actions Taken UI (Issue #74)

[PR #82](https://github.com/Kiatisakk/toktickit/pull/82) · reviewed 2026-10-04 (review 5405306621) · **2 line comments**, verdict **Comment**; both were treated as findings to fix.

Both are real; each was reproduced with a failing test before the fix.

| File | Finding | What was done |
| --- | --- | --- |
| ActionForm.tsx L291 | Fields stay editable after Save captures the request body, so a success that closes the form drops edits made in flight | Both Action forms wrap their fields in a `<fieldset disabled>` while the write is busy; a failure enables them again with the text kept, and when the form is still there with no field to point at, focus returns to Save (the disabled control had dropped it). ui-spec section 6 says so. Three tests (create and complete fields disabled while pending, enabled again on a refusal) |
| ActionsTaken.tsx L126 | A write can answer after another row opens a form, and the late success closes the newer form and discards its draft | Chose to guard the close by the mode that submitted, not to block row buttons: the late answer still updates the list but only closes the form whose mode matches; ui-spec names only the submit control as busy, so blocking every row button would add a state the contract does not have. Test holds a write, opens another row's form, types, releases, and asserts the newer form and draft survive |

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

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [#71](https://github.com/Kiatisakk/toktickit/pull/71) | received | 3 | Changes requested → Approved | Merged |
| [#80](https://github.com/Kiatisakk/toktickit/pull/80) | received | 3 | Changes requested → Approved | Merged |
| [#81](https://github.com/Kiatisakk/toktickit/pull/81) | received | 4 + merge conflict | Changes requested ×2 | Open — fixes and conflict resolution pushed |
| [#82](https://github.com/Kiatisakk/toktickit/pull/82) | received | 2 | Comment | Open — fixes pushed |
| [beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) | given | 8 | Changes requested → Approved | Merged |
| [beambeambeam#82](https://github.com/beambeambeam/toktickit/pull/82) | given | 12 | Changes requested | Open |
