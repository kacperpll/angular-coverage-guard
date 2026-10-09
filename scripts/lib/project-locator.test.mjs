import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findProjectRootsDownward, findProjectRootUpward, locateProjectRoot } from './project-locator.mjs';

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-locator-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function touchAngularJson(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'angular.json'), '{}');
}

test('findProjectRootUpward finds angular.json in the start directory itself', () => {
  withTempDir((root) => {
    touchAngularJson(root);
    assert.equal(findProjectRootUpward(root), root);
  });
});

test('findProjectRootUpward finds angular.json in an ancestor directory', () => {
  withTempDir((root) => {
    touchAngularJson(root);
    const nested = path.join(root, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    assert.equal(findProjectRootUpward(nested), root);
  });
});

test('findProjectRootUpward returns null when nothing is found up to the filesystem root', () => {
  withTempDir((root) => {
    assert.equal(findProjectRootUpward(root), null);
  });
});

test('findProjectRootsDownward finds a single angular.json within maxDepth', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'examples', 'demo-app'));
    const found = findProjectRootsDownward(root, 3);
    assert.deepEqual(found, [path.join(root, 'examples', 'demo-app')]);
  });
});

test('findProjectRootsDownward finds multiple angular.json files', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'apps', 'one'));
    touchAngularJson(path.join(root, 'apps', 'two'));
    const found = findProjectRootsDownward(root, 3).sort();
    assert.deepEqual(found, [path.join(root, 'apps', 'one'), path.join(root, 'apps', 'two')].sort());
  });
});

test('findProjectRootsDownward does not descend into node_modules or dist', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'node_modules', 'some-pkg'));
    touchAngularJson(path.join(root, 'dist', 'demo-app'));
    const found = findProjectRootsDownward(root, 3);
    assert.deepEqual(found, []);
  });
});

test('findProjectRootsDownward respects maxDepth', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'a', 'b', 'c', 'd', 'too-deep'));
    const found = findProjectRootsDownward(root, 3);
    assert.deepEqual(found, []);
  });
});

test('locateProjectRoot: explicit --project-dir wins and is validated', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'examples', 'demo-app'));
    const result = locateProjectRoot(root, 'examples/demo-app');
    assert.equal(result.status, 'found');
    assert.equal(result.source, 'explicit');
    assert.equal(result.projectRoot, path.join(root, 'examples', 'demo-app'));
  });
});

test('locateProjectRoot: explicit --project-dir pointing at a directory with no angular.json is a clear error', () => {
  withTempDir((root) => {
    mkdirSync(path.join(root, 'empty'));
    const result = locateProjectRoot(root, 'empty');
    assert.equal(result.status, 'not-found-at-explicit-path');
  });
});

test('locateProjectRoot: finds upward before trying downward', () => {
  withTempDir((root) => {
    touchAngularJson(root);
    const nested = path.join(root, 'a');
    mkdirSync(nested);
    const result = locateProjectRoot(nested, undefined);
    assert.equal(result.status, 'found');
    assert.equal(result.source, 'upward');
    assert.equal(result.projectRoot, root);
  });
});

test('locateProjectRoot: falls back to downward search, reports the single match and where it came from', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'examples', 'demo-app'));
    const result = locateProjectRoot(root, undefined);
    assert.equal(result.status, 'found');
    assert.equal(result.source, 'downward');
    assert.equal(result.projectRoot, path.join(root, 'examples', 'demo-app'));
  });
});

test('locateProjectRoot: downward search with multiple matches asks instead of guessing', () => {
  withTempDir((root) => {
    touchAngularJson(path.join(root, 'apps', 'one'));
    touchAngularJson(path.join(root, 'apps', 'two'));
    const result = locateProjectRoot(root, undefined);
    assert.equal(result.status, 'multiple');
    assert.equal(result.candidates.length, 2);
  });
});

test('locateProjectRoot: nothing found anywhere stops cleanly', () => {
  withTempDir((root) => {
    const result = locateProjectRoot(root, undefined);
    assert.equal(result.status, 'none');
  });
});
