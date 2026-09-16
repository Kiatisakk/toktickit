# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npm exec -- ultracite fix`
- **Check for issues**: `npm exec -- ultracite check`
- **Diagnose setup**: `npm exec -- ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `npm exec -- ultracite fix` before committing to ensure compliance.

---

# TokTickIT GitHub Workflow

Rules from `material/TokTickIT_GitHub_Workflow_Guide_TH_EN-1.pdf` (CPE 334), applying to every lab. The guide is written around Lab 1 and says so; below, **`<lab>-staging`** stands for the staging branch of whichever lab is in progress — `lab1-staging`, `lab2-staging`, and so on. Read the current one off the repository — `git branch -r` shows which staging branch exists — rather than trusting a name written into this sentence, which is how it came to say Lab 2 for the whole of Lab 3.

## Board statuses

Six columns in this exact order, on the **TokTickIT Individual Sprints** project built from the **Kanban** template.

| Status | Enter it when |
| --- | --- |
| Backlog | The Issue exists but has not been read and understood yet. |
| Specified | The Issue is understood and ready to implement. |
| Started | The feature branch exists and implementation has begun. |
| PR Review | A PR to `<lab>-staging` is open and the reviewer is checking it. |
| Fixing | Changes were requested or tests failed; fixing on the same branch. |
| Done | Approved, tests pass, merged into `<lab>-staging`, all acceptance criteria met. |

- Every Issue enters the board in **Backlog**.
- Move to **Specified** only after the requirements have actually been read.
- Move to **Started** only when implementation is actively happening.
- After PR Review the card goes to **Fixing** or **Done** — nothing else.
- Fixing goes back to **PR Review** once the corrections are pushed.
- Add Issues with **Create new issue**, never **Create a draft**: a draft cannot be linked to a PR.

**Move the card at the moment the thing happens, not in a catch-up pass at the end.** The board is graded on its final state, but the final state is the only part of it that can be faked, and a board updated in one sitting the night before looks exactly like one that was. Each of these is the moment:

| The moment | The move |
| --- | --- |
| Finished reading the Issue and its acceptance criteria | Backlog → Specified |
| First commit on the feature branch | Specified → Started |
| PR opened, reviewer requested, Issue link confirmed | Started → PR Review |
| Beam requests changes, or a check fails | PR Review → Fixing |
| Corrections pushed and replied to on the thread | Fixing → PR Review |
| Beam merges, and the Issue is closed by hand | PR Review → Done |

The board is scriptable, so there is no excuse for letting it drift. Adding a card and moving it are one command each:

```bash
gh project item-add <project> --owner <user> --url <issue-url> --format json
gh project item-edit --id <item> --project-id <project-id> \
  --field-id <status-field> --single-select-option-id <option>
```

The field and option identifiers are opaque strings; read them once with `gh project field-list <project> --owner <user> --format json` and reuse them. The token needs the `project` scope — `gh auth status` shows whether it has it.

`gh project item-add` does not detect a card that is already there, so list the existing items first and match on issue number, or a second run silently duplicates every card.

If a card is in the wrong column, the board is wrong, not merely stale.

## Linking a PR to its Issue

This is the thing that gets checked. Linking a _branch_ is not the same thing and does not count.

**A closing keyword does not link it.** `Closes #18` / `Resolves #18` / `Fixes #18` were observed on 2026-09-09 to create no closing reference against a `<lab>-staging` base — two Pull Requests, identical bodies, one linked by a person and one left alone for ten minutes. Write the keyword anyway for readability, then link it yourself.

**Link it from the command line.** The mutation lives on the *Issue*, which is why looking for it on the Pull Request finds nothing:

```bash
gh api graphql -f query='mutation($i:ID!,$p:[ID!]!){
  addCloseIssueReferences(input:{issueId:$i, pullRequestIds:$p}){clientMutationId}}' \
  -f i=<issue node id> -f 'p[]=<pr node id>'
```

Node ids come from the same query that verifies the result:

```bash
gh api graphql -f query='{repository(owner:"Kiatisakk",name:"toktickit"){
  issue(number:<n>){id}
  pullRequest(number:<pr>){id closingIssuesReferences(first:10){nodes{number}}}}}'
```

An empty `closingIssuesReferences` means it is not linked. `removeCloseIssueReferences` takes the same arguments and undoes it, so this is safe to try.

The **Development** panel in the PR's right sidebar does the same thing by hand — gear, pick the Issue, and it must end up reading _"Successfully merging this pull request may close these issues"_. Either way, only move the card to **PR Review** once the query comes back with the Issue number.

