# angular-coverage-guard — v1 implementation plan

## Context

The repo is currently just the brief, README, LICENSE and instruction files — no code exists yet.
`docs/brief.md` lists four "open technical questions" that must be resolved before implementation
starts, because they determine the shape of the scripts and the hook. This plan closes those
questions with researched, cited answers, and turns the brief's proposed scope into a concrete
file-by-file v1 design. A first draft of this plan was reviewed and corrected by the user; this
version incorporates those corrections (narrower v1 scope, Windows-first invocation, a mandatory
empirical checkpoint before building on top of `ng test --include`, and a thin end-to-end slice
before modularizing), plus a second round of corrections on git path handling relative to a nested
project root, untracked-file visibility, shell-free CLI invocation, and hook notice de-duplication
(see "Windows-specific handling" and the `hooks/check-coverage.mjs` responsibility below).

## Answers to the brief's open technical questions

**1–2. Angular/Vitest coverage & scoping to changed files**
- Angular v21 (Nov 2025) made Vitest the default runner via the `@angular/build:unit-test`
  builder, which wraps Vitest's Node API in-memory from `angular.json` — it does not shell out to
  a plain Vitest CLI/config. `ng test --coverage` uses `@vitest/coverage-v8`; reports land in
  `coverage/` at the project root.
- The default reporter set when passing bare `--coverage` is **not confirmed** to include
  `json-summary`. The plugin must always pass `--coverage-reporters=json-summary
  --coverage-reporters=lcov` explicitly rather than rely on defaults.
- `--include` accepts source file paths and resolves them to the matching spec file, or directory
  paths for contained specs — no confirmed pass-through of Vitest's own `--changed`/`--related`
  flags through `ng test`. **v1 approach:** compute changed files via git ourselves, map each to
  its spec path, invoke `ng test --coverage --coverage-reporters=json-summary
  --coverage-reporters=lcov --include <spec paths> --watch=false`. **This is the single biggest
  unverified assumption in the plan and is now a hard checkpoint (see Sequencing, step 2) — no
  code is written against its output shape until the user has reviewed the actual empirical
  result.** Fallback if it doesn't hold: bypass `ng test` and call `vitest run --coverage` directly
  via a generated minimal config, isolated entirely inside `lib/test-runner.mjs`.
- A filtered/partial run only reports coverage for files actually exercised by that run — this
  must be stated in output, not presented as whole-project coverage.
- Existing thresholds live in `angular.json`'s test target `coverageThresholds`. **v1 only reads
  the global `lines` threshold** (not `perFile`, not statements/branches/functions) — matches the
  config's own `threshold` field, which is line-coverage only. If present, it wins over the config
  file's `threshold`.

**3. Plugin/marketplace/hook manifest formats (current, Sept 2026)**
- `.claude-plugin/plugin.json`: only `name` required; `skills/`, `commands/`, `hooks/hooks.json`
  are auto-discovered by convention. **`hooks.json` and the hook script live under `hooks/` at the
  repo root, not inside `.claude-plugin/`** — `.claude-plugin/` holds only `plugin.json` and
  `marketplace.json`.
- `.claude-plugin/marketplace.json`: requires `name`, `owner.name`, `plugins[]` (`name` + `source`).
  A single-plugin marketplace pointing `source: "./"` at this repo's root is sufficient for
  `/plugin marketplace add <owner>/<repo>`.
- `/coverage-check` is a **Skill** (`skills/coverage-check/SKILL.md`) with **`disable-model-invocation: true`**
  — it only runs on the explicit `/coverage-check` command. The automatic, low-cost nudge is the
  Stop hook's job; the skill (which runs real tests) stays strictly on-demand, matching the brief's
  "on demand" wording for section 1 and keeping the two mechanisms cleanly separated.
- Hooks: `hooks/hooks.json`, `Stop` event, command:
  `node "${CLAUDE_PLUGIN_ROOT}/hooks/check-coverage.mjs"` — invoked via `node` explicitly (not a
  bare script path) so it runs the same way on Windows, where shebangs aren't respected and `.mjs`
  files aren't directly executable. Hook file is `.mjs` for consistency with the rest of the
  scripts (all Node ESM).
- Stop hook output, to show a short notice **without blocking the turn from ending**: exit 0 and
  emit only `{"systemMessage": "..."}` on stdout — omit `decision`/`reason` entirely (those are
  for forcing Claude to keep going, which we never want here). Exit code 2 would block the Stop
  event and force continuation — must never be used by this hook. Silent success = exit 0, no
  output. Source: https://code.claude.com/docs/en/hooks ("JSON output" common fields, "Stop
  decision control", "Exit code 2 behavior per event").
