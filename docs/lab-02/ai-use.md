# Lab 2 AI Use

A living document. Prompts are recorded in the Pull Request that used them, not
reconstructed at the end of the sprint from memory.

## 1. Which AI I used

**Claude Code** in the terminal, with access to the repository and to the `gh` command line
tool. Mostly **Claude Opus 5**, with **Claude Sonnet 5** on some of the later sessions —
126 commits on `lab2-staging` carry an Opus 5 co-author trailer and 9 carry Sonnet 5.

**Muse Spark 1.3** finished Issue #40 after the Claude sub-agent working on it hit a
session rate limit mid-run, taking over the same git worktree and the same brief. Its two
commits (`6e485d0`, `a68e7ac`) carry a Claude Sonnet 5 trailer regardless, because the
brief specified that trailer verbatim and the brief was what it continued from. So the
history under-reports on exactly those two commits, and this paragraph is the correction —
counting trailers is a good check on a claim like the one above it, but not a complete one.

Sonnet was also the model given the parallel sub-agent work — the API-conformance and
UI-conformance fixes of Issues #35 and #37 were each handed to one, in its own git
worktree, so the two could not edit the same file at the same time.

**Antigravity CLI (Gemini 3.8 Flash)** ran the post-sprint conformance audit across five
dimensions, with five parallel research sub-agents (S7–S11 below). Its report is not
committed — it was working material, and what came out of it is here instead: the findings
it raised were each verified against the source before anything was changed, and
[`ai-use-log.md`](./ai-use-log.md) records which ones held and which did not.

It was used as a specification agent first and a coding agent second, in the order §11 of
the labsheet sets out: the engineering contract was written, reviewed and merged before any
implementation began.

## 2. Selected key prompts

Ten, the top of the six-to-ten §14 Part 4 allows. Chosen on one test: did the prompt change
what got built, or teach something that changed how the rest of the sprint was worked. Every
one either found a defect, prevented one, or overturned something the AI or I believed.

Eight are mine and two are briefs the main agent wrote to a sub-agent, marked `S`. They are
in here because Part 4 asks for the key prompts rather than only the ones I typed, and
because those two demonstrably changed an outcome — one prevented a defect the specification
had already warned about, and the other produced a real finding and a false one from the same
paragraph. The rest of both sets, and the sprint's process and review-etiquette prompts, are
in [`ai-use-log.md`](./ai-use-log.md).

Numbers match the log, so each can be read in context.

