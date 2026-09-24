# angular-coverage-guard

Claude Code plugin that finds untested code in Angular + Vitest projects, proposes test cases
and writes them after approval. Full spec: `docs/brief.md` — read it before any task.

## Rules

- Code, comments, commit messages, README and all files in this repo: English.
- Commit messages: short, 1–2 sentences, what and why. No file-by-file lists.
- Do not run linters or typecheck automatically — only when asked.
- Run tests by default after changes (scoped first, full suite for cross-cutting changes).
- Comment only complex logic or design decisions; self-explanatory code needs no comments.
- Scripts: Node ESM, zero runtime dependencies unless there is a strong reason.
- Stick to the v1 scope in the brief. If something outside it looks necessary, stop and ask.
- This is a public repo. Never add code, names, selectors or structure from employer or client projects.

## Angular conventions (for demo-app and for generated tests)

- Every class method has an explicit access modifier: public, private or protected.
- `ngOnDestroy()` is always the last method in the class.
- Subscriptions are cleaned up with `takeUntil(this.destroy$)` or `takeUntilDestroyed()`.
- Before writing a spec, read existing specs next to it and follow their setup and mocking style.

## Workflow

1. Analysis: read the relevant code and the brief, list edge cases, plan with tests.
2. Implementation: tests first when possible, smallest working version.
3. Verification: run the tests, check the result on `examples/demo-app`.
