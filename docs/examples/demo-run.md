# `/angular-coverage-guard:coverage-check --all` on `examples/demo-app` — a recorded run

This is one real `/angular-coverage-guard:coverage-check --all` session against this repo's own
demo app, kept as reference material for the README. `examples/demo-app` is deliberately left in a
partially-covered state; the tests proposed and written below were removed again right after this
session so the demo keeps demonstrating real gaps for the next person who tries the plugin.

## Command

```
/angular-coverage-guard:coverage-check --all
```

No project directory was given — the skill let `coverage-check.mjs` auto-discover it.
`projectRootSource: "downward"` in the script's output: it searched upward from the current
directory first, found nothing, then found exactly one `angular.json` searching downward and used
`examples/demo-app`.

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
`badge.component.ts`) all meet the 80% line threshold. `app.config.ts` is excluded by default (pure
DI wiring, not worth flagging).

## Branch gaps

A file can meet the line threshold while one specific business-rule branch is never exercised. This
run found exactly one:

| File | Tier | Uncovered branch |
|---|---|---|
| `src/app/services/price-calculator.service.ts` | 2 (service, 90% lines) | line 23: `if (quantity >= this.config.bulkThreshold) {` |

This is the service's only real decision point (the bulk-discount rule) — meeting the line threshold
said nothing about whether that rule was ever tested.

## Test proposals (as presented, with the user's amendments)

**`auth.guard.ts`** (new `auth.guard.spec.ts`) — the guard now returns a `UrlTree` from
`router.createUrlTree(['/'])` instead of calling `navigate()` and returning `false`:
- returns a `UrlTree` to `/` when there is no token query param
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
- *(added in review)* throws given a `null` value, e.g. from `value | async | truncate` before the
  first emission — demonstrates a real gap (the pipe's signature assumes a `string`) without
  "fixing" the pipe to pass the test

**`array.util.ts`** (new `array.util.spec.ts`)
- `chunk`: splits items into groups of the given size, with an uneven last group
- *(added in review)* `chunk`: returns an empty array when given an empty array
- `chunk`: throws when size is not greater than zero
- `unique`: removes duplicate values while preserving order

**`price-calculator.service.ts` — branch gap** (extends `price-calculator.service.spec.ts`):
- applies the bulk discount when quantity meets the bulk threshold — *(amended in review to use a
  quantity exactly equal to `bulkThreshold`, testing the `>=` boundary itself, not a value past it)*

**`app.config.ts`** — skipped. Pure `ApplicationConfig` provider wiring, no logic to unit test.

## Verification after writing the approved tests

| File | Lines | Branches |
|---|---|---|
| `auth.guard.ts` | 100% | 100% |
| `auth.interceptor.ts` | 100% | 100% |
| `book.resolver.ts` | 100% | 100% |
| `array.util.ts` | 100% | 100% |
| `price-calculator.service.ts` | 100% | 100% — the branch gap is closed |
| `truncate.pipe.ts` | 100% | 75% |

`truncate.pipe.ts`'s remaining branch gap sits on its class declaration line
(`export class TruncatePipe implements PipeTransform {`), not inside `transform()` — this is what the
skill's branch-gap judgment call looks like in practice: the snippet is plain class boilerplate, not
an `if`/`?:`/`&&`/`||`, so it's compiler-generated instrumentation from the pipe being instantiated
directly (`new TruncatePipe()`) rather than through Angular's DI factory, not a missing test for real
logic. The skill flags this and does not propose a test to chase it.
