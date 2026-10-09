# angular-coverage-guard

A [Claude Code](https://claude.com/claude-code) plugin that keeps unit test coverage honest in
Angular + Vitest projects. It finds code that isn't covered by tests, explains what's missing,
proposes concrete test cases, and writes those tests only after you approve them.

## Problem

It's easy for test coverage to quietly rot on a real project: a service picks up a new branch, a
guard gets a new rule, and the spec file next to it never gets touched. Coverage tools report a
percentage, but percentages don't tell you *which* gap matters — a guard with no test at all is a
bigger risk than a presentational component missing one branch. This plugin is built for a
front-end developer (often the only one on the team) who wants that checked automatically, without
spinning up a CI pipeline for it.

## Install

```
/plugin marketplace add kacperpll/angular-coverage-guard
/plugin install angular-coverage-guard@angular-coverage-guard-marketplace
```

Requirements on the machine running Claude Code: **Node >= 22.20.0** (the plugin's own scripts use
`node:path`'s `path.matchesGlob`, stable from that version). The target Angular project itself needs
**Angular 21+** with its Vitest-based unit-test builder (`@angular/build:unit-test`, the default test
runner since that version) — see [Limitations](#limitations) for what that rules out.

## Usage

### `/angular-coverage-guard:coverage-check`

Run it from a chat turn in Claude Code, inside (or above) an Angular project. Claude Code namespaces
skill commands by plugin, so this is the name to type — a bare `/coverage-check` won't resolve:

```
/angular-coverage-guard:coverage-check              # changed files vs. the base branch, plus uncommitted changes
/angular-coverage-guard:coverage-check --all        # the whole project
/angular-coverage-guard:coverage-check src/app/foo  # a specific file or directory
```

If it can't find the Angular project on its own, or finds more than one, it'll ask which directory
or named project to use (`--project-dir`/`--project`) rather than guess.

It will:

1. Find the Angular project (searching upward from where you are, then downward, if needed — see
   [Example output](#example-output)).
2. Run the project's tests with coverage, scoped to just the relevant files.
3. List the gaps, prioritized by **risk** rather than by percentage: guards, interceptors and
   resolvers first, then services/pipes/utils, then components — and within components,
   logic-bearing ones before purely presentational ones. A file with no spec at all is reported as
   exactly that, not as "0% covered" (it may be exercised indirectly elsewhere).
4. Also surface **branch gaps**: a file can meet the line-coverage threshold while one specific
   business-rule branch (a bulk-discount `if`, a 401-handling `if`, …) is never exercised. These
   don't show up by percentage alone, so they're reported separately.
5. Propose test cases per gap — after reading the file and any existing sibling specs, so new tests
   match the project's own `TestBed` setup, mocking style, and naming conventions.
6. Ask for approval (you can approve some proposals and not others) before writing anything.
7. Write only what you approved, then re-run coverage scoped to just those files and report the new
   numbers.

### Stop hook (automatic, on by default)

At the end of a turn, a lightweight hook checks whether any `.ts` source file changed in the working
tree without its sibling `.spec.ts` also changing — no test run, just a `git` diff and a file check.
If it finds any, it prints a short, non-blocking notice suggesting
`/angular-coverage-guard:coverage-check`; otherwise it
stays silent. It only repeats the notice when the set of flagged files actually changes, so it won't
nag every turn about the same gap. Disable it per project via `coverage-guard.config.json` (below).

## Example output

From a real `/angular-coverage-guard:coverage-check --all` run against this repo's own example app:

| File | Tier | Status |
|---|---|---|
| `src/app/guards/auth.guard.ts` | 1 (guard) | no dedicated spec |
| `src/app/interceptors/auth.interceptor.ts` | 1 (interceptor) | 50% lines, 0% branches — uncovered lines 11, 12, 15 |
| `src/app/resolvers/book.resolver.ts` | 1 (resolver) | no dedicated spec |
| `src/app/pipes/truncate.pipe.ts` | 2 (pipe) | no dedicated spec |
| `src/app/utils/array.util.ts` | 2 (util) | no dedicated spec |

Plus a **branch gap** that the table above wouldn't catch — `price-calculator.service.ts` meets the
80% line threshold, but its one real business rule is never exercised:

> line 23: `if (quantity >= this.config.bulkThreshold) {`

Test proposed for it: *applies the bulk discount when quantity meets the bulk threshold* (using a
quantity exactly equal to `bulkThreshold`, testing the `>=` boundary itself). After approval and
writing it, that file went from 90%/88.88% to 100%/100%.

The full session — the complete gaps table, the branch-gaps section, every test proposal, and the
coverage after writing and verifying them — is in
[`docs/examples/demo-run.md`](docs/examples/demo-run.md).

## Configuration

Optional `coverage-guard.config.json` in the target project's root:

| Field | Default | Meaning |
|---|---|---|
| `threshold` | `80` | Line coverage percentage required for a file to not be flagged. Overridden by the Angular project's own `coverageThresholds.lines` in `angular.json`, if set. |
| `baseBranch` | auto-detect (`main`, then `master`) | Branch to diff against in the default (changed-files) scope. |
| `exclude` | `*.module.ts`, `main.ts`, `environments/**`, `*.routes.ts`, `app.config*.ts` | Glob patterns to skip. **Merges with** these defaults — it doesn't replace them. |
| `hook` | `true` | Set to `false` to disable the Stop hook for this project. |

## How it decides what to test first

Files are classified by **content**, not filename, so this works whether your project uses the
classic `*.guard.ts`-style suffixes or Angular's newer, concise file-naming style:

1. **Guards, interceptors, resolvers** — `CanActivateFn`/`implements CanActivate`,
   `HttpInterceptorFn`/`implements HttpInterceptor`, `ResolveFn`/`implements Resolve`.
2. **Services, pipes, directives, utils/helpers** — `@Injectable`, `@Pipe`, `@Directive`, or a path
   under `utils/`/`helpers/`.
3. **Components** — everything else, mostly `@Component`. Within this tier, a component that injects
   dependencies or subscribes to something sorts before one that doesn't (a signal-only,
   `input()`-driven presentational component).

Filename suffixes (`*.guard.ts`, etc.) are only a fallback when none of the content signals above
match.

## Limitations

- **Vitest only.** Karma/Jasmine/Jest Angular projects aren't supported in v1 — the plugin detects
  Karma and reports a clear error instead of guessing.
- **Single Angular project per run.** A workspace with several named projects in one `angular.json`
  needs `--project <name>`; several separate `angular.json` directories need `--project-dir <path>`.
- No Cypress/e2e coverage, no CI integration, no mutation testing — all out of scope for v1.
- A scoped test run's coverage numbers reflect only the files included in that run, not the whole
  project's coverage.
- Branch-gap detection reads raw `lcov.info` branch data, which can include compiler-generated
  instrumentation (a branch attributed to a class declaration or a bare decorator line) alongside
  real, untested business logic. Branches on a class-declaration or `@Pipe`/`@Component`/
  `@Injectable`/`@Directive` line are filtered out by pattern on the source snippet; this is a
  heuristic, not a parse of the compiled output, so an unusual case could still slip through either
  direction.
- Built and end-to-end tested on Windows. The unit test suite (`npm test`) also runs clean on Linux,
  and path handling is written to be platform-independent, but the full flow (spawning `ng`, the
  Stop hook) hasn't been exercised end to end on macOS/Linux yet.

## Roadmap

- **Karma/Jasmine support** — the next priority. A lot of existing Angular apps still run Karma and
  won't migrate to Vitest just to use this plugin.
- E2E (Cypress) coverage, after that.

## About

Built by Kacper Duniewicz, a front-end lead specializing in Angular modernization and test
coverage. Available for contract work: [linkedin.com/in/kacper-duniewicz](https://linkedin.com/in/kacper-duniewicz)

## License

[MIT](LICENSE)