**Because the merge lands in `<lab>-staging` and not the default branch, GitHub will not close the Issue either.** After the merge, **close the Issue by hand** and drag the card to Done.

> This rule has been wrong twice, in opposite directions, and both mistakes are worth keeping.
>
> **First: the keyword was credited for a link a person had made.** A PR carried only `Closes #45` and showed a closing reference, so the rule was rewritten to say keywords work. They do not — the next PR, identical in every way, sat unlinked. The answer had been recorded the whole time:
>
> ```bash
> gh api repos/<owner>/<repo>/issues/<n>/timeline --paginate \
>   -q '.[] | select(.event=="connected") | "\(.actor.login) \(.created_at)"'
> ```
>
> *Seeing the state you hoped for is not evidence that you caused it.* Find the event that created it and read who fired it.
>
> **Second: this file claimed no API existed for the link.** It does — `addCloseIssueReferences`, raised in review by @beambeambeam. The mutation list had been searched, but for `link|closing|subissue`, and the mutation is spelled `Close`, not `closing`. The search missed it and the miss was reported as a fact about GitHub.
>
> *A search returning nothing is not evidence that nothing is there.* Before concluding something does not exist, check that the query could have found it — the same defect as a file filter that silently skipped a file whose name contained its own exclusion pattern.
>
> The claim is now backed by a run, not a grep: linking Issue #47 to PR #57 moved `closingIssuesReferences` from `[46]` to `[46, 47]`, and `removeCloseIssueReferences` put it back.

## Every PR asks Beam for review, and carries the lab label

Both are one command each, both are checked, and a PR with neither is a PR nobody is expecting:

```bash
gh pr edit <pr> --add-reviewer beambeambeam --add-label lab-<NN>
```

Do it at creation time, not when chasing the review later. The reviewer request is what puts the PR in his queue; the label — `lab-02`, `lab-03`, and so on for whichever lab is current — is what keeps the board screenshot for Part 1 from mixing two labs together.

Linking the _branch_ at the Started stage is optional, signals only that work has begun, and never replaces linking the PR.

## Branches and Pull Requests

