import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_EXCLUDES, isExcluded, resolveExcludes } from './exclude.mjs';

test('resolveExcludes merges user excludes with the defaults (does not replace them)', () => {
  const resolved = resolveExcludes(['**/*.fixture.ts']);
  for (const pattern of DEFAULT_EXCLUDES) {
    assert.ok(resolved.includes(pattern));
  }
  assert.ok(resolved.includes('**/*.fixture.ts'));
});

test('resolveExcludes with no user excludes returns just the defaults', () => {
  assert.deepEqual(resolveExcludes(undefined), DEFAULT_EXCLUDES);
  assert.deepEqual(resolveExcludes([]), DEFAULT_EXCLUDES);
});

test('default excludes match regardless of nesting depth', () => {
  const excludes = resolveExcludes([]);
  assert.ok(isExcluded('src/main.ts', excludes));
  assert.ok(isExcluded('src/app/app.module.ts', excludes));
  assert.ok(isExcluded('src/app/shared/shared.module.ts', excludes));
  assert.ok(isExcluded('src/environments/environment.ts', excludes));
  assert.ok(isExcluded('src/app/app.routes.ts', excludes));
  assert.ok(isExcluded('src/app/app.config.ts', excludes));
  assert.ok(isExcluded('src/app/app.config.server.ts', excludes));
});

test('default excludes do not match unrelated files', () => {
  const excludes = resolveExcludes([]);
  assert.ok(!isExcluded('src/app/services/price-calculator.service.ts', excludes));
  assert.ok(!isExcluded('src/app/guards/auth.guard.ts', excludes));
});

test('a custom exclude pattern is honored', () => {
  const excludes = resolveExcludes(['**/*.fixture.ts']);
  assert.ok(isExcluded('src/app/testing/book.fixture.ts', excludes));
});
