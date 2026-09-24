# angular-coverage-guard — project brief

## What it is

A Claude Code plugin that keeps unit test coverage honest in Angular projects that use Vitest.
It finds code that is not covered by tests, explains what is missing, proposes concrete test cases,
and writes those tests only after the developer approves them.

Target user: a front-end developer (often the only one on the team) working on an Angular app
that has few or no tests, who uses Claude Code day to day.

## Scope of v1

### 1. `/coverage-check` (on demand)

- Runs the project's unit tests with coverage.
- Default mode: only files changed against the base branch (`git diff <base>...HEAD` plus uncommitted changes).
  Optional argument: a path or `--all` for the whole project.
- Reads the coverage output (json-summary / lcov) and lists files below the threshold,
  with uncovered lines and branches.
- Prioritises by risk, not by percentage: guards, interceptors, resolvers, services with logic,
  pipes and utils first; presentational components last.
- For each gap, proposes test cases: a descriptive test name plus what it verifies, grouped per file.
- Asks for approval, then writes the approved tests. Before writing, it reads existing `*.spec.ts`
  files next to the target to follow the project's conventions (TestBed setup, mocking style, naming).
- After writing, runs the affected tests and reports the new coverage for those files.

### 2. Stop hook (automatic, opt-in)

- Runs at the end of a Claude Code turn. Must be cheap: no test run, no coverage run.
- Checks which `.ts` source files were changed in the working tree without a matching
  change or creation of a `.spec.ts` file.
- If any, prints a short notice listing them and suggesting `/coverage-check`. Otherwise silent.
- Can be disabled via config.

### 3. Configuration

Optional `coverage-guard.config.json` in the target project root:

- `threshold` — line coverage required for changed files (default: 80)
- `baseBranch` — branch to diff against (default: detect `main` / `master`)
- `exclude` — globs to skip (default: `*.module.ts`, `main.ts`, `environments/**`, `*.routes.ts`)
- `hook` — `true` / `false` (default: `true`)

If the project already defines coverage thresholds in its Vitest / Angular config, those win.

## Out of scope for v1

- Cypress / e2e coverage
- Karma, Jasmine and Jest projects (planned for v2: many legacy Angular apps still run Karma)
- CI integration (GitHub Action)
- Mutation testing

## Repo layout (proposal, verify against current Claude Code plugin docs)

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   so the repo can be added as a plugin marketplace
skills/coverage-check/SKILL.md    the /coverage-check workflow
hooks/hooks.json                  Stop hook registration
scripts/                          Node scripts (ESM, zero runtime dependencies)
examples/demo-app/                small Angular app with Vitest and deliberately partial coverage
docs/brief.md                     this file
```

## Open technical questions (investigate before implementing)

1. How Angular's Vitest integration runs coverage in the current Angular version:
   `ng test --coverage` through the unit-test builder vs calling Vitest directly.
   Which one produces a machine-readable report, and where.
2. How to run coverage for a subset of files (changed files only) without running the whole suite.
3. Exact plugin manifest, marketplace and hook formats in the current Claude Code docs.
4. Whether the Stop hook can get the list of files changed in the current session,
   or should fall back to `git status`.

## Definition of done for v1

- Works end to end on `examples/demo-app`: detects the gaps, proposes tests, writes approved tests,
  coverage goes up.
- Installs in a fresh Angular project via `/plugin marketplace add` from this GitHub repo.
- README in English: problem, install, usage, example output (screenshot or GIF), config, limitations.
- No code, names, selectors or structure taken from any employer or client project.
