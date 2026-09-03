# Lab 2 AI Use

A living document. Prompts are recorded in the Pull Request that used them, not
reconstructed at the end of the sprint from memory.

## 1. Which AI I used

**Claude Code** running **Claude Opus 5**, in the terminal, with access to the repository
and to the `gh` command line tool.

It was used as a specification agent first and a coding agent second, in the order §11 of
the labsheet sets out: the engineering contract was written, reviewed and merged before any
implementation began.

## 2. Selected key prompts

The eight below are the ones that **changed what happened**, rather than asking for work
that was going to be done anyway. Seven of the eight are me overruling, narrowing or
questioning the AI's own proposal.

The full log follows in §2b — nothing has been discarded, only sorted.

| # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 1 | `/grill-with-docs @material/UTF-8_Lab_02_labsheet-1.pdf read instruction in this lab2` | Asked to be interrogated rather than given a plan. Four rounds and thirty settled decisions before a line of anything was written. | #14 |
| 2 | *"9 ทำอัน 2 ก่อนได้ไหมค่อยทำ tooling รวมกับพวก feature"*<br>"For question 9 — can we do item 2 first, then fold the tooling in with the features?" | Reordered the sprint so the specification became the first Pull Request into `lab2-staging`. The commit graph now proves the specification preceded the code, which is what Part 2 asks for. The AI's ordering put tooling first and would have made that evidence weaker. | #14 |
| 3 | *"Lab 2 report and submission evidence คืออยากให้ทำและอัพเดทเรื่อย ๆ"*<br>"Lab 2 report and submission evidence — I want this done and updated continuously." | Changed the shape of the whole sprint. `reviewer.md`, `ai-use.md` and `tests.md` became living documents updated by every Pull Request, and the final Issue became an audit rather than a writing exercise. | #15 |
| 4 | *"รอบีมตรวจ pr 23 ก่อนค่อยทำอะไรก็ตาม"*<br>"Wait for Beam to review PR 23 before doing anything at all." | Stopped work rather than starting the next Issue in parallel. That Issue created the `User` table, which locks a naming decision the reviewer had not yet commented on — building it first would have meant a migration to undo. | #15 |
| 5 | *"แล้ว 5 อันที่นายจงใจทำไว้แก้ยังนะ"*<br>"What about the five things you deliberately flagged for him to challenge?" | Checked whether the review had engaged with the flagged decisions. It had not — three real findings, none of them on the ten decisions raised across two Pull Requests. Comparing the two specifications then showed the partner had independently chosen the opposite on three of them, so they are genuinely contested rather than obvious. | #15 |
| 6 | *"เล่าปัญหาให้ฟังหน่อย"*<br>"Tell me about the problem." | Asked for the explanation rather than the fix. Writing it out from first principles surfaced that a claim made minutes earlier — that hiding whitespace would show an empty diff — was wrong, and that a predicted sixty-five-file diff was in fact sixteen. | PR #25 |
| 7 | *"tdd น่าใช้ไหม"*<br>"Is TDD actually worth using?" | Refused to adopt a practice because a skill file recommended it. The answer had to weigh what §9 requires against what Part 3 actually evidences, and the outcome was to use the red-green loop only for the query parser and the API contract — where the rules come as a list — and not for layout work, where writing assertions before seeing the screen is guessing. | #18 |
| 8 | *"review contract ตอนนี้มันจะได้อะไร implement มาขนาดนี้แล้วนะ"*<br>"What would a Review Contract achieve now? We have implemented this much already." | Rejected a ceremony step the AI proposed. §11.2's Review Contract prompt is written for the start of a sprint; four Issues in, the ambiguities it would surface had already been resolved by building them. What survived was a two-minute mechanical traceability check, which found a real problem: the AC-to-test matrix used ranges a script cannot expand. | #18 |

## 2b. Full prompt log

Every prompt worth recording, including the eight above. Kept complete because a prompt
cannot be recovered accurately weeks after it was typed, and because the ones that look
minor are often the ones that stopped something going wrong.

