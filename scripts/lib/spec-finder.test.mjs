import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { hasSpec, toSpecRelativePath } from './spec-finder.mjs';

test('toSpecRelativePath maps a source file to its sibling .spec.ts', () => {
  assert.equal(toSpecRelativePath('src/app/guards/auth.guard.ts'), 'src/app/guards/auth.guard.spec.ts');
});

test('toSpecRelativePath is a no-op for a path that is already a spec or test file', () => {
  assert.equal(toSpecRelativePath('src/app/guards/auth.guard.spec.ts'), 'src/app/guards/auth.guard.spec.ts');
  assert.equal(toSpecRelativePath('src/app/guards/auth.guard.test.ts'), 'src/app/guards/auth.guard.test.ts');
});

test('hasSpec reflects whether the sibling spec file actually exists on disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-spec-finder-'));

  try {
    mkdirSync(path.join(dir, 'src', 'app', 'guards'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'app', 'guards', 'auth.guard.ts'), 'export const authGuard = () => true;');

    assert.equal(hasSpec(dir, 'src/app/guards/auth.guard.ts'), false);

    writeFileSync(path.join(dir, 'src', 'app', 'guards', 'auth.guard.spec.ts'), 'describe("x", () => {});');

    assert.equal(hasSpec(dir, 'src/app/guards/auth.guard.ts'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
