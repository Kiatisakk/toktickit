# Lab 2 Peer Review Record

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

### PR #22 — sprint engineering contract

[Kiatisakk/toktickit#22](https://github.com/Kiatisakk/toktickit/pull/22) ·
`docs/lab2-specification` → `lab2-staging` · linked to Issue #14

| | |
| --- | --- |
| Review state | **Approved** — 2026-08-20 17:24 UTC |
| Review body | `LGTM` |
| Inline comments | none |
| Merged by | @beambeambeam, 2026-08-20 17:24 UTC |

Contents under review: `specification.md` (eleven sections, FR-01…FR-21, BR-01…BR-36,
AC-01…AC-25, twelve recorded decisions), `api-spec.md`, `ui-spec.md`, and `tests.md` with
52 planned tests.

The Pull Request description named five decisions I specifically wanted challenged, since
each is expensive to reverse once code exists: modelling identity as `User` rather than
`RequesterUser`, storing attachments on disk rather than in a column, answering `404`
rather than `403` for an unowned resource, carrying three columns Lab 2 does not populate,
and the ticket-number format. None drew a comment.

**Nothing to respond to.** An approval with no comments leaves no thread to reply on. I am
recording that plainly rather than dressing it up — this entry is thinner than a review
record should be, and the remaining Pull Requests are where the substantive exchange has to
happen.

The merge was clicked by the reviewer rather than by me, which is what the workflow guide
requires and what Lab 1 got wrong on every Pull Request.

---

### PR #23 — Zen Green foundation, routing and tooling

[Kiatisakk/toktickit#23](https://github.com/Kiatisakk/toktickit/pull/23) ·
`feature/zen-green-foundation` → `lab2-staging` · linked to Issue #15

| | |
| --- | --- |
| First review | **Commented** — 2026-08-22 16:04 UTC, three inline comments |
| Review body | "Three changes I would like to see before approval - details inline." |
| My replies | 2026-08-22 16:53 UTC, one on each thread |
| Second review | **Approved** — 2026-08-22 17:13 UTC, "LGTM" |
| Merged by | @beambeambeam, 2026-08-22 17:13 UTC |

All three were correct and all three were taken. Nothing was argued down.

| # | File | What he said | What I did |
| --- | --- | --- | --- |
| 1 | `client/tsconfig.app.json` | `strictNullChecks` alone leaves `noImplicitAny`, `strictFunctionTypes` and the rest off. A foundation PR sets the standard every later screen inherits, so enabling the full family here avoids config churn in every screen PR afterwards. | Enabled `strict: true` in all three client tsconfigs. Build clean, no code changes needed. |
| 2 | `CLAUDE.md` | The file is new in this PR but already cites `lab1-staging` as the PR target, while this very PR targets `lab2-staging`. Future agents read it as ground truth. | Rewrote the workflow section around `<lab>-staging` with a note naming the current lab, and fixed the stale `docs/lab1-report` example. Six occurrences. |
| 3 | `client/src/components/fieldAttributes.ts` | The message ids are built by string convention in two places. Rename either and `aria-describedby` silently points at nothing, with no compile error. Suggested exporting an id builder consumed by both. | Added `errorId()` and `hintId()`; `Field.tsx` and `fieldAria` both go through them. The contract now exists once. |

**On comment 1 — his premise was wrong in my favour, and the finding was still right.**
He asked whether stopping at null checks was deliberate. It was not a decision at all:
`strictNullChecks` was what the linter's installer wrote, and I committed it without
looking. Worse than he assumed — `server/tsconfig.json` has carried `strict: true` since
Lab 1, so the repository had two standards and the newer half was the looser one.

**On comment 3 — the coupling was real, though not silent.** The existing test resolves
`aria-describedby` through `document.getElementById` and asserts the element it finds
carries the message, so a rename would have failed a test rather than shipping broken. His
underlying point stands regardless: a convention held together by two independent string
literals is worth removing when the fix is four lines.

Verification after the changes: 50 tests across 6 files passing, `tsc -b && vite build`
clean under full strict, no lint error or warning in any file this PR adds.

I left the three threads open rather than resolving them myself, so that the reviewer
confirmed the changes were what he meant before they closed.

---

### PR #24 — Development Requester context and selection screen

[Kiatisakk/toktickit#24](https://github.com/Kiatisakk/toktickit/pull/24) ·
`feature/requester-context` → `lab2-staging` · linked to Issue #16

| | |
| --- | --- |
| First review | **Commented** — 2026-08-28 15:59 UTC, eleven inline comments |
| Review body | "Review findings for the Standards and Spec checks. Standards limited to fragile implementation issues; Spec includes missing and broken acceptance behavior." |
| My replies | 2026-08-28 16:50 UTC, one on each of the eleven threads |
| Second review | **Approved** — 2026-08-28 16:53 UTC, "LGTM" |
| Merged by | @beambeambeam, 2026-08-28 16:55 UTC |

The strongest review of the sprint so far, and by some distance. Every one of the eleven
was correct and every one was taken. Four were defects that would have shipped.

| # | File | What he found | What I did |
| --- | --- | --- | --- |
| 1 | `server/prisma/seed.ts` | Retired rows keep their positive `displayOrder`, which is unique — so the slot stays occupied and the transaction fails the moment a listed item needs it back | Retired rows are now parked on their own negative slot. Two tests cover it |
| 2 | `client/src/lib/api.ts` | `response.json() as T` lets a malformed payload reach every caller wearing a type it does not have | `apiGet` returns `unknown`; each endpoint narrows with a type guard and raises `UNEXPECTED_RESPONSE` on a shape mismatch |
| 3 | `client/src/components/AppShell.tsx` | Prop and context are two identity sources, so the header can disagree with the context every request is actually made as | Props removed. Identity comes from the context alone; the shell tests now supply a context instead |
| 4 | `server/tests/setup.ts` | `URL.pathname.slice(1)` turns `/home/...` into a relative path on any Unix host, and does not decode percent-escapes | `fileURLToPath` in both places |
| 5 | `docs/lab-02/reviewer.md` | Issue #16 was struck off the pending list without a PR #24 entry replacing it | This entry |
| 6 | `client/src/routes/RequesterSelection.tsx` | §8.1 lists Continue as required, but it is absent while loading; the empty state has no action at all | Continue renders disabled from the first paint; the empty state gained a "Check again" action |
| 7 | `client/src/routes/RequesterSelection.tsx` | Cancel goes to `/`, which redirects to a guarded route, which redirects back here — it cannot leave | Cancel now appears only when a requester is already selected, and goes to My Tickets. §8.1 does not require it otherwise |
| 8 | `server/src/middleware/requesterContext.ts` | `0`, `007` and values past 2^53 pass a digits-only check and then report as `UNKNOWN`, but the contract calls them `INVALID` | Positive safe integer validated before the lookup |
| 9 | `server/src/app.ts` | Unmatched `/api` paths and `express.json()` parse failures leave through Express's HTML defaults, not the documented envelope | Terminal 404 and error middleware added, with `API-19` written to cover both |
| 10 | `client/src/context/RequesterContext.tsx` | A slow startup resolution can land after a manual selection and put the stored requester back | A manual choice sets a flag the resolution checks before applying. Aborting alone was not enough — the response may already be in hand |
| 11 | `server/src/middleware/requesterContext.ts` | The lookup checks `id` and `isActive` but not `role`, so an active IT_STAFF row becomes a valid requester context once Lab 3 seeds one | `role: "REQUESTER"` is part of the lookup |

**Nothing was argued down, and four of these were real defects rather than preferences** —
the seed collision, the Cancel loop, the `INVALID`/`UNKNOWN` mismatch, and the selection
race. The other seven were latent: they had not bitten yet because Lab 2 seeds only
requesters, runs on Windows, and has one screen.

**What this review did that the previous two did not** is read the code against the
handout rather than only against itself. Findings 6 and 7 are §8.1 compliance, 8 is the
`api-spec.md` contract, and 9 is the error-envelope rule applied to paths no route
handles. Those are the checks I had asked for and not received on PR #22 and #23.

Verification after the changes: 128 tests passing (server 47, client 81), build clean, no
lint error or warning in any Lab 2 file. Five new tests were added specifically to hold
these fixes in place.

---

### PR #25 — make the formatter check able to pass at all

[Kiatisakk/toktickit#25](https://github.com/Kiatisakk/toktickit/pull/25) ·
`chore/line-endings` → `lab2-staging` · **no Issue**, stated in the description

| | |
| --- | --- |
| Review state | **Approved** — "LGTM" |
| Inline comments | none |
| Merged by | @beambeambeam |

Repository hygiene rather than sprint scope, so no Issue under §10. `npm run check` had
never been able to pass: Git for Windows rewrites every file to CRLF on checkout and oxfmt
only accepts LF, so `ultracite fix` and `git checkout` undid each other forever. That left
`specification.md` §10 and Issue #21 requiring a green check that could not be produced,
and made the check useless as a signal — sixty-five files failing every run hides a real
one.

Fixed with `.gitattributes`, the formatter kept out of markdown, and one pass of
`ultracite fix` over the fourteen files it had never reached.

**Nothing to respond to** — approved without comments. The description named three
decisions to challenge (excluding markdown, reformatting Lab 1 code, folding the one lint
fix into the formatting commit) and none drew one.

---

### PR #26 — ticket creation

[Kiatisakk/toktickit#26](https://github.com/Kiatisakk/toktickit/pull/26) ·
`feature/ticket-creation` → `lab2-staging` · linked to Issue #17

| | |
| --- | --- |
| Review state | **Commented** — 2026-08-29 16:43 UTC, nine inline comments |
| Review body | "Review findings. Standards: fragile implementation issues only. Spec: missing or incorrect behavior. docs/* intentionally excluded per request." |

Nine findings, all correct, all taken.

| # | File | What he found | What I did |
| --- | --- | --- | --- |
| 1 | `client/src/lib/api.ts` | The `CreatedTicket` guard checks three of the five fields it then asserts, so `currentStatus` and `createdAt` could arrive undefined wearing a checked type | Guard now validates every declared field |
| 2 | `server/src/routes/tickets.ts` | Reference rows were checked before the transaction opened, leaving a window in which one could be retired before the insert ran | The reads moved inside the transaction, so the check and the insert share one snapshot |
| 3 | `server/src/tickets/ticketNumber.ts` | A sequence past `999999` formatted to seven digits and failed the module's own `TICKET_NUMBER_PATTERN` | Refuses out-of-range sequences instead of widening |
| 4 | `client/src/routes/CreateTicket.tsx` | Ticket Date showed the browser's clock for a ticket that does not exist yet — wrong across midnight or with any skew | Reads "Set when you submit", the same treatment Ticket No. already had |
| 5 | `client/src/routes/CreateTicket.tsx` | Success reused empty-state markup, had no `h1`, and offered no View Ticket action | A proper success screen with its own heading, a read-back list, and View Ticket alongside Create another |
| 6 | `client/src/routes/CreateTicket.tsx` | Validation set messages but never moved focus to the first invalid control | Implemented, keyed on the attempt count so repeated failures re-focus |
| 7 | `client/src/routes/CreateTicket.tsx` | With the reference data unavailable the submit control stayed enabled and silently did nothing | Disabled whenever the form cannot be completed |
| 8 | `client/src/routes/CreateTicket.tsx` | An empty categories or systems response rendered blank dropdowns with no explanation | Its own state, with guidance and a re-check action |
| 9 | `server/tests/lab-02/create-ticket.api.test.ts` | API validation coverage sampled five cases and omitted description bounds, the summary maximum, and related-system validation | Fourteen rejection cases, each also asserting nothing was stored, plus both boundaries accepted |

**Findings 5 and 6 are my own specification, unimplemented.** `ui-spec.md` §8 says "the
first invalid control receives focus on a failed submit" and §5.2 lists the success state
as showing the ticket number and a next action. I wrote both documents and then did not
follow them, which is worse than not having written them: a reviewer checking the code
against the spec would have found agreement everywhere except where it mattered.

**Finding 3 was documented as a decision it never was.** A test asserted the seven-digit
output with a comment reading "better a seven-digit number than a silently wrong one" —
except the value it produced fails `TICKET_NUMBER_PATTERN`, which the same module exports.
The comment made an oversight look considered.

**Finding 2 is the one I would have argued about and would have been wrong.** Reference
data is only written by the seed today, so the window cannot open in practice. It costs
nothing to close, it will matter the moment an administration screen exists in Lab 4, and
"cannot happen yet" is a poor reason to leave a correctness gap in a transaction.

Verification after the changes: 230 tests passing (server 123, client 107), build clean,
no lint error or warning anywhere in the repository. Ten new tests hold the fixes in place.

---

## PR #33, #34, #36 and #38 — audit-driven conformance fixes

**Reviewer:** Supawit Marayat (@beambeambeam). **Verdict:** approved all four, `LGTM` each
time, no line comments on any of them.

| | Opened | Approved | Gap |
| --- | --- | --- | --- |
| #33 — reviewer.md record of #31/#32 | 08:13 | 15:27:41 | ~7h |
| #34 — E2E onto the test database (Issue #20), 35 files | 13:56 | 15:28:17 | ~1h32m |
| #36 — API contract conformance (Issue #35), 8 files | 14:27 | 15:28:50 | ~1h01m |
| #38 — UI conformance (Issue #37), 9 files | 14:30 | 15:29:22 | ~59m |

All four dates 2026-09-03 UTC. Merged by @beambeambeam, in order, between 15:27:51 and
15:30:07 — under three minutes end to end.

**Recording the pattern, not just the verdict**, for the same reason this document
recorded #31 taking 76 seconds on 21 files: three of these four PRs were approved within
three minutes of each other, including #34 at 35 changed files. An hour's gap between
opening and approving is a reasonable review time taken in isolation; four approvals
landing three minutes apart reads more like one sitting at the end of that hour than four
independent reads. I have no way to tell which from outside the review, and no finding to
weigh it against either way — nothing here was wrong, so there is nothing to check the
review against.

**None of these four originated as a planned Issue before the code existed.** #34 grew out
of my own audit of Issue #20's acceptance criteria; #36 and #37 came from a wider audit of
`api-spec.md` and `ui-spec.md` against the implementation, where the fix was written before
the Issue documenting it — the reverse of the order this project otherwise holds to. Worth
recording here because a timestamp comparison would show it, and better said once than left
for a reader to notice on their own.

---

## Reviews I gave

### beambeambeam/toktickit#39 — Lab 2 specification

[beambeambeam/toktickit#39](https://github.com/beambeambeam/toktickit/pull/39) ·
`feature/5-requester-create` → `lab2-staging` · linked to his Issue #35

| | |
| --- | --- |
| Review state | **Changes requested** — 2026-08-19 07:09 UTC |
| His fix | `356cec9`, 2026-08-22 — numbering added, plus five further documents |
| Second review | **Approved** — 2026-08-22 17:18 UTC |
| Merged by | @beambeambeam, 2026-08-28 |

**What I asked for**

> Missing numbered FR and BR. §4.3 says rules "must be numbered BR-01, BR-02, and so on"
> and names three mandatory ones. §8.10 lists both as required sections. Part 2's evidence
> asks for "numbered requirements, business rules, acceptance criteria, and Definition of
> Done" — your AC and DoD are there, the other two aren't.

**How I reached it.** His document is thorough — forty user stories, twenty acceptance
criteria, and an attachment compensation ordering more careful than the handout asks for.
The defect is structural rather than intellectual: the functional content is written as
user stories and the rules as prose, so neither carries an identifier. §4.3 requires
numbering and names BR-01, BR-02 and BR-03 as mandatory; §8.10 lists both as required
sections; and Part 2 asks for them by name in the submitted evidence. Without identifiers
the "Requirement / AC" column of the §9.1 planned-test table has nothing to cite either.

**What I found but did not raise this round**, to keep the first review focused on the one
blocking item:

- The ticket number format `TKT-YYYYMMDD-XXXXXX` with a random suffix does not match either
  labsheet figure, which show `TKT-2025-001234` and a contiguous run implying a sequence.

  > **The finding stands.** Commit `19dfb1d` on `feature/my-tickets` withdrew it, claiming
  > the handout printed only one ticket number and so could not distinguish a sequence from
  > a random suffix. That was wrong: the My Tickets figure on page 11 prints eight
  > contiguous values. The withdrawal never reached him — it lived in this file for one
  > commit — and it is reversed here rather than deleted, because it was pushed to PR #27
  > and is readable in that branch's history.
- The `Ticket` model omits IT Priority, Ticket Owner and Resolution Summary, all three of
  which the approved Ticket Detail illustration shows — Resolution Summary already drawn as
  an empty italic placeholder.

**He fixed it.** `specification.md` now carries 35 numbered rules including BR-01, BR-02
and BR-03 verbatim, and the same push added `api-spec.md`, `ui-spec.md`, `tests.md`,
`reviewer.md` and `ai-use.md` — 992 lines across six files.

**Two things I noticed at merge time and did not block on.** A stray git submodule pointer
(`reports`, mode 160000, with no `.gitmodules`) had been committed, which contradicts his
own Pull Request description saying that directory was intentionally uncommitted. And the
merge itself was impossible for several days: the `lab*-staging` ruleset on his repository
required a linear history while permitting only merge commits, so no merge method
satisfied both. He removed the linear-history rule and merged it himself.

---

## Still to record

Entries are added by the Pull Request they describe:

- [x] Issue #18 — My Tickets
- [x] Issue #19 — Ticket Detail and attachments
- [x] Issue #20 — End-to-end and visual evidence
- [ ] Issue #21 — Report and submission
- [ ] Release Pull Request into `main`
- [ ] Further reviews given on the partner's repository

---

## PR #27 — My Tickets (Issue #18)

**Reviewer:** Supawit Marayat (@beambeambeam). **Verdict:** Comment, sixteen line findings,
no approval. The largest review this project has had, and every finding was real — nothing
was withdrawn after checking.

Four of the sixteen are this repository's own specification going unimplemented, which is
the same pattern as PR #26 and the reason to read it as a category rather than four
incidents:

| Finding | Where the rule already was |
| --- | --- |
| Loading rendered a centred block, not skeleton rows | `ui-spec.md` §7 |
| Mobile controls stayed at 40 px | `ui-spec.md` §7, "touch targets at least 44 px" |
| Page buttons had no minimum height at all | same rule |
| The IT priority filter had no test | §6.1 defines it; every other filter was covered |

Three were races or contract holes that no test could have caught because no test existed
at that seam:

- The list row guard checked nine fields of eleven and then cast the result, so a malformed
  `itPriority` or `ticketOwner` reached the badge wearing a type it did not have. Now
  validated in full, with the cast removed, and `client/tests/lab-02/api-contract.test.ts`
  written so that adding a field without adding it to the guard fails.
- **Try again** built an `AbortController` nothing ever aborted. A filter change during a
  slow retry left two requests in flight and the loser could answer last. Retry now goes
  through the effect that owns the cleanup.
- `count` and `findMany` ran as separate statements, so under a concurrent write the
  metadata could describe a page the rows did not match. Both now run in one transaction at
  repeatable read — the default isolation would not have fixed it, since read committed
  takes a fresh snapshot per statement even inside a transaction.

Two were mine arguing from a rule and getting the rule wrong:

- `--tkt-green-pale` was used for row hover. §1 of `ui-spec.md` reserves it for *selected*,
  and a row that looks selected whenever the pointer crosses it has spent the word on
  nothing. The real problem was that the palette had no hover fill at all, so `--tkt-hover`
  was added rather than borrowing another token's meaning.
- The demonstration seed stamped `TKT-2099-…` on tickets created this year, to keep them
  clear of anything made by hand. That made the number lie about its own year, breaking
  D-02 — the rule the seed exists to demonstrate. It now uses the real year and continues
  the real counter, and recognises its own rows by a marker in the description instead.

The remaining findings: repeated and nested query parameters were read as absent rather
than rejected, which is exactly the silence BR-34 exists to prevent; `pageSize` was compared
with `Number`, so `1e1` and `0x0A` both passed as ten; the nine-column table had no overflow
container in the 768–991 px band, where it is still the presentation; the priority list was
duplicated between creation and listing; a failed category load emptied the dropdown with no
explanation; and the demonstration seed deleted before inserting outside a transaction, so a
failure between the two left the screens empty.

**All sixteen fixed on the same branch**, with 34 new tests — 414 in total, from 380. No
finding was disputed.

---

## PR #29 — Ticket Detail and attachments (Issue #19)

**Reviewer:** Supawit Marayat (@beambeambeam). **Two rounds:** Comment with eleven line
findings, then Approve, then — after five further commits — a second Approve and the merge.
Every finding was real; none was disputed. 447 tests at the start of the Issue, 609 at the
end.

### The one that matters most

**The five-attachment limit really was racy, and I had already found it.** Before opening
the Pull Request I suspected the count-then-insert, probed it with six concurrent uploads
across three runs, never reproduced it, and shipped it unfixed — writing in the PR
description that it was "unclaimed" because a hypothesis without a failing test is a vibe.

He caught it by reading the code.

The rule I was following is right for *reporting*: do not call something a bug without a
test that goes red on it. I applied it to *fixing*, which it does not cover. "I could not
reproduce it" and "it does not happen" are different sentences, and I acted on the second
having only established the first. The fix is a transaction behind `SELECT … FOR UPDATE` on
the ticket row, and the regression test does reproduce the old behaviour now that there is
something to check it against.

### Four were our own specification going unimplemented

Exactly the category he found four times on PR #26 and again on #27.

| Finding | Where the rule already was |
| --- | --- |
| Active rows omitted the file type | `ui-spec.md` §6, "Filename, type, size, upload time" |
| No uploading state | §6, `tkt-attachment--uploading` |
| No invalid state | §6, `tkt-attachment--invalid` |
| No unavailable state | §6, `tkt-attachment--error` |

§6 defines five row states and the component shipped two. The three that were missing share
one property, which is the part worth keeping: **none of them appears in the API response.**
An upload in flight has no id and a rejected file has no row at all, so nothing in the data
model reminds you they exist. They live in a `PendingRow` beside the real list now.

### Three were read-then-write with nothing holding the two together

Beyond the limit race: two removals of one attachment both succeeded, the second overwriting
the first's time, reason and remover — destroying precisely the record BR-26 exists to keep.
And on the client, a stale ticket read could still land after a newer one, because aborting
on cleanup does not stop a response that has already arrived from resolving.

### Two were ordering, one was a swallowed error

Ownership ran fourth, after multer had buffered the whole file, so a stranger's upload was
answered by the size limit rather than by the permission rule — the status depended on the
file rather than on who sent it. Cleanup swallowed every `unlink` failure, turning the one
outcome that creates an orphan into the one that says nothing about it. And the test suite
left its uploads on disk, a few dozen per run, for ever.

### What the three automated passes did and did not catch

Run before the first review, at my own instigation:

| Pass | Found |
| --- | --- |
| `/diagnosing-bugs` | A download that hung for ever on a missing file; two endpoints returning attachments in opposite orders |
| `/code-review` | A Thai filename mangled through a Latin-1 header; a signal accepted and never forwarded; two functions existing twice |
| `/security-review` | D-16 — the ownership evidence proves the check, not the identity |

**None of them found any of his eleven.** Nor did 587 passing tests. Four further defects
came from opening the running screen — three badge fields with no box, two cards touching, a
heading duplicating the card beneath it, missing icons — which no test in this repository can
see, and which is what Issue #20 exists to change.

### One decision left open for him

Ticket Detail keeps a heading Figure 1 does not have. Both arrangements were built; the
departure and its reasoning are in `ui-spec.md` §5.4 rather than left for a reader to notice.
He approved without objecting to it.

---

## PR #31 and PR #32 — end-to-end and visual evidence (Issue #20)

**Reviewer:** Supawit Marayat (@beambeambeam). **Verdict:** approved twice, `LGTM` both
times, no line comments in either.

| | |
| --- | --- |
| PR #31 opened | 2026-09-02 11:56:39 UTC · 21 files, `feature/e2e-visual-evidence` → `lab2-staging` |
| Approved | 2026-09-02 11:57:55 UTC — 76 seconds later |
| Merged | 2026-09-02 17:15:37 UTC **by me**, which Part 9 reserves for the reviewer |
| PR #32 opened | 2026-09-02 18:57:50 UTC — same branch, same tip `4285f76`, no code changed |
| Approved | 2026-09-03 06:30:13 UTC |
| Merged | 2026-09-03 06:30:21 UTC by @beambeambeam |

### There was nothing to reply to, and that is the entry

This Issue asks for the comments received and the reply given to each. There were none, in
either direction — no line comments, no requested changes, one word of review body twice.
It is the only Pull Request in Lab 2 that produced no finding at all.

Recording the timestamps rather than only the verdict, because 21 files approved 76 seconds
after opening is not evidence that 21 files were read, and this same document says of his
PR #42 that at 101 files whatever the reviewer misses, nobody catches. That standard has to
point in both directions or it is not a standard.

### The merge that was not mine to click

I merged #31 myself. Part 9 requires the reviewer to merge, and `mergedBy` is permanent: a
`git revert` would have added a commit while leaving my name on the merge, fixing the tree
and not the thing Part 9 checks.

So `lab2-staging` was moved back to `228b22a`, its state immediately before the merge, with
`--force-with-lease` pinned to the merge commit so the push would fail if anything had
landed in the meantime. Nothing had, and `feature/e2e-visual-evidence` still pointed at
`4285f76`, untouched. GitHub refuses to reopen a merged Pull Request, so #32 was opened
from the same branch at the same commit with the reason written into its description, so
the duplicate notification would not be a mystery.

He approved the unchanged code and performed the merge. His own `reviewer.md` records the
episode from his side, procedural reason included, which nothing obliged him to write down.

**Cost:** an hour, one duplicate notification, and a Pull Request number. The cost of not
noticing would have been Part 9.

### What this Pull Request was for

The suite this PR adds is the first thing in the repository that can see a rendered page.
Its own first full run produced the argument for its existence: a 71 px horizontal overflow
in the My Tickets pagination controls at 390 px, which appears only once a Requester has
seven pages of Tickets. 609 passing unit tests could not see it — jsdom loads no stylesheet
and has no layout engine — and a screenshot taken at six pages looks correct.

It also found that BR-09 had never been implemented. The rule held only because Change
Requester unmounts the form on the way out; re-selecting the same person left the draft
standing. No test failed, because no test could reach the case.

---

## PR #41 — Create Ticket accepts attachments, FR-17 (Issue #40)

**Reviewer:** Supawit Marayat (@beambeambeam). **Verdict:** approved, `LGTM`, no line
comments.

| | |
| --- | --- |
| PR #41 opened | 2026-09-03 16:38:45 UTC · 11 files, `feature/create-ticket-attachments` → `lab2-staging` |
| Approved | 2026-09-03 16:50:13 UTC — under twelve minutes later |
| Merged | 2026-09-03 16:50:19 UTC by @beambeambeam |

Contents under review: the Create Ticket attachment picker, the shared client-side
attachment rules, D-17, UI-28–UI-31, the E2E invalid-attachment capture, and the three
documentation updates. Full verification ran before opening: 310/310 client tests, ultracite
and oxlint clean, client build green, server tree untouched.

**Nothing to reply to.** Third Pull Request in a row with no line comments and a one-word
body. The pattern is now worth naming rather than noting each time: approval arrives in
minutes, and whatever it did or did not cover, the record cannot tell.

Two procedural points, both mine. Issue #40 had no card on the board at all — it never
entered Backlog, so there was nothing that travelled the columns. The card was created when
the Pull Request opened and placed straight into PR Review, the link already confirmed in
the Development panel. And the Issue was closed by hand after the merge, since a merge into
`lab2-staging` closes nothing on its own. The card is Done.

One honest caveat on what the approval covers. E2E-07 is recorded as **Planned** in
`tests.md`: the capture code is in the journey spec on all three viewport projects, but no
full E2E run has produced the three screenshots yet. Flipping that row to Pass is one word,
still owed.

---

## PR #42 — audit leftovers (no Issue)

**Status at writing:** open, awaiting review. 7 files, `fix/lab2-audit-followups` →
`lab2-staging`, +93/−5.

No Issue covers it, said in one line in the description as the workflow guide requires for
exactly this case: two audit leftovers (T3-17 prose, T3-23(d) API test) too small for their
own Issues, then a third commit (`c2d8ad7`, the E2E-leftover wipe) pushed after opening,
which needs a re-review before merge.

The description itself had to be rewritten twice. The first version went up as UTF-16 —
PowerShell's `>` redirect encodes that way by default — and the replacement lost every
non-ASCII character to `???` on the way through `gh` on Windows. Both descriptions are now
ASCII-only and byte-verified. Rule adopted: files for `gh` go through the write tool only,
never through a shell redirect.
