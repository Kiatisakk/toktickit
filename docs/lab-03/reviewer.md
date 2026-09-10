# Lab 3 Peer Review Record

Every Pull Request of Sprint 3, in both directions: the reviews received on this repository, and the reviews given on the peer's. Written as each review happens rather than reconstructed afterwards — Lab 1 was reconstructed at the end, which was slow and silently missed two Pull Requests.

## Identities

| | |
| --- | --- |
| Author | Kiatisak Markmeeshap · 67070501005 · [@Kiatisakk](https://github.com/Kiatisakk) |
| Peer reviewer | Supawit Marayat · [@beambeambeam](https://github.com/beambeambeam) |
| This repository | [Kiatisakk/toktickit](https://github.com/Kiatisakk/toktickit) |
| Reviewed repository | [beambeambeam/toktickit](https://github.com/beambeambeam/toktickit) |

---

## Reviews I received

### PR #56 — Sprint 3 engineering contract (Issue #45)

[PR #56](https://github.com/Kiatisakk/toktickit/pull/56) · reviewed 2026-09-09 · **12 line comments**, verdict **Changes requested**, then **Approved** and merged into `lab3-staging` by @beambeambeam.

Twelve findings on four contract documents, marked by severity — six as defects, six as risks. Every one was real. They fell into three groups.

**Two contradicted the handout.** IT Priority was specified as initially unset, but §4.5 requires it to copy Requested Priority at creation. And §8.5 names invalid role values as something to prevent, which the user edit endpoint defined no response for.

**Three contradicted our own Lab 2 code.** The ticket list was documented as returning `items`/`page`/`total` while Lab 2 returns `data` and `meta` with `totalItems` — which BR-40 of the same document promised would not change. Attachment upload was still scoped "Staff: any" while the authorization matrix said own-only. And the Lab 2 suites were claimed to pass unchanged, which cannot be true once the status is renamed, the selector is removed and reference data needs a session.

**Two would have failed at implementation rather than at review**, and these were the most valuable. A `NOT NULL` password hash cannot be added to populated rows in one step, and SQL cannot derive a `scrypt` hash in any case because the hashing lives in Node. And the client and API are different origins in development, so the session cookie would never have travelled without `credentials: "include"` and matching CORS headers — a failure that looks like a broken login rather than a missing header.

The remaining five were undefined behaviour rather than wrong behaviour: staff `PATCH` endpoints with no success shape, comments and notes with no response shapes or missing-ticket failure, a password reset defining only its success path, a `403` described as having no body in a document that admits no exception to the error envelope, and a queue listing nine columns with no action to open a ticket.

**My response.** All twelve fixed in `4854b95`, with a reply on each thread naming the commit and what changed. Six new tests cover the behaviours the fixes introduced, including that staff can download but not write another requester's attachments, and that no account survives the migration with a null hash. @beambeambeam replied "Verified in 4854b95" on each of the twelve, then approved.

**What I take from it.** The attachment finding is the one worth remembering: the row he caught was left behind by *my own* fix for that same contradiction, in the commit whose message said it was correcting it. Fixing a finding in one file and leaving a contradicting row in another is a failure mode I now check for deliberately, including when reviewing his work.

### PR #57 — Client test fixtures and workflow rules (Issue #46)

[PR #57](https://github.com/Kiatisakk/toktickit/pull/57) · reviewed 2026-09-10 · **1 finding**, verdict **Comment**, then **Approved** and merged into `lab3-staging` as `285c613` by @beambeambeam.

He challenged a claim in `CLAUDE.md` that GitHub exposes no API for linking a Pull Request to its Issue, and named `addCloseIssueReferences`.

He was right. I verified it by running it rather than by re-reading the schema: linking Issue #47 to PR #57 moved `closingIssuesReferences` from `[46]` to `[46, 47]`, and `removeCloseIssueReferences` put it back.

The claim came from searching the mutation list for `link|closing|subissue`. The mutation is spelled `Close`, not `closing`, so the search could never have matched — and I recorded the empty result as a fact about GitHub rather than a fact about my search. It also hangs off the Issue rather than the Pull Request, so looking from the PR side was never going to find it.

Fixed in `c546262`. I took his intent rather than his suggested wording, and said so: once the mutation is written into the rule, hedging about "no one-step PR-only API" explains less than showing the call. He also noted the fixture consolidation as mechanical and low risk.

**What the review found that the finding did not say.** Reviewing the rules is what exposed that they were not being followed. `docs/lab-03/` held four of the six files §12 asks for; this file and `ai-use.md` did not exist, five Pull Requests into the sprint — and the rule requiring them had been added by this very branch, three commits earlier. Both were written in `8592bae` and backfilled from `gh api` rather than from notes, which is the reconstruction the rule exists to prevent. `CLAUDE.md` gained the half of the rule that was missing: the two files are created in the first Pull Request that targets a new `<lab>-staging`.

He approved with `LGTM` at 15:47:23Z and merged eleven seconds later. Issue #46 was closed by hand, because the base is not the default branch.

---

## Reviews I gave

### beambeambeam#59 — Sprint 3 engineering contract (his Issue #49)

[PR #59](https://github.com/beambeambeam/toktickit/pull/59) · reviewed 2026-09-09 · **3 line comments**, verdict **Changes requested**, then **Approved**; I merged it, since the workflow puts the merge with the approver.

His bookkeeping was clean and I checked it with a script rather than by eye: 15 functional requirements, 25 business rules, 28 acceptance criteria with no gaps or duplicates, every criterion referenced in his test plan, no identifier cited anywhere without a definition, and a ticket-number format matching his own Lab 2 specification.

**One defect.** His BR-24 makes seeds non-destructive and explicitly says reruns do not reset credentials, while E2E-01 is `Initial login/change` — a test that consumes the password-change flag it depends on. The first run passes; every run afterwards has nothing to assert against. I gave three ways out and said which I would not pick: carving a test-shaped exception into a deliberately non-destructive seed would undermine the rule everywhere else.

**Two departures from the handout that were not recorded as decisions.** BR-01 folded inactive accounts into the generic sign-in failure, while §8.1 asks for a clear response for inactive accounts. And BR-07 replaced the four composition rules the §8.1 illustration spells out with a 15-character floor.

I said plainly that BR-07 is the better rule — composition requirements are what NIST moved away from, and accepting spaces and paste is what makes a passphrase usable. The risk was never security; it was that the illustrated panel is the most concrete statement the handout makes about that screen, and his §11 already resolved a different ambiguity in exactly the way this one needed.

**His response.** All three fixed, and fixed at the source rather than only downstream: BR-01 itself gained the ordered check, so the rule and the API agreed instead of the API silently overriding a rule that still said the opposite. Consistent across all five documents. He adopted the ordered-verification approach I suggested — verify the password first, reveal `ACCOUNT_INACTIVE` only after it matches — and added "neither response creates a session", which I had not asked for. E2E-01 now provisions its own account **and** gets a disposable database per run, where either alone would have closed it, and BR-24 stayed intact.

### beambeambeam#60 — Authenticated Requester workflow (his Issue #50)

[PR #60](https://github.com/beambeambeam/toktickit/pull/60) · reviewed 2026-09-10 · **5 line comments plus one general comment**, verdict **Changes requested**, then **Approved**; I merged it.

83 files, +5159/−1450 — the whole authentication implementation. I read the auth surface rather than the diff alone and verified every finding against the code before writing it.

**The design was stronger than my own specification in three places**, and I said so: a dummy Argon2 hash so an unknown account costs the same work as a real one, which closes a timing oracle I had not considered; `passwordHash` in the `where` clause of the password swap, so a concurrent change cannot be clobbered; and optimistic version checks on the operational mutations.

**Four findings, of which two shared one root cause.** `trust proxy` was never set, and two separate protections depended on it: the session cookie was issued without `Secure` behind any TLS-terminating proxy, and `request.ip` collapsed every caller into a single rate-limit bucket. The second was amplified because the validation paths reserved a rate-limit attempt and never released it — thirty malformed requests could lock out the whole user base without touching Argon2.

**One would have stranded a first-login user.** `changePassword` reserved against the login limiter's keys and did not release on a wrong current password, so five mistypes locked the account out of *signing in* — worst for someone on a short restricted session with no other route back. The client had no `429` handling on that screen either.

**One was about evidence.** The Lab 2 end-to-end spec had been retargeted to write its manifest into `artifacts/lab-03/`, overwriting the three committed authentication manifests, while the Lab 3 spec took no screenshots at all. The graded artifacts existed in the repository and nothing in the repository produced them.

**One general comment**, because the file was not in the diff: `docs/lab-03/tests.md` still read `Planned` on every row while the tests it predicted now existed at the paths it named.

**His response.** All six fixed, and two fixed better than asked. `cookieSecure` no longer reads the request at all — it derives from configuration, so `trust proxy` became a second line of defence rather than the only one. And the reservation release went into a `finally` rather than onto the single path I named, which closed the paths I had not named. The evidence now reproduces: the Lab 3 spec takes its own screenshots and writes its own manifest. `tests.md` was renamed from a plan to a register, implemented rows carry real coverage, and the rows still reading `Planned` are the slices that genuinely are.

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [#56](https://github.com/Kiatisakk/toktickit/pull/56) | received | 12 | Changes requested → Approved | Merged |
| [#57](https://github.com/Kiatisakk/toktickit/pull/57) | received | 1 | Comment → Approved | Merged |
| [beambeambeam#59](https://github.com/beambeambeam/toktickit/pull/59) | given | 3 | Changes requested → Approved | Merged |
| [beambeambeam#60](https://github.com/beambeambeam/toktickit/pull/60) | given | 6 | Changes requested → Approved | Merged |

Checked by listing the Pull Requests from GitHub and searching this file for each number, rather than by reading down the page — which is how two were found missing in Lab 2.

No Pull Request past #57 is open in this repository yet. This file is updated by the Pull Request that receives or gives the review, not at the end of the sprint.