| Log # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 17 | *"มีหน้า 11 ไงแล้วทำไม col Ticket Owner หายไปด้วย"*<br>"There *is* a page 11 — so why is the Ticket Owner column missing?" | Caught the AI asserting a labsheet figure did not exist. It had listed the pages carrying images, opened three, and not the fourth. The figure was on page 11, the column was real, and a finding already sent to the peer reviewer had been withdrawn on the strength of the mistake. It was reinstated. "I looked" and "I looked at the right thing" are different claims. | #18 |
| 18 | *"งงแล้วเทสผ่านได้ไงแอบโกงหรือป่าว"*<br>"I'm confused — how did the tests pass? Are you cheating?" | Refused a green suite as an answer. The tests were honest, but every mock in `MyTickets.test.tsx` returned two tickets, so `totalPages` was always 1 and no test on the screen ever rendered the page controls at all. The coverage was real; the confidence it produced was not. | #18 |
| 19 | *"มันอยู่ใน Scope ที่แลปให้ทำไหมนะ"*<br>"Is that even in the scope the lab asks for?" | Asked after three fields had already been added to Create Ticket by copying Figure 1. Three of the five did not belong: IT Priority, Ticket Owner and Resolution Summary are set by work §4.2 excludes, so on a creation form they would be permanently empty boxes. A figure shows what a screen looks like, not what this sprint may build. | #19 |
| 20 | *"ก่อน code-review อยากให้ /diagnosing-bugs แล้วก็ implement แก้ต่อเลย"*<br>"Before the code review, run /diagnosing-bugs and fix what it finds." | Ordered a pipeline instead of accepting "the tests pass". Its rule — no hypothesis without a loop that goes red — turned three suspicions into two confirmed defects and one left unfixed *and unclaimed*, because six concurrent uploads across three runs never reproduced it. Reporting an unreproducible bug as fixed is worse than reporting nothing. | #19 |
| 21 | *"ชั้นพร้อม issue 20 แล้ว"*<br>"I'm ready for Issue 20." | Started the Issue that exists because of everything before it. Playwright is the only suite here that runs the real application, and on its first full run it found a §8.7 violation six hundred unit tests and a screenshot review had both missed: a pagination row that could not wrap and ran 71px past a mobile viewport — but only once a Requester had seven pages of tickets. | #20 |
| 27 | *"ทำต่อเลย"*<br>"Keep going." | Two words that met the plan's first refusal. The plan's next step was a `db:test:seed:demo`, and PR #34 had already tried exactly that and reverted it in `c2b40ea` — the demo seed left tickets and IT Staff rows in the shared test database and broke four server assertions. Following the plan would have reintroduced the defect the plan had forgotten. A plan records what was believed when it was written. | #21 |
| 33 | *(no prompt — the E2E run came back with one red test)* | The tablet run failed `expectNoHorizontalScroll` for the second day running, having been written off as a data-dependent flake the first time. Treated as a pattern instead: a throwaway probe measured the page rather than reasoning about the CSS, and gave `position: static` 344px of page overflow against 0 for `position: relative`. `overflow` does not clip an absolutely positioned descendant unless the scrolling box is that descendant's containing block, so the screen-reader-only spans in the last two columns were escaping it. Twice is not a flake. | #21 |
| 35 | *(the tests.md traceability audit)* | Two attempts, and the first was worse than what it replaced. Generating the acceptance-criterion matrix from both documents deleted judgement the existing rows encoded — `E2E-01` is cited against three criteria that no column in its row declares, because the full journey genuinely exercises them. The second attempt only added. Generated mappings are good at finding what is missing and bad at deciding what belongs. | #21 |
| S5 | **Implement Issue #37 — UI conformance.** Eleven fixes, with an explicit instruction *not* to write `44px` into four separate rules but to wire the four controls to the shared token, "because that is the failure `ui-spec.md` itself warns about one sentence later". | The specification had already recorded how the same bug happened once — page buttons at 36px while the table said 44 — and the obvious fix would have repeated it, four rules each remembering the number separately. Putting the warning into the brief is what made the difference between a fix and the same fix again. It came back with 296 tests passing and a reasoned answer on the one question left open rather than a silent choice. | #37 |
| S11 | **Database and seed auditor.** Audit the Prisma schema, both seeds and the ticket-number generator against `specification.md` — ticket-number rules BR-01, BR-04 and D-02, year alignment, transaction safety, and "demo data distribution across requesters (25/6/0/3)". | Found the real defect: `raisedAt = today - sequence` inverted the seed's dates, so the highest ticket number carried the oldest timestamp and the default sort listed numbers climbing the page — a direct violation of D-02. It also reported a distribution mismatch, which was false: the 25/6/0/3 came from the brief, not from `specification.md`, which never states a distribution at all. The brief handed the agent a premise and got it back as a finding. Both arrived with equal confidence and only one survived checking. | #35 |

## 2b. The full log, and the sub-agent briefs

Both live in [`ai-use-log.md`](./ai-use-log.md): every prompt I typed, numbered 1 to 41 with
the ten above among them, and the eleven briefs the main agent wrote to its own sub-agents.

They are a separate file rather than a deleted one. §14 asks for a concise PDF and this
section had grown to three quarters of a document worth five marks, but a prompt cannot be
recovered accurately once the session is over, and the repository is the source of truth the
labsheet names.


## 3. My reflection

> **To be written by me before Issue #21 closes.** §14 Part 4 asks for a brief personal
> reflection on the AI-use experience. It has to be in my own words, so it is deliberately
> left blank rather than generated — the AI cannot write my opinion of working with it.
>
> Points worth reflecting on, from what actually happened:
> - Being interrogated for four rounds before any code existed, and whether thirty settled
>   decisions up front was worth the delay.
> - That seven of my eight selected prompts are me overruling or questioning the AI, and
>   that the results were better each time.
> - What it means that the AI drafted a review of a classmate's work but I decided what to
>   send.
> - That the peer reviewer found things the AI's own tests did not — thirty-nine findings
>   across five Pull Requests, several of them the AI's own specification going
>   unimplemented.
> - That opening the application found three defects in one session that six hundred tests
>   could not, and what that says about what a passing suite is evidence of — and then that
>   the browser suite built to close that gap found a fourth on its first run.
> - That two rows left marked `Planned` in tests.md turned out to be a rule never
>   implemented (BR-09) and a rule never provable (BR-30), and that the honest column was
>   what surfaced both.
> - That the AI twice stated a labsheet figure did not exist, having listed the pages that
>   carried images and then not opened the one that mattered — and that a review comment to
>   a classmate was withdrawn on the strength of it before being reinstated.
