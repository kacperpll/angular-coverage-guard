import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  loadUserConfig,
  resolveBaseBranchOverride,
  resolveExcludeConfig,
  resolveHookEnabled,
  resolveThreshold,
} from './config.mjs';

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-config-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('loadUserConfig returns {} when the config file does not exist', () => {
  withTempDir((dir) => {
    assert.deepEqual(loadUserConfig(dir), {});
  });
});

test('loadUserConfig returns {} (not a throw) on malformed JSON', () => {
  withTempDir((dir) => {
    writeFileSync(path.join(dir, 'coverage-guard.config.json'), '{ not valid json');
    assert.deepEqual(loadUserConfig(dir), {});
  });
});

test('loadUserConfig reads a valid config file', () => {
  withTempDir((dir) => {
    writeFileSync(path.join(dir, 'coverage-guard.config.json'), JSON.stringify({ threshold: 75 }));
    assert.deepEqual(loadUserConfig(dir), { threshold: 75 });
  });
});

test('resolveThreshold: angular.json threshold wins over config file threshold', () => {
  const result = resolveThreshold({ threshold: 75 }, 80);
  assert.equal(result.threshold, 80);
  assert.equal(result.thresholdSource, 'angular.json');
});

test('resolveThreshold: config file threshold wins over the default', () => {
  const result = resolveThreshold({ threshold: 75 }, null);
  assert.equal(result.threshold, 75);
  assert.equal(result.thresholdSource, 'coverage-guard.config.json');
});

test('resolveThreshold: falls back to the built-in default', () => {
  const result = resolveThreshold({}, null);
  assert.equal(result.threshold, 80);
  assert.equal(result.thresholdSource, 'default');
});

test('resolveExcludeConfig returns [] when exclude is missing or not an array', () => {
  assert.deepEqual(resolveExcludeConfig({}), []);
  assert.deepEqual(resolveExcludeConfig({ exclude: 'not-an-array' }), []);
  assert.deepEqual(resolveExcludeConfig({ exclude: ['**/*.fixture.ts'] }), ['**/*.fixture.ts']);
});

test('resolveBaseBranchOverride returns null when not set', () => {
  assert.equal(resolveBaseBranchOverride({}), null);
  assert.equal(resolveBaseBranchOverride({ baseBranch: 'develop' }), 'develop');
});

test('resolveHookEnabled defaults to true, honors explicit false', () => {
  assert.equal(resolveHookEnabled({}), true);
  assert.equal(resolveHookEnabled({ hook: false }), false);
  assert.equal(resolveHookEnabled({ hook: true }), true);
});