- Model structure after `anthropics/claude-code`'s `plugins/hookify/` and
  `plugins/plugin-dev/skills/hook-development/SKILL.md`.

**4. Stop hook and session file list**
- Confirmed: no Stop-hook payload field lists files changed during the session. The hook falls
  back to git, run with `cwd` set to the Angular project root (from the hook's stdin `cwd` field,
  walked up to find `angular.json`): `git diff --relative --name-only` (unstaged),
  `git diff --cached --relative --name-only` (staged), and `git ls-files --others --exclude-standard`
  (untracked, listed individually, already relative to cwd) — see "Windows-specific handling" for
  why `git status --porcelain` alone isn't used. The hook checks `stop_hook_active` first and
  no-ops if true, to avoid loop risk.
- A source `.ts` file only counts as "covered" if its sibling `.spec.ts` is **itself also in the
  working-tree change set** — not merely present on disk. Catches source changes whose existing
  spec wasn't updated.

## Decisions locked in with the user (final)

- `exclude` in `coverage-guard.config.json` **merges** with the built-in defaults.
- Stop hook requires the spec to be part of the change set, not just present on disk.
- **`/coverage-check` skill is explicit-only** (`disable-model-invocation: true`) — supersedes an
  earlier draft answer that allowed auto-triggering; the hook is the only automatic surface.
- **Single-project `angular.json` only** in v1. Multiple projects → clear error asking the user to
  pass `--project <name>`; `coverage-check.mjs` accepts a `--project` flag.
- **Global `lines` threshold only** — no `perFile`.
- **3 risk tiers**, not 6 (see heuristic below).
- Use Node's built-in **`path.matchesGlob`** instead of a hand-written glob matcher — see research
  below for the version requirement this implies.
- **Windows is the primary dev platform.** Hook invocation, `ng` invocation, and path handling are
  all designed Windows-first (see "Windows-specific handling" below), not as an afterthought.

## Additional research for the corrected plan

**`path.matchesGlob(path, pattern)`** — stable (not experimental) as of Node **v24.8.0 / v22.20.0**;
existed as experimental from v22.5.0/v20.17.0. To rely on it as stable API, the plugin's own
`package.json` sets `"engines": { "node": ">=22.20.0" }`. Glob syntax is bash-like (via minimatch):
supports `**`, brace expansion, extglob, character classes. **Patterns are always split on `/`
regardless of platform** — a pattern built with forward slashes works correctly on Windows without
normalization. (Source: nodejs.org/api/path.html, fs.md "Glob patterns" section.) Risk noted: this
Node version floor is stricter than some environments might have installed; if that proves a
blocker in practice, the fallback is a small hand-written matcher — not needed unless it comes up.

## File tree (v1)

```
package.json                     # "type": "module", "engines": { "node": ">=22.20.0" }, zero deps

.claude-plugin/
  plugin.json
  marketplace.json

skills/coverage-check/
  SKILL.md                       # disable-model-invocation: true

hooks/
  hooks.json                     # Stop -> node "${CLAUDE_PLUGIN_ROOT}/hooks/check-coverage.mjs"
  check-coverage.mjs             # Stop hook entrypoint — cheap, git-status based only

scripts/
  coverage-check.mjs             # CLI orchestrator: analysis (invoked by SKILL.md)
  verify-written-tests.mjs       # CLI orchestrator: post-write verification (invoked by SKILL.md)
  lib/
    git.mjs                      # changed-file computation, base-branch detection (paths as posix)
    config.mjs                   # coverage-guard.config.json loading + precedence resolution
    angular-project.mjs          # angular.json discovery, runner detection, existing lines threshold,
                                  # single-project enforcement + --project flag support
    exclude.mjs                  # thin wrapper over path.matchesGlob, merges user globs w/ defaults
    spec-finder.mjs              # source<->spec path mapping, sibling spec discovery
    test-runner.mjs              # invokes ng (Windows-safe resolution), locates coverage report
                                  # (isolates the --include risk; fallback lives here only)
    coverage-parser.mjs          # parses coverage-summary.json (pct) + lcov.info (line/branch detail)
    risk.mjs                     # 3-tier classification + hasLogicSignal + sort
    report.mjs                   # assembles the JSON printed to stdout
  __fixtures__/                  # fixtures derived from demo-app + the checkpoint's real output
  *.test.mjs                     # node:test unit tests per lib module — added AFTER the thin slice works

examples/demo-app/                # generic book-catalog domain, modern Angular, partial coverage
  angular.json                    # global coverageThresholds.lines only (no perFile)
  package.json                    # @vitest/coverage-v8 devDependency, npm
  coverage-guard.config.json      # non-default threshold + one exclude entry, proves merge semantics
  README.md                       # how to reset demo-app to its gapped state after manual runs
  src/app/
    guards/auth.guard.ts                          # functional guard (CanActivateFn + inject()), no spec
    interceptors/auth.interceptor.ts               # functional interceptor, partial spec (missing 401 branch)
    interceptors/auth.interceptor.spec.ts
    resolvers/book.resolver.ts                     # functional resolver (ResolveFn + inject()), no spec
    services/price-calculator.service.ts           # inject()-based deps, partial spec (missing discount branch)
    services/price-calculator.service.spec.ts
    pipes/truncate.pipe.ts                         # standalone pipe, no spec
    utils/array.util.ts                            # no spec
    components/book-list/book-list.component.ts    # standalone, inject(), subscribes — logic signal present
    components/book-list/book-list.component.spec.ts
    components/badge/badge.component.ts            # standalone, signal input() only, no inject/subscribe
    components/badge/badge.component.spec.ts
    app.routes.ts                                  # excluded by default exclude glob

docs/brief.md
README.md                        # expanded last, once behavior is stable
```

