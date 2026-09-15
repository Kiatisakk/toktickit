# Lab 3 AI Use

A living document. Prompts are recorded in the Pull Request that used them, not reconstructed
at the end of the sprint from memory. Lab 2 proved the point twice — once by working this way,
and once by discovering that the section had stopped being updated eight prompts earlier.

## 1. Which AI I used

**Claude Code** in the terminal, with access to the repository and to the `gh` command line
tool. **Claude Opus 5** throughout the sprint so far — every commit on `lab3-staging` and on
`feature/lab3-test-fixtures` carries its co-author trailer, and no sub-agent has authored a
commit in this lab. Lab 2 mixed Sonnet 5 sub-agents and Muse Spark 1.3 into the history; Lab 3
has not needed to yet, and this line is the record of that rather than an omission.

**Caveman** — a third-party skill installed mid-sprint (`npx skills add JuliusBrussee/caveman`)
— was used for two things, and is worth naming because it changed the output rather than the
content: it wrote the replies to the peer reviewer's twelve findings on PR #56, and it ran the
code review of the peer's PR #60. The findings underneath it were verified against the source
either way; what the skill changed was how they were said.

It was used as a specification agent first and a coding agent second, in the order §11 of the
labsheet sets out: the engineering contract was written, reviewed and merged before any
implementation began.

## 2. Selected key prompts

Eight prompts that changed what got built, or what I believed. All eight are mine. The full log
is §2b below.

| Log # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 1 | `/grill-with-docs @material/UTF-8_Lab_3_sheet.pdf` | Asked to be interrogated rather than handed a plan, the same opening as Lab 2. Four rounds of questions, every one to be answered before a line was written — password hashing, the shape of a session, how the status rename lands on Lab 2's existing data, whether the Requester selector is extended or deleted. | #45 |
| 2 | *"ขอภาษาไทยได้มะ"*<br>"Can I have it in Thai?" | Changed the language of the interrogation, not its content. It is in this table because the questions were about cryptography and migration order, and answering those in a second language is where a decision gets made for the wrong reason. The specification stayed in English; the deciding did not have to. | #45 |
| 3 | *"session เก็บแค่ `{ id, userId, expiresAt, createdAt }`"* and, in the same round, *"requesterStorage.ts ลบทิ้งทั้งไฟล์"*<br>"The session stores only those four fields" · "delete `requesterStorage.ts`, the whole file" | Two answers that closed the sprint's largest open question. The Development Requester Selection screen could have been kept behind a flag; deleting it means Lab 2's identity mechanism has no fallback, so every Lab 2 test that leaned on it has to be rewritten rather than left running. That is what Issue #46 turned out to be. | #45 |
| 4 | *"5 คำตอบที่ต้องการคำถามคืออะไร"*<br>"What are the questions for those five answers?" | Refused a list of answers with no questions attached. The AI had produced five decisions in a shape that read as settled, and this turned them back into the ambiguities they came from — which is the difference between a decision recorded and a decision made. | #45 |
| 5 | *"อัพเดทกฏลง Claude.md ด้วยเรื่อง living document … แล้วก็ลองผูก Issue ตรง Development Panel เองด้วยว่าทำได้ไหม"*<br>"Write the living-document rule into CLAUDE.md … and try linking the Issue from the Development panel yourself, see whether you can." | The instruction that produced this file and `reviewer.md` on time rather than at the end. It also contained a test the AI failed: told to *try*, it searched the GraphQL mutation list, found nothing, and wrote "there is no API for this" into the rules. See #8. | #46 |
| 6 | *"ทำให้มัน Generic นะไม่ใช่ระบุแค่อันใดอันนึง"*<br>"Make it generic — not written for one particular case." | Rejected the first draft of those rules for hard-coding `lab-03` and specific Pull Request numbers into instructions meant to outlive the sprint. They became `<lab>`, `lab-<NN>`, `<pr>`, `<issue>`. A rule that names this week's branch is a rule that will be wrong next week and followed anyway. | #46 |
| 7 | *"แต่มีจุดหนึ่งที่ผมอยากแก้ที่สุด … ผมไม่แนะนำให้เขียนเป็นกฎตายตัวแบบนี้โดยไม่ระบุว่าเป็น behavior ของระบบ ณ เวลาที่เขียนกฎ"*<br>"There is one thing I most want to change … I would not write this as a hard rule without saying it is the system's behaviour *at the time the rule was written*." — then, after seeing the result, *"ไม่เอาดีกว่าลบออกอันล่าสุดเอาแบบเดิม"*<br>"Actually no — drop the last one, keep the original." | The most interesting exchange of the sprint, because the instruction was right and the AI's implementation of it was wrong. Asked to date its behavioural claims, it wrote a whole "rule behind the rules" section and demoted three working rules into hedged observations, which made the file longer and the instructions weaker. Reverted by force-push. The idea survives as a dated note under the one rule that needed it, which is what was actually asked for. | #46 |
| 8 | *"https://github.com/Kiatisakk/toktickit/pull/57 รีวิวล่ะ"*<br>"Review it — #57." | Not a prompt that changed code, but one that caught the AI being wrong about the world. The peer reviewer answered with `addCloseIssueReferences` — the mutation this repository's rules said did not exist. It exists. The earlier search had been for "link", "closing" and "subissue"; the mutation is spelled `Close`. An empty search result had been recorded as a fact about GitHub rather than a fact about the search. | #46 |

