---
name: coverage-check
description: Finds Angular + Vitest unit test coverage gaps in changed files (or a given path, or the whole project with --all), proposes test cases per gap, and writes them after explicit approval.
disable-model-invocation: true
---

# /coverage-check

## 1. Parse the argument

- No argument: changed-files mode (default).
- A path (file or directory): scope to that path.
- `--all`: scope to the whole project.

## 2. Locate the project root

You don't need to find `angular.json` yourself — the script does this. If the user already told you
which directory the Angular project is in, pass it explicitly with `--project-dir <path>`. Otherwise
just run the script with no project-dir argument and let it search: upward from the current
directory first, then downward (max 3 levels, skipping `node_modules`/`dist`) if nothing was found
upward.

## 3. Run the analysis script

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage-check.mjs" [--project-dir <path>] [path|--all]
```

Parse its JSON stdout.

- If it printed `{"multipleProjectsFound": ["path1", "path2", ...]}`, list the candidates and ask
  the user which one to use — do not guess. Re-run with `--project-dir <their choice>`.
- If it printed `{"error": "..."}`, relay that message plainly and stop. Do not retry with
  different arguments or guess a workaround — the script's error already explains what's wrong
  (no `angular.json` found anywhere, no base branch detected, a crashed test run, or failing tests
  that make coverage numbers unreliable).
- Otherwise it returns `{ projectRoot, projectRootSource, threshold, runOutcome, entries, branchGaps }`.
  `projectRootSource` is `"explicit"` (you passed `--project-dir`), `"upward"`, or `"downward"` — if
  it's `"downward"`, say which directory was used, since it wasn't the one you started in. Each
  entry in `entries` is one relevant `.ts` source file:
  - `{ file, hasSpec: false, note: "no dedicated spec" }` — no spec file exists for it at all. This
    does **not** mean 0% coverage; the file may be exercised indirectly by other tests.
  - `{ file, hasSpec: true, lines, branches, uncoveredLines, uncoveredBranches }` — real coverage
    numbers from the scoped test run. Each entry in `uncoveredBranches` has a `snippet`: the trimmed
    source line for that branch, straight from the file.
  - `{ file, hasSpec: true, note: "...", lines: { pct: 0 } }` — a spec exists but didn't exercise
    this file at all.
  `branchGaps` is a **separate** list: tier 1-2 files (guards, interceptors, resolvers, services,
  pipes, utils) that meet the line threshold — so they do **not** appear as a gap in `entries` by
  `lines.pct` — but still have an uncovered branch (e.g. one business-rule `if` never exercised by
  any test). This is a real, separate category of gap: a file can hit 90% lines while its one actual
  decision point is never tested. Treat each `branchGaps` entry exactly like a gap from `entries`:
  read the file, propose a test for it, ask for approval, write it. When you read the branch's
  `snippet`, use judgment — a snippet that's plain Angular/TypeScript boilerplate (e.g. a bare class
  declaration line, not an `if`/`? :`/`&&`/`||`) is very likely compiler-generated instrumentation
  noise, not a real missing test; say so and skip proposing a test for it rather than inventing one.

If `entries` is empty and `branchGaps` is empty, tell the user there's nothing in scope and stop.

## 4. Present a summary

Show the files below `threshold` (by `lines.pct`, when present) or with no dedicated spec, grouped
so files with no spec at all and guards/interceptors/resolvers/services/pipes/utils come before
components (this ordering refinement lands in a later iteration — for now, just call out files
with no spec first, then low-coverage files, in the order the script returned them). Then show
`branchGaps` as its own section — these files are "healthy" by lines.pct, so don't mix them into the
same table as the line-coverage gaps above.

## 5. Read before proposing — do not skip this

For each file you're about to propose tests for:

1. Read the file itself to understand what the uncovered lines/branches actually do — the script
   only gives you line numbers and percentages, not meaning.
2. Read any existing `*.spec.ts` files in the same directory (or, if none exist there, the nearest
   comparable one in the project) to learn the project's `TestBed` setup, mocking style, and naming
   conventions before writing anything new. If there's truly nothing comparable to follow, say so
   explicitly and fall back to idiomatic Angular + Vitest conventions.

## 6. Propose test cases

Per file, propose a list of test cases: a descriptive test name plus one sentence on what it
verifies. Group by file. Do not invent coverage for files not in scope.

## 7. Ask for approval

Ask explicitly before writing anything. Support approving only some of the proposed files/tests.

## 8. Write only what was approved

Create a new `*.spec.ts` where none exists (following the conventions read in step 5), or extend an
existing one preserving its structure. Follow this repo's Angular conventions from `CLAUDE.md`
(explicit access modifiers on class methods, `ngOnDestroy()` last, `takeUntil`/`takeUntilDestroyed`
for subscriptions) wherever the new test code touches them.

## 9. Verify

Run the same analysis script again, scoped to just the file(s) you wrote or edited, reusing the
same `projectRoot` from step 3 as `--project-dir` so it doesn't re-search:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage-check.mjs" --project-dir <projectRoot> <path to the source file>
```

Report the new coverage for exactly those files, and say plainly that this reflects only this
scoped run, not the whole project. If the result is an error (e.g. failing tests), show it and
stop — do not silently retry or rewrite the test yourself.