| # | Prompt | What it produced |
| --- | --- | --- |
| 9 | *"16 ไม่ต้องเปิด Issue ใช่มะ"*<br>"For 16 — no Issue needed, right?" | Corrected an over-application of process. Cleaning up Lab 1 lint findings is not sprint scope under §10, so it became a Pull Request with no Issue and a one-line explanation in its description, which the workflow guide explicitly allows. |
| 10 | *"รีวิวให้หน่อยเดะเอาไปตอบบีมเอง"*<br>"Review it for me, I will take it and reply to Beam myself." | Drew the line between analysis and action. The AI read the partner's specification and produced the findings; posting the review stayed with me. |
| 11 | *"ขอแบบสรุป ๆ ง่าย ๆ"*<br>"Give me a short simple version." | Cut a long review down to its one blocking point. What was posted was a single paragraph rather than three tiers of findings. |
| 12 | *"merge อันนี้"* (on the partner's Pull Request)<br>"Merge this one." | Checking before merging found a stray git submodule pointer with no `.gitmodules`, and then that the branch ruleset forbade every merge method at once — `required_linear_history` and `allowed_merge_methods: ["merge"]` cannot both be satisfied. The instruction could not be carried out, and saying so with the evidence was more useful than trying. |
| 13 | *"แยก PR ได้ใช่มั้ยมันไม่ผิดกฏในแลปใช่มะต้องให้บีม Review ด้วยมั้ย"*<br>"A separate PR is allowed, it does not break the lab rules, and does Beam still need to review it?" | Three rule questions at once, answered from the handout rather than from habit: §10 scopes Issues to sprint work so none was needed, Part 7 covers Issue-less PRs explicitly, and Part 9 has no small-change exemption, so the reviewer still merges. |
| 14 | *"ก็ใส่ไปทุกอย่างเลยก็ได้"*<br>"Just put everything in, that is fine." | Settled how this document is structured. §14 Part 4 asks for six to ten selected prompts and the log had already outgrown that, so the answer was both: a selected table that meets the requirement, and this log underneath it that discards nothing. |

| 15 | *"ทำต่อเรื่อย ๆ จนเสด Issue 18 เลย"*<br>"Keep going until Issue 18 is finished." | Handed over a whole Issue rather than a step. What it changed was the ending: with no checkpoint to stop at, the §11.2 Completion Review had to be run before opening the Pull Request, and it found four gaps that would otherwise have shipped. |
| 16 | *"ทำไมหน้า My Ticket ไม่มี Table"*<br>"Why is there no table on the My Tickets page?" | Opened the running application, which no test in the repository can do. The table had no background at all and was invisible against the page. The first of three defects found this way in one session. |
| 17 | *"มีหน้า 11 ไงแล้วทำไม col Ticket Owner หายไปด้วย"*<br>"There *is* a page 11 — so why is the Ticket Owner column missing?" | Caught the AI asserting that a labsheet figure did not exist. It had listed the pages carrying images, then opened three of them and not the fourth. The figure was on page 11, the Ticket Owner column was real, and a review finding given to the peer reviewer had already been withdrawn on the strength of the mistake. It was reinstated. |
| 18 | *"งงแล้วเทสผ่านได้ไงแอบโกงหรือป่าว"*<br>"I'm confused — how did the tests pass? Are you cheating?" | Refused a green suite as an answer. The tests were honest, but every mock in `MyTickets.test.tsx` returned two tickets, so `totalPages` was always 1 and the page controls were never rendered by a single test on the screen itself — the component could have been deleted from the page without failing anything. Five tests now cover it. |
| 19 | *"มันอยู่ใน Scope ที่แลปให้ทำไหมนะ"*<br>"Is that even in the scope the lab asks for?" | Asked mid-implementation, after three fields had already been added to Create Ticket from Figure 1. Three of the five did not belong: IT Priority, Ticket Owner and Resolution Summary are set by work §4.2 excludes, so on a form whose job is to collect input they were permanently empty boxes. They were removed, with tests asserting their absence. |
| 20 | *"ก่อน code-review อยากให้ /diagnosing-bugs แล้วก็ implement แก้ต่อเลย"*<br>"Before the code review, run /diagnosing-bugs and fix what it finds." | Ordered a pipeline instead of accepting "the tests pass". The discipline it imposes — no hypothesis without a loop that goes red — turned three suspicions into two confirmed defects and one that was left unfixed *and unclaimed*, because six concurrent uploads across three runs never reproduced it. |

| 21 | *"ชั้นพร้อม issue 20 แล้ว"*<br>"I'm ready for Issue 20." | Started the Issue that exists because of everything before it. Playwright is the only suite here that runs the real application, and it found a §8.7 violation on its first full run — a pagination row that could not wrap and ran 71px past the edge on mobile — which six hundred passing unit tests and a screenshot review had both missed. |
| 22 | *"ครั้งหน้าแยกเปนข้อ ๆ เหมือนที่บีมรีวิวให้เราได้มะแบบทีละ comment"*<br>"Next time split it into separate items, one comment at a time, the way Beam reviews us." | Corrected an asymmetry I had not noticed. The peer reviewer sends line comments I can answer and resolve one at a time; I had been sending back a single block of prose, which makes the author map findings onto locations by hand and leaves nowhere to reply per finding. |
| 23 | *"โพสกด request changes ไป ๆ ขอเปน section ย่อย ๆ ข้อ ๆ"*<br>"Post it as request changes, in small numbered sections." | Turned a review into a verdict. Request-changes rather than comment forced the top line to say *which* findings block — two of nine — instead of leaving the author to weigh a list themselves. |

| 24 | *(the FR-17 implementation brief: picker position per ui-spec, mirror `rules.ts` exactly, no API change, D-17, tests, E2E screenshot, docs, verify, commit trailers)*<br>"You are implementing Issue #40..." | Handed over the whole Issue as one specification rather than a sequence of steps. What it fixed in advance was scope: the tempting multipart-creation endpoint was forbidden up front, with the three things it would break named, so no work was built and then thrown away. Two commits, PR #41, merged. |
| 25 | *"เปิด PR เลยงับ"*<br>"Open the PR already." | Lifted a standing no-push order with two words. The branch had been committed locally per the original instruction; the approval to publish was explicit rather than assumed. |
| 26 | *"ย้าย KanBan ด้วยนะ"*<br>"Move the Kanban too." | Found that Issue #40 had never had a card at all — nothing entered Backlog, so nothing travelled the columns. The card was created and placed straight into PR Review with the link already confirmed, then Done after the merge. |
| 27 | *"ทำต่อเลย"*<br>"Keep going." | Opened the follow-up branch, which is where the plan met its first refusal: the plan's `db:test:seed:demo` was not implemented, because PR #34 had already tried it and reverted it in `c2b40ea` — the demo seed broke four server assertions, and D-11 records why. Re-adding it would have reintroduced the defect the plan forgot. |
| 28 | *"ถ้ามันทำต่อได้ก็ทำต่อใน PR นี่เลยก็ได้"*<br>"If it can continue, just keep it in this PR." | Put the E2E-leftover wipe into PR #42 as a second commit instead of a new branch. Nine `E2E journey` tickets from one evening of reruns had broken the ownership test; `db:test:setup` now deletes them first, which is what D-11 already claimed it did. |
| 29 | *"ทำไมมี text แบบนี้ �� ... ใน PR"*<br>"Why is there �� text in the PR?" | Turned a rendering complaint into a toolchain rule. PowerShell's `>` redirect writes UTF-16 and non-ASCII does not survive `gh` on Windows — files for `gh` go through the write tool only, and PR bodies stay ASCII-only. Both descriptions were rewritten and byte-verified. |
| 30 | *"เปิด local ให้ดูหน่อยดิ" ... "ไม่ต้องใช้ worktree แล้ว"*<br>"Open it locally to see" ... "worktree no longer needed" | The local preview diagnosed its own bug report: the worktree has no `node_modules` of its own, so Vite refused to serve bootstrap fonts from the main checkout's — the missing icons, root-caused. Then both branches were verified on remote and the worktree retired. |

<!-- Prompts from later Issues are appended to §2b by the Pull Request that used them. -->

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