## Windows-specific handling

- **Hook invocation**: `hooks/hooks.json` calls `node "${CLAUDE_PLUGIN_ROOT}/hooks/check-coverage.mjs"`
  explicitly through `node`, never relies on the file being directly executable.
- **Running `ng`, without a shell**: `spawnSync(process.execPath,
  [path.join(projectRoot, 'node_modules/@angular/cli/bin/ng.js'), ...args], { cwd: projectRoot })`
  — invoking the local CLI's JS entrypoint directly through `node`, not through `ng`/`ng.cmd`. No
  `shell: true`, no `.cmd`/`.ps1` resolution, no Node `DEP0190` warning, no path-quoting issues when
  the project path contains spaces (common on Windows, e.g. under `C:\Users\<name> <surname>\...`).
  Fallback (local `ng.js` not found) tries a global `ng` on `PATH` as a last resort only.
- **Git paths relative to the Angular project root, not the repo root**: git reports paths relative
  to the repo root by default, but `examples/demo-app` (and any real target project) is typically
  not the repo root. `--relative` is a `git diff` option, **not** a global/`status` option, so
  `git.mjs` does not use `git status` at all. Instead it spawns three commands with the process
  `cwd` set to the Angular project root (not `git -C`, plain `cwd` on `spawnSync`):
  `git diff --relative --name-only` (unstaged modifications/deletions),
  `git diff --cached --relative --name-only` (staged changes), and
  `git ls-files --others --exclude-standard` (untracked files — this is already cwd-relative by
  default, no `--relative` needed/available for it). The union of these three is "working-tree
  changes." For the base-branch diff (`/coverage-check`'s default scope) the same `--relative`
  treatment applies: `git diff --relative --name-only <baseBranch>...HEAD`.
- **Untracked files**: `git ls-files --others --exclude-standard` lists every untracked file
  individually (respecting `.gitignore`), unlike `git status --porcelain`, which collapses a new
  untracked directory into a single line for the directory — invisible to per-file matching. This
  is the reason `git.mjs` uses `ls-files` for untracked files instead of `status`.
- **Path separators**: git output (even with `--relative`) always uses forward slashes regardless of
  OS. Anything derived from `fs` traversal (e.g. sibling-spec discovery) is normalized to forward
  slashes (`path.relative(...).split(path.sep).join('/')`) before being compared against git-diff
  paths or passed to `path.matchesGlob`, so the two sources of paths are always comparable and glob
  patterns can be written with `/` unconditionally.

## Module responsibilities

All `scripts/lib/*.mjs` are Node ESM, zero runtime dependencies, and are the shared library that
both CLI orchestrators and the hook import.

- **`git.mjs`** — `detectBaseBranch`, `getChangedFiles` (union of `git diff --relative --name-only
  <baseBranch>...HEAD`, `git diff --relative --name-only`, `git diff --cached --relative --name-only`,
  and `git ls-files --others --exclude-standard`, all spawned with `cwd` set to the Angular project
  root so output is relative to it, not the repo root — matters since `examples/demo-app` is nested
  inside this repo), `getWorkingTreeChangedFiles` (hook's cheap path: same three non-base-branch
  commands, no base-branch comparison).
- **`config.mjs`** — loads `coverage-guard.config.json` (never throws on missing/malformed, returns
  a warning instead), merges with defaults and `angular-project.mjs`'s line threshold.
