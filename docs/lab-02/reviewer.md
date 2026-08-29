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

- [ ] Issue #18 — My Tickets
- [ ] Issue #19 — Ticket Detail and attachments
- [ ] Issue #20 — End-to-end and visual evidence
- [ ] Issue #21 — Report and submission
- [ ] Release Pull Request into `main`
- [ ] Further reviews given on the partner's repository