## 2b. Full prompt log

Every prompt of the sprint so far, the eight selected among them. Kept complete because a
prompt cannot be recovered accurately once the session is over, and because the ones that look
minor are often the ones that stopped something going wrong.

| # | Prompt | What it produced |
| --- | --- | --- |
| 1 | `/grill-with-docs @material/UTF-8_Lab_3_sheet.pdf` | Selected — see §2. |
| 2 | *"ขอภาษาไทยได้มะ"* | Selected — see §2. |
| 3 | Round 1 answers — *"a, crypto.scrypt, a, b, Split by boundary, b, Same cadence"* | Settled hashing, the session store, and how the sprint splits into Issues. `crypto.scrypt` was chosen over an external Argon2 dependency; the peer's repository chose Argon2id, which is how the two specifications came to differ on a point neither of us had to guess about. |
| 4 | Round 2 answers, including *"session เก็บแค่ `{ id, userId, expiresAt, createdAt }`"* | Selected — see §2. |
| 5 | Round 3 answers — *"รับตามร่าง, (ก) เลิกใช้, ตามตาราง และเปลี่ยนรหัสแล้ว, (ก), ตามนั้น และ requesterStorage.ts ลบทิ้งทั้งไฟล์, รหัสผ่าน 8–128 ตัว"* | Settled the status rename, the deletion of the selector, and the password bounds. |
| 6 | Round 4 answers — *"user ทุก role, ก, 1→2→3→(4→5→6)→7→8→9, ใช้ซ้ำทั้งชุด"* | Settled seed scope and the Issue dependency order: three of the nine can run in parallel, the rest are a line. |
| 7 | `/to-spec` | Turned the settled answers into `specification.md`, `api-spec.md`, `tests.md` and `ui-spec.md`. |
| 8 | *"ทำทั้งสองอย่าง"*<br>"Do both." | Answered a question about whether the authorization matrix belongs in the specification or in the API spec by declining the choice. It lives in §5 of the specification and is cited from the API spec. |
| 9 | `/to-tickets` | Nine Issues, #47–#55. |
| 10 | *"กำลังดี, รวม, เก็บตามจริง, รับได้, lab-03 อย่างเดียว"*<br>"About right · combine them · record what is actually true · acceptable · label `lab-03` only." | Five sizing decisions in one line: Issue granularity, whether to split the comment and note work, whether estimates are aspirational, the risk carried by the Lab 2 test rewrite, and the label. |
| 11 | *"5 คำตอบที่ต้องการคำถามคืออะไร"* | Selected — see §2. |
| 12 | `/implement`, twice | Started #45, then #46. |
| 13 | *"ready let agent start"* | Handed over the contract Issue. |
| 14 | *"อัพเดทกฏลง Claude.md ด้วยเรื่อง living document …"* | Selected — see §2. |
| 15 | *"ใส่ label lab-03 ไว้ด้วยนะ"*<br>"Put the `lab-03` label on it too." | Caught a Pull Request opened without the label. Lab 2 learned this the hard way — unlabelled Issues put two labs' cards in one board screenshot. |
| 16 | *"อัพเดท KanBan ด้วย ๆ"* · *"เก็บการ์ด lab2 ได้เลย"*<br>"Update the Kanban too" · "you can archive the Lab 2 cards." | Produced the finding that the board is scriptable — `gh project item-add` and `item-edit` — which the rules had claimed it was not. |
| 17 | *"https://github.com/beambeambeam/toktickit/pull/59 review ให้หน่อย … review เป็น comment ข้อ ๆ แล้วให้กด resolve"*<br>"Review #59 … as one comment per point, and resolve them." | The half of the instruction that was refused is the interesting half. One finding per line: yes, that is how the peer reviews us. Resolving them: no — resolving is the author's move after fixing, and a thread resolved by the reviewer at the moment it is raised is a finding deleted. That is a rule in `CLAUDE.md` now. |
| 18 | *"กด request change ด้วยมะ"*<br>"Press Request changes as well?" | Turned three line comments with no verdict into an actual review. Findings without a verdict leave the author guessing whether they are blocking. |
| 19 | *"อัพเดท Claude.md ด้วยเรื่องการคอมเม้นกับ request change"*<br>"Write the commenting and request-changes practice into CLAUDE.md." | Both of the above became rules, along with the `gh api … /reviews` recipe that posts the line comments and the verdict in one request rather than two. |
| 20 | *"แก้ 12 ข้อที่เหลือได้เลยแล้วก็ตอบเป็น caveman กลับไป"*<br>"Fix the remaining twelve and reply in caveman." | Twelve review findings fixed in one commit, each thread answered with the commit that fixed it. |
| 21 | *"แล้วแก้ไรไปนะล่าสุด"*<br>"So what was it that got changed, again?" | Asked for the account after the fact and got a correction out of it: one of the twelve fixes had left a contradicting row in a second file, in the very commit whose message said it was fixing that contradiction. |
| 22 | *"ทำให้มัน Generic นะไม่ใช่ระบุแค่อันใดอันนึง"* | Selected — see §2. |
| 23 | *"แต่มีจุดหนึ่งที่ผมอยากแก้ที่สุด …"* and *"ไม่เอาดีกว่าลบออกอันล่าสุดเอาแบบเดิม"* | Selected — see §2. |
| 24 | *"ผูก Development panel ได้มะ"* · *"ใช่ กดเอง"*<br>"Can you link it from the Development panel?" · "Right — I clicked it myself." | Established who had actually created a link that the AI had credited to a closing keyword. The keyword had been given credit for a click. |
| 25 | *"npx skills add JuliusBrussee/caveman ลงอันนี้หน่อย"*<br>"Install this one." | Added the skill used for the replies on #56 and for the review of #60. |
| 26 | *"https://github.com/beambeambeam/toktickit/pull/60 ใช้ caveman code-review medium หน่อย"*<br>"Use caveman code-review, medium, on #60." | An 83-file authentication implementation reviewed. Of the nine findings the automated pass produced, six survived being checked against the source and were posted; three did not and were not. |
| 27 | *"https://github.com/beambeambeam/toktickit/pull/60 re-review ล่ะ"*<br>"Re-review #60 now." | Confirmed all six fixed — two of them more thoroughly than asked — and approved. |
| 28 | *"https://github.com/Kiatisakk/toktickit/pull/57 รีวิวล่ะ"* | Selected — see §2. |
| 29 | *"ai_use.md กับ reviewer.md ทำตอนไหนนะ"*<br>"When do `ai-use.md` and `reviewer.md` get done?" | Found that neither existed. The rule requiring them had been written into `CLAUDE.md` four commits earlier and had not been applied to the lab that wrote it. This file and `reviewer.md` are the answer, and the rule now says both are created when a new `<lab>-staging` branch starts. |
| 30 | *"สร้างเลย ใส่ใน PR #57 แล้วก็เพิ่มกฏว่าต้องสร้างทุกครั้งตอนเริ่ม lab-staging ใหม่แล้วก็ฝากเช็คด้วยตกหล่นอะไรไหม"*<br>"Create them, put them in PR #57, add the rule that they are created every time a new lab-staging starts, and check what else has been dropped." | Both files written and backfilled, the rule added — and the audit it asked for found `CLAUDE.md` still announcing Lab 2 as the current sprint, in the file that had just been edited twice that day. |
| 31 | *"47 ทำต่อเลย"*<br>"Carry straight on with 47." | Authentication. The instruction carried no design in it, which meant the specification had to be the design — and it held: hashing, session shape, the ordered inactive check and the three-step password migration were all already decided, so the work was implementation rather than negotiation. |
| 32 | *"เปิด docker แล้ว"*<br>"Docker is up now." | Unblocked the half of the ticket that needed a database, and the first thing it produced was a refusal. The bootstrap script stopped rather than inventing passwords for three IT Staff rows it had no credentials for — rows Lab 2 had left in the demonstration seed under a comment reading *"Lab 3 moves them when authentication gives them a purpose."* The move happened here, a ticket earlier than the staff features that need it, because a `NOT NULL` password column has to hold for every existing row including theirs. Then the migration failed on the test database with the exact error the peer reviewer had predicted on PR #56 — which is the second time this sprint that a finding raised in review turned out to be a real event rather than a caution. |
| 33 | *"บีม review ล่ะ 2 pr เลย"*<br>"Beam has reviewed — both PRs." | Seventeen findings on #59, each checked against the code before anything was changed. The check itself found the worst one had been understated: the build failure the reviewer reported also crashed the seed at runtime, and had been invisible locally because the Prisma client was stale. Eleven findings fixed; four answered with the reason. The upgrade-path fix was verified by building a throwaway database in the Lab 2 shape rather than by reasoning about the migration. |
| 34 | *"continue นึกไว้ด้วยว่า Lab 2 ทำเสดแล้วส่งเรียนร้อยแล้ว"*<br>"Continue — and remember that Lab 2 is finished and already submitted." | Recorded as a standing fact rather than a passing remark, because the work at that moment was editing Lab 2 tests and seeds. It separates two things that looked alike: Lab 2 *code* still changes when Lab 3 requires it, in the Lab 3 Pull Request that needs it; the Lab 2 *submission* is closed and is not reopened or improved. |
| 35 | *"https://github.com/beambeambeam/toktickit/pull/61 รีวิวให้เพื่อนหน่อย"*<br>"Review my friend's PR #61." | A review of the Administrator user-management slice, and the clearest case this sprint of a check changing the finding. The AI expected the peer's manual `LIKE` escaping to be a double-escape bug and was about to say so. It built a throwaway database on the peer's Prisma version instead, found Prisma does not escape wildcards at all, and the "bug" became the thing the review praised. Two further suspicions were dropped the same way before anything was posted. What remained was a real blocker — the PR would close an Issue with two acceptance criteria that nothing tests. |
| 36 | *"วันหลังไม่ต้องเปิด pr แยกค่อยใส่ใน pr ถัดไปแทน ๆ"*<br>"In future, don't open a separate PR — put it in the next PR instead." | Retired a rule rather than following it. `CLAUDE.md` had said post-merge docs get a `docs/<lab>-<topic>` Pull Request of their own; PR #58 was one, recording how #57 ended, and it conflicted with #59 and was closed. The rule now says such docs ride in the next feature branch's Pull Request, and the commit #58 carried is on #48's branch. |
| 37 | *"ทำ issue 18 ต่อเลย"*<br>"Carry on with issue 18." | Issue #18 is Lab 2's My Tickets and has been closed since Lab 2 was submitted. The AI read it, saw it could not be the one meant, and went by the branch already checked out — `feature/authenticated-requester`, which is #48 — saying so before starting. |
| 38 | *"ทำ #48 ต่อเลย"*<br>"Carry on with #48." | The selector deleted. Server identity comes from the session alone, scope is one module with a read fragment and a write fragment, and the Lab 2 suites sign in instead of setting a header. The part the specification had not foreseen was the browser suite: reusing a saved session means no test may ever click Logout, so switching from Requester A to Requester B became two browser contexts rather than one page. |
| 39 | *"https://github.com/Kiatisakk/toktickit/pull/60 บีมรีวิวแล้ว"*<br>"Beam has reviewed PR #60." | Two findings, both confirmed against the code before any change. One exposed a comment that had become false the moment the ticket's own change landed — the status page was documented as calling only the public health endpoint, and it calls two. Each fix got a regression test, and each test was first run against the unfixed source to watch it fail. |

## 3. My reflection

> _Left for me to write in my own words before submission, as §14 Part 4 requires. It is the
> one section of this document that cannot be delegated, so it is deliberately empty rather
> than drafted._
