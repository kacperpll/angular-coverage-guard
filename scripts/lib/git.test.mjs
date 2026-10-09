import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { detectBaseBranch, getChangedFiles, getWorkingTreeChangedFiles } from './git.mjs';

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result;
}

function makeRepoWithNestedProject() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'coverage-guard-git-'));
  git(['init', '-b', 'main'], repoRoot);
  git(['config', 'user.email', 'test@example.com'], repoRoot);
  git(['config', 'user.name', 'Test'], repoRoot);

  const projectRoot = path.join(repoRoot, 'examples', 'demo-app');
  mkdirSync(path.join(projectRoot, 'src', 'app'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'src', 'app', 'existing.ts'), 'export const a = 1;\n');
  git(['add', '-A'], repoRoot);
  git(['commit', '-m', 'initial'], repoRoot);

  return { repoRoot, projectRoot };
}

test('getWorkingTreeChangedFiles reports paths relative to the (nested) project root, not the repo root', () => {
  const { repoRoot, projectRoot } = makeRepoWithNestedProject();

  try {
    writeFileSync(path.join(projectRoot, 'src', 'app', 'new-file.ts'), 'export const b = 2;\n');
    const changed = getWorkingTreeChangedFiles(projectRoot);
    assert.deepEqual(changed, ['src/app/new-file.ts']);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('getWorkingTreeChangedFiles sees an untracked file individually, not collapsed as a directory', () => {
  const { repoRoot, projectRoot } = makeRepoWithNestedProject();

  try {
    mkdirSync(path.join(projectRoot, 'src', 'app', 'new-dir'));
    writeFileSync(path.join(projectRoot, 'src', 'app', 'new-dir', 'one.ts'), 'export const a = 1;\n');
    writeFileSync(path.join(projectRoot, 'src', 'app', 'new-dir', 'two.ts'), 'export const b = 2;\n');

    const changed = getWorkingTreeChangedFiles(projectRoot);
    assert.deepEqual(changed.sort(), ['src/app/new-dir/one.ts', 'src/app/new-dir/two.ts']);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('getWorkingTreeChangedFiles sees a staged modification to an existing file', () => {
  const { repoRoot, projectRoot } = makeRepoWithNestedProject();

  try {
    writeFileSync(path.join(projectRoot, 'src', 'app', 'existing.ts'), 'export const a = 2;\n');
    git(['add', '-A'], repoRoot);

    const changed = getWorkingTreeChangedFiles(projectRoot);
    assert.deepEqual(changed, ['src/app/existing.ts']);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('detectBaseBranch finds "main" when it exists', () => {
  const { repoRoot, projectRoot } = makeRepoWithNestedProject();

  try {
    assert.equal(detectBaseBranch(projectRoot), 'main');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('getChangedFiles unions the base-branch diff with working-tree changes', () => {
  const { repoRoot, projectRoot } = makeRepoWithNestedProject();

  try {
    git(['checkout', '-b', 'feature'], repoRoot);
    writeFileSync(path.join(projectRoot, 'src', 'app', 'committed-on-branch.ts'), 'export const c = 3;\n');
    git(['add', '-A'], repoRoot);
    git(['commit', '-m', 'branch work'], repoRoot);
    writeFileSync(path.join(projectRoot, 'src', 'app', 'uncommitted.ts'), 'export const d = 4;\n');

    const changed = getChangedFiles(projectRoot, 'main').sort();
    assert.deepEqual(changed, ['src/app/committed-on-branch.ts', 'src/app/uncommitted.ts']);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
