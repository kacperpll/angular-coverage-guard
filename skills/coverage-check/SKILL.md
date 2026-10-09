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

Find the directory containing `angular.json` (usually the current directory). If none exists,
tell the user plainly and stop — do not guess a different directory.

## 3. Run the analysis script

From the project root, run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage-check.mjs" [path|--all]
```

Parse its JSON stdout.

- If it printed `{"error": "..."}`, relay that message plainly and stop. Do not retry with
  different arguments or guess a workaround — the script's error already explains what's wrong
  (no `angular.json` found, no base branch detected, a crashed test run, or failing tests that make
  coverage numbers unreliable).
- Otherwise it returns `{ threshold, runOutcome, entries }`, where each entry is one relevant `.ts`
  source file:
  - `{ file, hasSpec: false, note: "no dedicated spec" }` — no spec file exists for it at all. This
    does **not** mean 0% coverage; the file may be exercised indirectly by other tests.
  - `{ file, hasSpec: true, lines, branches }` — real coverage numbers from the scoped test run.
  - `{ file, hasSpec: true, note: "...", lines: { pct: 0 } }` — a spec exists but didn't exercise
    this file at all.

If `entries` is empty, tell the user there's nothing in scope and stop.

## 4. Present a summary

Show the files below `threshold` (by `lines.pct`, when present) or with no dedicated spec, grouped
so files with no spec at all and guards/interceptors/resolvers/services/pipes/utils come before
components (this ordering refinement lands in a later iteration — for now, just call out files
with no spec first, then low-coverage files, in the order the script returned them).

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

Run the same analysis script again, scoped to just the file(s) you wrote or edited:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage-check.mjs" <path to the source file>
```

Report the new coverage for exactly those files, and say plainly that this reflects only this
scoped run, not the whole project. If the result is an error (e.g. failing tests), show it and
stop — do not silently retry or rewrite the test yourself.
