# Lab 3 AI Use

A living document. Prompts are recorded in the Pull Request that used them, not reconstructed
at the end of the sprint from memory. Lab 2 proved the point twice — once by working this way,
and once by discovering that the section had stopped being updated eight prompts earlier.

## 1. Which AI I used

**Claude Code** in the terminal, with access to the repository and to the `gh` command line
tool. **Claude Opus 5** for the contract and for Issues #46–#51 and #53, and as the session
that directed and checked everything else.

**Claude Sonnet 5 sub-agents** implemented two Issues end to end, each launched by the Opus 5
session with a written brief and working alone in the repository: **#52** Internal Notes
(PR #65) and **#54** the end-to-end journeys and screenshots (PR #66). Opus 5 then checked
each one's work before calling it done, and found something both times — a type error of
its own from #51 that broke `tsc -b`, and a reset script that could have emptied the
development database. **Those sub-agents' commits carry the `Co-Authored-By: Claude Opus 5`
trailer**, because the brief told them to use that line. The trailer is therefore wrong
about who wrote them, and this paragraph is the correction.

The closing issue (#55) was planned and implemented with **Muse Spark** instead —
same terminal, same repository, same `gh` workflow. The prompts that mattered are
#65–#66 in the log below.

**Caveman** — a third-party skill installed mid-sprint (`npx skills add JuliusBrussee/caveman`)
— was used for two things, and is worth naming because it changed the output rather than the
content: it wrote the replies to the peer reviewer's twelve findings on PR #56, and it ran the
code review of the peer's PR #60. The findings underneath it were verified against the source
either way; what the skill changed was how they were said.

It was used as a specification agent first and a coding agent second, in the order §11 of the
labsheet sets out: the engineering contract was written, reviewed and merged before any
implementation began.

## 2. Selected key prompts

Eight prompts that changed what got built, or what I believed. All eight are mine. Every prompt
of the sprint, these eight among them, is in [`ai-use-log.md`](./ai-use-log.md) under the
same numbers.

| Log # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 1 | `/grill-with-docs @material/UTF-8_Lab_3_sheet.pdf` | Asked to be interrogated rather than handed a plan, the same opening as Lab 2. Four rounds of questions, every one to be answered before a line was written — password hashing, the shape of a session, how the status rename lands on Lab 2's existing data, whether the Requester selector is extended or deleted. | #45 |
| 4 | *"5 คำตอบที่ต้องการคำถามคืออะไร"*<br>"What are the questions for those five answers?" | Refused a list of answers with no questions attached. The AI had produced five decisions in a shape that read as settled, and this turned them back into the ambiguities they came from — which is the difference between a decision recorded and a decision made. | #45 |
| 5 | *"อัพเดทกฏลง Claude.md ด้วยเรื่อง living document … แล้วก็ลองผูก Issue ตรง Development Panel เองด้วยว่าทำได้ไหม"*<br>"Write the living-document rule into CLAUDE.md … and try linking the Issue from the Development panel yourself, see whether you can." | The instruction that produced this file and `reviewer.md` on time rather than at the end. It also contained a test the AI failed: told to *try*, it searched the GraphQL mutation list, found nothing, and wrote "there is no API for this" into the rules — until the peer reviewer named `addCloseIssueReferences`, which exists. | #46 |
| 6 | *"ทำให้มัน Generic นะไม่ใช่ระบุแค่อันใดอันนึง"*<br>"Make it generic — not written for one particular case." | Rejected the first draft of those rules for hard-coding `lab-03` and specific Pull Request numbers into instructions meant to outlive the sprint. They became `<lab>`, `lab-<NN>`, `<pr>`, `<issue>`. A rule that names this week's branch is a rule that will be wrong next week and followed anyway. | #46 |
| 7 | *"แต่มีจุดหนึ่งที่ผมอยากแก้ที่สุด … ผมไม่แนะนำให้เขียนเป็นกฎตายตัวแบบนี้โดยไม่ระบุว่าเป็น behavior ของระบบ ณ เวลาที่เขียนกฎ"*<br>"There is one thing I most want to change … I would not write this as a hard rule without saying it is the system's behaviour *at the time the rule was written*." — then, after seeing the result, *"ไม่เอาดีกว่าลบออกอันล่าสุดเอาแบบเดิม"*<br>"Actually no — drop the last one, keep the original." | The most interesting exchange of the sprint, because the instruction was right and the AI's implementation of it was wrong. Asked to date its behavioural claims, it wrote a whole "rule behind the rules" section and demoted three working rules into hedged observations, which made the file longer and the instructions weaker. Reverted by force-push. The idea survives as a dated note under the one rule that needed it, which is what was actually asked for. | #46 |
| 29 | *"ai_use.md กับ reviewer.md ทำตอนไหนนะ"*<br>"When do `ai-use.md` and `reviewer.md` get done?" | Asked when the two files get written, and found that neither existed. The rule requiring them had been added to `CLAUDE.md` four commits earlier — by the very branch under review — and had not been applied to the lab that wrote it. Both files are the answer, backfilled from `gh api` rather than from notes, which is the reconstruction the rule exists to prevent. A rule unwatched is a rule unkept, including by its author. | #46 |
| 54 | *"ทำไมทำ 50 ก่อน 49"*<br>"Why do #50 before #49?" | No technical reason. #50 was recommended because it starts the longest chain, but the order agreed at the start put #49 first, and the recommendation did not say it departed from that. It should have. Recorded here because it is a model-behaviour miss, not a code one. | #50 |
| 63 | *"continue then start next issue"* | #65 merged and #52 closed, so the one unblocked Issue was #54 — one subagent, not several. It built the end-to-end journeys, and running the suite twice found two real defects rather than flakiness, both fixed at the cause. The remaining non-determinism was proven inherited, not introduced: Lab 2's own suite rerun showed the same ticket-number drift. Reported rather than silently excluded. | #54 |

## 3. My reflection

This time, every implementation needed several rounds of re-testing and
re-fixing code, and that is where the most time and tokens were spent. I began with the best
practice — `/grill-with-docs`, then `/to-spec`, then `/to-tickets` — before implementing
anything, and still found bugs in many places. That makes me think that defining the scope of
the work, and how the work is to be done, clearly is what would save the most time and tokens
once a codebase grows as large as this one.
