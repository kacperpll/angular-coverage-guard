# `/coverage-check --all` on `examples/demo-app` — a recorded run

This is a real run against this repo's own demo app, kept as reference material for the README.
`examples/demo-app` is deliberately left in a partially-covered state; running `/coverage-check`
against it resets nothing — this file is what Claude Code reported, test proposals it made, and the
coverage after writing and approving the proposed tests.

## Command

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage-check.mjs" --project-dir examples/demo-app --all
```

`projectRootSource: "explicit"` — the project directory was given directly. Left to auto-discovery
(no `--project-dir`, run from this repo's root), the script finds `examples/demo-app` on its own via
the downward search and reports `"downward"` instead.

## Gaps found

Threshold: 80% lines. Risk order (tier ascending, logic-signal-bearing files first within a tier,
worst-covered first):

| File | Tier | Status |
|---|---|---|
| `src/app/guards/auth.guard.ts` | 1 (guard) | no dedicated spec |
| `src/app/interceptors/auth.interceptor.ts` | 1 (interceptor) | 50% lines, 0% branches — uncovered lines 11, 12, 15 |
| `src/app/resolvers/book.resolver.ts` | 1 (resolver) | no dedicated spec |
| `src/app/pipes/truncate.pipe.ts` | 2 (pipe) | no dedicated spec |
| `src/app/utils/array.util.ts` | 2 (util) | no dedicated spec |

Files not listed here (`price-calculator.service.ts`, `book-list.component.ts`, `app.component.ts`,
`badge.component.ts`) all meet the 80% line threshold. `app.config.ts` is excluded by default
(pure DI wiring, not worth flagging).

## Branch gaps

A file can meet the line threshold while one specific business-rule branch is never exercised. This
run found exactly one:

| File | Tier | Uncovered branch |
|---|---|---|
| `src/app/services/price-calculator.service.ts` | 2 (service, 90% lines) | line 23: `if (quantity >= this.config.bulkThreshold) {` |

This is the service's only real decision point (the bulk-discount rule) — it meeting the line
threshold said nothing about whether that rule was ever tested.

## Test proposals (as presented, with the user's amendments)

**`auth.guard.ts`** (new `auth.guard.spec.ts`)
- redirects to `/` and returns false when there is no token query param
- returns true when a token query param is present

**`auth.interceptor.ts`** (extends the existing `auth.interceptor.spec.ts`)
- navigates to `/` and rethrows on a 401 response — covers the previously-uncovered branch
- rethrows without navigating on a non-401 error

**`book.resolver.ts`** (new `book.resolver.spec.ts`)
- resolves a book using the route's id param
- falls back to `"unknown"` id when the route has no id param

**`truncate.pipe.ts`** (new `truncate.pipe.spec.ts`)
- returns the value unchanged when it is at or under maxLength
- truncates and appends an ellipsis when the value exceeds maxLength
- uses the default maxLength of 20 when none is provided
- *(added on review)* throws given a `null` value, e.g. from `value | async | truncate` before the
  first emission — demonstrates a real gap (the pipe's signature assumes a `string`) without
  "fixing" the pipe to pass the test

**`array.util.ts`** (new `array.util.spec.ts`)
- `chunk`: splits items into groups of the given size, with an uneven last group
- *(added on review)* `chunk`: returns an empty array when given an empty array
- `chunk`: throws when size is not greater than zero
- `unique`: removes duplicate values while preserving order

**`app.config.ts`** — skipped. Pure `ApplicationConfig` provider wiring, no logic to unit test.

## Verification after writing the approved tests

| File | Lines | Branches |
|---|---|---|
| `auth.guard.ts` | 100% | 100% |
| `auth.interceptor.ts` | 100% | 100% |
| `book.resolver.ts` | 100% | 100% |
| `truncate.pipe.ts` | 100% | 75% |
| `array.util.ts` | 100% | 100% |

`truncate.pipe.ts`'s remaining branch gap (75%) sits on its class declaration line, not inside
`transform()` — an artifact of the pipe being instantiated directly (`new TruncatePipe()`) rather
than through Angular's DI factory, not a missing test for actual logic. Not chased further.

`examples/demo-app` is reset back to its original gapped state right after this recorded run — the
tests above were written, verified, and then removed so the demo keeps demonstrating real gaps for
the next person who tries the plugin.