- **Everything reaches `<lab>-staging` through a Pull Request.** Never commit or push directly to `main` or `<lab>-staging` — documentation commits included.
- Docs while the Issue's code is still in progress: edit them on the **same feature branch**, ship them in the **same PR**. Do not open a second branch.
- Docs after the code is merged — recording how a PR ended in `reviewer.md`, a stale `tests.md` row, a typo: **do not open a PR for it.** Commit it on the next feature branch and let it ride in that branch's PR, saying so in one line in the description. A PR that exists only to record the previous one is noise in the reviewer's queue, and it conflicts with the PR it is recording (#58 did, with #59, and was closed).
- Only the end-of-sprint report, with no next feature branch to carry it, gets its own `docs/<lab>-<topic>` branch (e.g. `docs/lab2-report`) and PR. Link it to an Issue if it has one; if not, say so in one line.

## Living documents — updated by the PR that makes them true

Four documents under `docs/<lab>/` are part of the submission and are graded directly. None of them is written at the end of the sprint. Each is updated **in the same Pull Request as the work it describes**, while the work is still in front of you.

| Document | Updated by every PR that… | Graded as |
| --- | --- | --- |
| `reviewer.md` | receives a review — record the reviewer, the comments, your replies, and the approval | Part 1 |
| `tests.md` | adds or changes a test — a row's Result stops reading `Planned` in the PR that makes it pass | Part 3 |
| `ai-use.md` | used AI in a way worth keeping — the prompt log grows as you go | Part 4 |
| `specification.md` | changes behaviour the spec describes — including `api-spec.md` and `ui-spec.md` | Part 2 |

**Why it has to be this way, from experience.** Lab 1 wrote `reviewer.md` at the end and it meant reopening every PR and expanding collapsed threads one at a time — slow, and it silently missed two PRs that were only found later by listing every PR from GitHub and searching the file for each number. Writing the entry while the conversation is still open is both faster and more accurate.

**A row that still reads `Planned` at submission is a defect**, not a to-do. Either the test exists and the row is stale, or the test does not exist and the plan is a wish.

### Create them when the lab starts, not when they are first needed

`reviewer.md` and `ai-use.md` are created **in the first Pull Request that targets a new `<lab>-staging` branch** — the contract PR, alongside `specification.md` — as skeletons carrying their headings and nothing else. Every later PR appends to a file that already exists, which is the whole point: appending to a file takes a minute, and creating one four Pull Requests late means reconstructing what should have been written down.

The check is one command, run the moment `<lab>-staging` exists:

```bash
ls docs/<lab>/
# api-spec.md  ai-use.md  reviewer.md  specification.md  tests.md  ui-spec.md
```

Six files. Fewer than six means the missing ones are going to be written from memory.

**`ai-use.md`'s reflection section is created empty and stays empty.** §14 Part 4 asks for the author's own words, so the skeleton carries a line saying the section is deliberately unwritten. It is never drafted "for review" and never filled in on the author's behalf.

> Lab 3 forgot both files until the fifth Pull Request, and four review events then had to be recovered from `gh api` rather than from notes. The rule above it — the one saying these are living documents — had been added to this file three commits earlier, in the same lab. **A rule written during a lab applies to that lab.** After adding one, check the current sprint against it before moving on.

**The specification is not allowed to describe behaviour the code does not have.** If a PR changes what the product does, the spec changes in the same PR. Discovering at report time that the documents and the code disagree is how a sprint ends up spending days on an audit instead of on the report.

## Reviewing (when I am the reviewer)

1. Read the **Files changed** tab against the acceptance criteria on the Issue — not merely whether the code runs.
2. **One finding per line, all in one review.** A finding attached to the line it is about can be answered and resolved on its own; the same findings in one long comment cannot be tracked or closed individually.
3. Pick one verdict: **Comment** (questions, no verdict), **Approve** (meets the acceptance criteria), or **Request changes** (say exactly what to fix).
4. **If I approve, I am the one who clicks "Merge pull request"** — never leave it to the author. **Unless the PR carries the `DO NOT MERGE` label**: then approve, and do not merge (see below).
5. If I request changes, tell the author so they know to start fixing.
6. **Never resolve my own findings.** Resolving is the author's move after fixing, and a thread resolved the moment it is raised is a finding deleted.

### `DO NOT MERGE` means nobody merges

A Pull Request labelled **`DO NOT MERGE`** is not merged — not by me after approving Beam's PR, not by Beam on mine, not by a script — however green its checks and however many approvals it has. Approving it is still fine; the merge waits until the label is gone, and only the PR's author removes it.

Check the labels immediately before every merge, on either repository, rather than trusting what they were when the review started:

```bash
gh pr view <pr> --repo <owner>/<repo> --json labels -q '.labels[].name'
```

Holding and releasing one of my own PRs:

```bash
gh pr edit <pr> --add-label "DO NOT MERGE"
gh pr edit <pr> --remove-label "DO NOT MERGE"
```

If the label is present and a merge was asked for anyway, say that the PR is labelled `DO NOT MERGE` and ask rather than merging.

### Submitting a review from the command line

Line comments and the verdict go in **one** request. Write the body to a file and post it:

```bash
gh api repos/<owner>/<repo>/pulls/<pr>/reviews --method POST --input review.json
```

```json
{
  "event": "REQUEST_CHANGES",
  "body": "the summary — what must change, what merely needs recording",
  "comments": [
    { "path": "docs/<lab>/specification.md", "line": 66, "side": "RIGHT",
      "body": "the finding, and why it matters" }
  ]
}
```

`event` is `COMMENT`, `APPROVE` or `REQUEST_CHANGES`. `line` is the line number in the file's **new** state, which is why `side` is `RIGHT`; on a newly added file every line is commentable. Confirm they landed with `gh api repos/<owner>/<repo>/pulls/<pr>/comments`.

Posting the findings and the verdict as two separate reviews works, but leaves two entries in the PR's history for one act of reviewing. Prefer the single call.

### The automated reviewer does not read prose

`/code-review` looks for correctness defects in code. Pointed at a documentation-only PR it reports nothing at all — not "no issues found" in any meaningful sense, simply that no runtime code changed. Since the largest PRs of a sprint are the contract and the report, **a docs PR is reviewed by reading it**, and the useful checks are the mechanical ones a script can do: are the identifiers complete and free of gaps, is every acceptance criterion referenced by a test, does every citation resolve to something that exists, does a claim about the code match the code.

## Authoring (when the PR is mine)

1. **Reply to every comment** — what was changed, or why I disagree. An approval with silence under it does not count as a review.
2. Move the card to **Fixing** while working, and push to the **same branch**. The PR updates itself; never open a new one.
3. Once the fix is pushed, reply on the thread and move the card back to **PR Review**.
4. Resolve a conversation only after replying to it _and_ actually fixing it.
5. Never accept an approval and merge in silence — reply to the reviewer's comments first.