- **`angular-project.mjs`** — finds `angular.json`, detects `vitest`/`karma`/`unknown` (Karma →
  graceful error, out of scope for v1), reads the existing global `coverageThresholds.lines`,
  **enforces single-project** (errors with a message pointing at `--project <name>` if more than
  one project exists and none was specified).
- **`exclude.mjs`** — merges user globs with defaults, matches via `path.matchesGlob`.
- **`spec-finder.mjs`** — source→spec path mapping, sibling spec discovery for convention-reading.
- **`test-runner.mjs`** — spawns the local Angular CLI directly via `process.execPath` +
  `node_modules/@angular/cli/bin/ng.js` (no shell, see "Windows-specific handling") with the flags
  from question 1–2; owns the `--include` assumption and its fallback; never imported by the hook.
- **`coverage-parser.mjs`** — reads `coverage-summary.json` for per-file %, `lcov.info` for specific
  uncovered line/branch numbers.
- **`risk.mjs`** — 3-tier classification + `hasLogicSignal` detection + sort (see below).
- **`report.mjs`** — assembles the stable JSON schema printed to stdout for both orchestrators.
- **`hooks/check-coverage.mjs`** — reads stdin JSON, checks `stop_hook_active` first, walks up from
  `cwd` looking for `angular.json`; if none found, exits 0 silently (not an Angular project — most
  Claude Code sessions won't be). Otherwise checks `config.hook`, computes working-tree changed
  `.ts` files, flags any whose sibling `.spec.ts` is not itself in the change set. Compares the
  flagged-file set against a small state file in `os.tmpdir()` keyed by `session_id` (from the
  hook's stdin payload); emits `{"systemMessage": "..."}` and exits 0 **only if the set changed**
  since the last recorded state for this session, updating the state file either way — this avoids
  repeating the same notice every single turn while the same gaps remain unaddressed. Only imports
  `git.mjs`, `config.mjs`, `exclude.mjs`, `spec-finder.mjs` — never `test-runner.mjs` or
  `coverage-parser.mjs`. Fails open (catches all errors, exits 0).

## Risk heuristic (`lib/risk.mjs`) — 3 tiers

1. **Tier 1** — `*.guard.ts`, `*.interceptor.ts`, `*.resolver.ts` (gatekeeping/routing logic).
2. **Tier 2** — `*.service.ts`, `*.pipe.ts`, `/utils/`, `/util/`, `/helpers/` paths or
   `*.util(s).ts`/`*.helper.ts`, `*.directive.ts`, `*.validator(s).ts`, state files
   (`*.reducer.ts`, `*.effects.ts`, `*.selectors.ts`, `*.store.ts`).
3. **Tier 3** — everything else, primarily `*.component.ts`.

**`hasLogicSignal(fileContents)`** — text-scan for `inject(`, constructor-injected params,
`subscribe(`, `Subject`, `Observable`, `effect(`, `computed(`. Used as a secondary sort key inside
tier 3 so smart/container components (signal present) sort before purely presentational ones
(signal absent) — this is how "presentational last" is achieved without a dedicated extra tier.

**Sort**: tier ascending → `hasLogicSignal` descending (true first) → line coverage % ascending
(worst-covered first) → path alphabetically.

`*.module.ts`, `main.ts`, `environments/**`, `*.routes.ts` are handled by `exclude.mjs` defaults
and never reach classification in the normal case.

## Config resolution order

1. **threshold**: `angular.json` global `coverageThresholds.lines` > config file `threshold` > default `80`
2. **baseBranch**: config file > auto-detected (`main` then `master`, local before `origin/*`) > hard error
3. **exclude**: config file globs **merged** with built-in defaults, matched via `path.matchesGlob`
4. **hook**: config file `hook` > default `true`
5. **scope** (CLI arg: changed-files default / path / `--all`) and **`--project`** are orthogonal —
   they only select which files/project get analyzed, never affect 1–4

## SKILL.md flow (`skills/coverage-check/SKILL.md`, `disable-model-invocation: true`)

1. Parse optional args (path / `--all` / `--project <name>`), default to changed-files mode.
2. Locate project root (`angular.json`); stop with a plain message if not found, or if multiple
   projects exist and `--project` wasn't given (surfaces `angular-project.mjs`'s error verbatim).
3. Run `scripts/coverage-check.mjs` via Bash, parse its JSON.
4. On script error (Karma detected, no git repo, run failure) relay the message, stop.
5. Present a summary table in the risk-priority order the script already returns.
6. **[Claude]** Read each below-threshold file's actual source to understand the uncovered lines/branches.
7. **[Claude]** Read sibling `*.spec.ts` files first to match existing TestBed/mocking/naming
   conventions; if none exist, fall back to idiomatic conventions and say so.
8. **[Claude]** Propose test cases per file (name + what it verifies), grouped per file, risk order.
9. Ask for approval explicitly; support partial approval.
10. Write only approved tests, following CLAUDE.md's Angular conventions where relevant.
11. Run `scripts/verify-written-tests.mjs` on the written spec files, report new coverage, note
    explicitly it reflects only the scoped run.
12. On verification failure, show it and stop — no silent retries.

## Sequencing (revised — thin slice before modularizing, hard checkpoint after step 2)

1. **Scaffolding** — `package.json`, `plugin.json`, `marketplace.json`, `hooks/hooks.json` skeleton
   (hook script can be a stub that just exits 0). Smoke-test `/plugin marketplace add` + local
   install, independent of everything else.
2. **`examples/demo-app` + empirical verification.** Build a minimal modern-Angular demo app
   (standalone, `input()` signal inputs, `inject()`), enough to have at least one clear gap (e.g.
   the guard with no spec). Manually run, from its root:
   `ng test --coverage --coverage-reporters=json-summary --coverage-reporters=lcov --include <paths>
   --watch=false` (and the Windows-safe invocation path from `test-runner.mjs`'s design) and record
   the **actual** observed behavior.
   **STOP HERE.** Report back to the user: the exact command used, where the coverage report lands
   on disk, its exact shape (`coverage-summary.json` structure, whether `lcov.info` is produced),
   and the exit code in both pass/fail-threshold cases. Do not proceed to step 3 without explicit
   approval — if `--include` doesn't behave as assumed, the `vitest run` fallback is decided and
   confirmed here, before anything else is built.
3. **Thin vertical slice** (only after checkpoint approval): a minimal `git.mjs` (changed files
   only), a minimal `coverage-check.mjs` that calls `test-runner.mjs` directly and
   `coverage-parser.mjs` (json-summary only, no lcov yet), a minimal `report.mjs`, and a minimal
   `SKILL.md`. Run `/coverage-check` end-to-end on `examples/demo-app` for real: gap detected, test
   proposed by Claude, approved, written, verified. This proves the whole loop works before any
   further investment.
4. **Modularize + harden**, now that the shape is proven: expand `angular-project.mjs`
   (single-project enforcement, `--project`), `exclude.mjs` (`path.matchesGlob`, merge semantics),
   `risk.mjs` (3-tier + `hasLogicSignal`), `spec-finder.mjs`, `coverage-parser.mjs` (add lcov
   line/branch detail), `report.mjs` (full schema). Add `node:test` unit tests per module against
   fixtures captured from step 2/3's real output — not guessed schemas.
5. **`verify-written-tests.mjs`** as its own orchestrator (distinct input/output shape from
   `coverage-check.mjs`).
6. **`hooks/check-coverage.mjs`** full implementation: `systemMessage`-based non-blocking notice,
   `stop_hook_active` guard, spec-must-be-in-changeset check, Windows-safe invocation. Test with
   synthetic stdin payloads against demo-app in various dirty-tree states (source+spec both
   changed, source only, spec-only, clean, `hook: false`).
7. **`SKILL.md` finalized** per the full flow above (still `disable-model-invocation: true`).
8. **End-to-end validation** per the brief's definition of done: full `/coverage-check` (changed
   files default, a path arg, `--all`, `--project` on a forced multi-project case), Stop hook
   opt-in/opt-out, fresh install via `/plugin marketplace add <owner>/<repo>` into a project outside
   this repo, and everything re-checked on Windows specifically (hook invocation, local `ng.js`
   resolution via `process.execPath`, path handling).
9. **README** — install/usage/config/limitations, screenshot or GIF — last.

## Verification

- **Hard checkpoint after step 2** — empirical `ng test --include` results reviewed and approved by
  the user before any further code is written.
- Manual end-to-end `/coverage-check` run against `examples/demo-app` at the end of step 3 (thin
  slice), before investing in modularization.
- `node:test` unit tests per `lib/` module, added in step 4, using fixtures from real command output.
- Stop hook exercised across the dirty-tree states listed in step 6.
- Full end-to-end run of `/coverage-check` inside `examples/demo-app` per the brief's definition of
  done, plus the multi-project `--project` error path.
- Fresh-install smoke test via `/plugin marketplace add` into a project outside this repo.
- Windows-specific pass: hook fires correctly, the local `node_modules/@angular/cli/bin/ng.js` is
  found and runs via `process.execPath` without a shell, and there are no path-separator mismatches
  between git output and fs-derived paths.
