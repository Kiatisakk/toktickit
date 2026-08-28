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

Recorded as they were used. Prompts written in Thai are kept verbatim, with a translation
beside them.

> **This list has outgrown the limit and must be cut before submission.** §14 Part 4 asks
> for six to ten; there are eleven, and Issues #18 to #20 will add more. The final Issue
> selects rather than appends — that is what "selected key prompts" means, and appending
> was the right thing to do while the work was happening because a prompt cannot be
> recovered accurately weeks later.

| # | Prompt | What it produced | Issue |
| --- | --- | --- | --- |
| 1 | `/grill-with-docs @material/UTF-8_Lab_02_labsheet-1.pdf read instruction in this lab2` | Rather than asking for a plan, this asked to be interrogated. It produced four rounds of questions — thirty decisions in total — before a line of anything was written. | #14 |
| 2 | *"9 ทำอัน 2 ก่อนได้ไหมค่อยทำ tooling รวมกับพวก feature"*<br>"For question 9 — can we do item 2 first, then fold the tooling in with the features?" | Reordered the sprint so the specification became the first Pull Request into `lab2-staging`. The commit graph now proves the specification preceded the code, which is what Part 2 asks for. The original plan had tooling first, which would have made that evidence weaker. | #14 |
| 3 | *"16 ไม่ต้องเปิด Issue ใช่มะ"*<br>"For 16 — no Issue needed, right?" | Corrected an over-application of process. Cleaning up Lab 1 lint findings is not sprint scope under §10, so it became a Pull Request with no Issue and a one-line explanation in its description, which the workflow guide explicitly allows. | — |
| 4 | *"Lab 2 report and submission evidence คืออยากให้ทำและอัพเดทเรื่อย ๆ"*<br>"Lab 2 report and submission evidence — I want this done and updated continuously." | Changed the shape of the whole sprint. `reviewer.md`, `ai-use.md` and `tests.md` became living documents updated by every Pull Request, and the final Issue became an audit rather than a writing exercise. | #15 |
| 5 | *"รีวิวให้หน่อยเดะเอาไปตอบบีมเอง"*<br>"Review it for me, I will take it and reply to Beam myself." | Drew the line between analysis and action. The AI read the partner's specification and produced the findings; posting the review stayed with me. | — |
| 6 | *"ขอแบบสรุป ๆ ง่าย ๆ"*<br>"Give me a short simple version." | Cut a long review down to its one blocking point. What was posted was a single paragraph rather than three tiers of findings. | — |

| 7 | *"รอบีมตรวจ pr 23 ก่อนค่อยทำอะไรก็ตาม"*<br>"Wait for Beam to review PR 23 before doing anything at all." | Stopped work rather than starting the next Issue in parallel. The next Issue creates the `User` table, which locks the naming decision the reviewer had not yet commented on — building it first would have meant a migration to undo. | #15 |
| 8 | *"แล้ว 5 อันที่นายจงใจทำไว้แก้ยังนะ"*<br>"What about the five things you deliberately flagged for him to challenge?" | Checked whether the review had actually engaged with the flagged decisions. It had not — three real findings, none of them on the ten decisions raised across two Pull Requests. Comparing the two specifications then showed the partner had independently chosen the opposite on three of them, so they are genuinely contested rather than obvious. | #15 |
| 9 | *"merge อันนี้"* (on the partner's Pull Request)<br>"Merge this one." | Checking before merging found a stray git submodule pointer with no `.gitmodules`, and then that the branch ruleset forbade every merge method at once — `required_linear_history` and `allowed_merge_methods: ["merge"]` cannot both be satisfied. The instruction could not be carried out, and saying so with the evidence was more useful than trying. | — |

| 10 | *"เล่าปัญหาให้ฟังหน่อย"*<br>"Tell me about the problem." | Asked for the explanation rather than the fix. The answer had to start from what a line ending actually is, and the act of writing it out surfaced that a claim made minutes earlier — that hiding whitespace would show an empty diff — was wrong, and that the sixty-five-file diff predicted would in fact be sixteen. | PR #25 |
| 11 | *"แยก PR ได้ใช่มั้ยมันไม่ผิดกฏในแลปใช่มะต้องให้บีม Review ด้วยมั้ย"*<br>"A separate PR is allowed, it does not break the lab rules, and does Beam still need to review it?" | Three rule questions at once, answered from the handout rather than from habit: §10 scopes Issues to sprint work so none was needed, Part 7 covers Issue-less PRs explicitly, and Part 9 has no small-change exemption, so the reviewer still merges. | PR #25 |

<!-- Prompts from later Issues are appended here by the Pull Request that used them. -->

## 3. My reflection

> **To be written by me before Issue #21 closes.** §14 Part 4 asks for a brief personal
> reflection on the AI-use experience. It has to be in my own words, so it is deliberately
> left blank rather than generated — the AI cannot write my opinion of working with it.
>
> Points worth reflecting on, from what actually happened:
> - Being interrogated for four rounds before any code existed, and whether thirty settled
>   decisions up front was worth the delay.
> - The cases above where I overruled the AI's recommendation and the result was better.
> - What it means that the AI drafted a review of a classmate's work but I decided what to
>   send.
