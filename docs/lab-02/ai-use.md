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

Ten, the top of the six-to-ten §14 Part 4 allows, and every one of them is something
somebody actually typed. Two rules decided the table. A row has to be a prompt, not an
episode — an earlier draft had two entries reading "(no prompt)", which is not a prompt
however interesting the thing that followed it was. And the row has to credit the prompt for
something the prompt caused; "keep going" is not the reason the next check found anything.

Eight are mine, two are briefs the main agent wrote to a sub-agent, marked `S`. Part 4 asks
for the key prompts rather than only the ones I typed, and those two changed an outcome:
one prevented a defect the specification had already warned about, and one produced a real
finding and a false one from the same paragraph.

The rest — including the sprint's process and review-etiquette prompts — are in
[`ai-use-log.md`](./ai-use-log.md), numbered so each row here can be read in context.

| Log # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 16 | *"ทำไมหน้า My Ticket ไม่มี Table"*<br>"Why is there no table on the My Tickets page?" | Opened the running application, which no test in this repository can do. The table had no background and was invisible against the page — the first of three defects found in one session by looking, while six hundred tests stayed green throughout. | #18 |
| 17 | *"มีหน้า 11 ไงแล้วทำไม col Ticket Owner หายไปด้วย"*<br>"There *is* a page 11 — so why is the Ticket Owner column missing?" | Caught the AI asserting a labsheet figure did not exist. It had listed the pages carrying images, opened three, and not the fourth. The figure was on page 11, the column was real, and a finding already sent to the peer reviewer had been withdrawn on the strength of the mistake. It was reinstated. "I looked" and "I looked at the right thing" are different claims. | #18 |
| 18 | *"งงแล้วเทสผ่านได้ไงแอบโกงหรือป่าว"*<br>"I'm confused — how did the tests pass? Are you cheating?" | Refused a green suite as an answer. The tests were honest, but every mock in `MyTickets.test.tsx` returned two tickets, so `totalPages` was always 1 and no test on the screen ever rendered the page controls at all. The coverage was real; the confidence it produced was not. | #18 |
| 19 | *"มันอยู่ใน Scope ที่แลปให้ทำไหมนะ"*<br>"Is that even in the scope the lab asks for?" | Asked after three fields had already been added to Create Ticket by copying Figure 1. Three of the five did not belong: IT Priority, Ticket Owner and Resolution Summary are set by work §4.2 excludes, so on a creation form they would be permanently empty boxes. A figure shows what a screen looks like, not what this sprint may build. | #19 |
| 20 | *"ก่อน code-review อยากให้ /diagnosing-bugs แล้วก็ implement แก้ต่อเลย"*<br>"Before the code review, run /diagnosing-bugs and fix what it finds." | Ordered a pipeline instead of accepting "the tests pass". Its rule — no hypothesis without a loop that goes red — turned three suspicions into two confirmed defects and one left unfixed *and unclaimed*, because six concurrent uploads across three runs never reproduced it. Reporting an unreproducible bug as fixed is worse than reporting nothing. | #19 |
| 32 | *"ปิดให้แล้ว รัน E2E เลย"*<br>"I've closed them — run the E2E now." | Two consequences from one instruction. The suite could only run because the dev servers had been stopped by hand: `playwright.config.ts` refuses to reuse a server it did not start, and the AI had asked rather than killing processes that turned out to be the author's. And the run it unblocked came back red on tablet for the second day running, after the first failure had been written off as a data-dependent flake. Treated as a pattern this time: a throwaway probe measured the page instead of reasoning about the CSS and gave `position: static` 344px of page overflow against 0 for `position: relative`. `overflow` does not clip an absolutely positioned descendant unless the scrolling box is that descendant's containing block. Twice is not a flake. | #21 |
| 34 | *"แล้วไอ T3-18 - T3-22 นี่ต้องแก้ไหมนะ"*<br>"Do T3-18 through T3-22 actually need fixing?" | Asked for a judgement rather than execution and got one: only the traceability gap had marks attached, and the duplicate identifier had to be fixed before it, because a matrix cannot cite `UI-14` unambiguously while two tests share it. The audit that followed then made its own mistake worth keeping — generating the matrix from both documents produced something *worse* than what it replaced, because it deleted judgement the rows encoded. Generated mappings find what is missing and are poor at deciding what belongs. | #21 |
| 37 | *"มี doc อะไรที่ต้องอัพเดทอีกมั้ย"*<br>"Any other docs that need updating?" | Found three at the point where fixing them was still cheap: `ui-spec.md` §10 named a screenshot set that differed from the files on disk in four ways, `ai-use.md` had stopped logging eight prompts earlier, and `README.md` still described the repository as holding Lab 1. No test in this repository can fail because a document has stopped being true. | #21 |
| S5 | **Implement Issue #37 — UI conformance.** Eleven fixes, with an explicit instruction *not* to write `44px` into four separate rules but to wire the four controls to the shared token, "because that is the failure `ui-spec.md` itself warns about one sentence later". | The specification had already recorded how this bug happened once — page buttons left at 36px while the table said 44 — and the obvious fix would have repeated it exactly, four rules each remembering the number separately. Quoting the warning into the brief is the difference between a fix and the same fix again. | #37 |
| S11 | **Database and seed auditor.** Audit the Prisma schema, both seeds and the ticket-number generator against `specification.md` — ticket-number rules BR-01, BR-04 and D-02, year alignment, transaction safety, and "demo data distribution across requesters (25/6/0/3)". | Found the real defect: `raisedAt = today - sequence` inverted the seed's dates, so the highest ticket number carried the oldest timestamp and the default sort listed the numbers climbing the page, against D-02. It also reported a distribution mismatch, which was false — the 25/6/0/3 came from the brief, not from `specification.md`, which states no distribution at all. The agent handed back its own premise as a finding, with the same confidence as the true one. | #35 |

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
