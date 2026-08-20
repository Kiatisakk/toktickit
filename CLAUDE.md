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

Rules from `material/TokTickIT_GitHub_Workflow_Guide_TH_EN-1.pdf` (CPE 334), applying to every lab.

## Board statuses

Six columns in this exact order, on the **TokTickIT Individual Sprints** project built from the **Kanban** template.

| Status | Enter it when |
| --- | --- |
| Backlog | The Issue exists but has not been read and understood yet. |
| Specified | The Issue is understood and ready to implement. |
| Started | The feature branch exists and implementation has begun. |
| PR Review | A PR to `lab1-staging` is open and the reviewer is checking it. |
| Fixing | Changes were requested or tests failed; fixing on the same branch. |
| Done | Approved, tests pass, merged into `lab1-staging`, all acceptance criteria met. |

- Every Issue enters the board in **Backlog**.
- Move to **Specified** only after the requirements have actually been read.
- Move to **Started** only when implementation is actively happening.
- After PR Review the card goes to **Fixing** or **Done** — nothing else.
- Fixing goes back to **PR Review** once the corrections are pushed.
- Add Issues with **Create new issue**, never **Create a draft**: a draft cannot be linked to a PR.

## Linking a PR to its Issue

This is the thing that gets checked. Linking a *branch* is not the same thing and does not count.

1. Open the PR, find **Development** in the right sidebar, click the gear, pick the Issue.
2. Do it right after creating the PR, not days later.
3. Verify: the sidebar must read *"Successfully merging this pull request may close these issues"*.
   If it still says **None yet**, the Issue is not linked.
4. Only move the card to **PR Review** after the link is confirmed. The card then shows the PR number.

**A keyword alone does not link anything here.** `Closes #18` / `Resolves #18` / `Fixes #18`
only link when the PR targets the repository's default branch. Ours target `lab1-staging`, so
GitHub downgrades them to a plain mention. Type one for readability if you like, then still
link through the Development panel.

Because the merge lands in `lab1-staging` and not the default branch, GitHub will not close
the Issue. **Close the Issue by hand** and drag the card to Done.

Linking the *branch* at the Started stage is optional, signals only that work has begun, and never replaces linking the PR.

## Branches and Pull Requests

- **Everything reaches `lab1-staging` through a Pull Request.** Never commit or push directly
  to `main` or `lab1-staging` — documentation commits included.
- Docs while the Issue's code is still in progress: edit them on the **same feature branch**,
  ship them in the **same PR**. Do not open a second branch.
- Docs after the code is merged, when the change is substantial: open `docs/<lab>-<topic>`
  (e.g. `docs/lab1-report`) and a PR for it. A typo or broken link gets the same treatment,
  just as a fast lane.
- If a docs PR belongs to an Issue, link it as usual; if there is no Issue, say so in one line
  in the PR description.

## Reviewing (when I am the reviewer)

1. Read the **Files changed** tab against the acceptance criteria on the Issue — not merely
   whether the code runs.
2. Leave line comments with the blue plus, then **Start a review**.
3. Finish with **Review changes** and pick one: **Comment** (questions, no verdict),
   **Approve** (meets the acceptance criteria), or **Request changes** (say exactly what to fix).
4. **If I approve, I am the one who clicks "Merge pull request"** — never leave it to the author.
5. If I request changes, tell the author so they know to start fixing.

## Authoring (when the PR is mine)

1. **Reply to every comment** — what was changed, or why I disagree. An approval with silence
   under it does not count as a review.
2. Move the card to **Fixing** while working, and push to the **same branch**. The PR updates
   itself; never open a new one.
3. Once the fix is pushed, reply on the thread and move the card back to **PR Review**.
4. Resolve a conversation only after replying to it *and* actually fixing it.
5. Never accept an approval and merge in silence — reply to the reviewer's comments first.
