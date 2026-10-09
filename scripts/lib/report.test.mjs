import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortEntriesByRisk } from './report.mjs';

test('sorts by tier ascending first', () => {
  const entries = [
    { file: 'b.ts', tier: 3, hasLogicSignal: false, hasSpec: true, lines: { pct: 50 } },
    { file: 'a.ts', tier: 1, hasLogicSignal: false, hasSpec: true, lines: { pct: 90 } },
  ];
  const sorted = sortEntriesByRisk(entries);
  assert.deepEqual(sorted.map((e) => e.file), ['a.ts', 'b.ts']);
});

test('within a tier, files with a logic signal sort before those without', () => {
  const entries = [
    { file: 'presentational.ts', tier: 3, hasLogicSignal: false, hasSpec: true, lines: { pct: 10 } },
    { file: 'smart.ts', tier: 3, hasLogicSignal: true, hasSpec: true, lines: { pct: 90 } },
  ];
  const sorted = sortEntriesByRisk(entries);
  assert.deepEqual(sorted.map((e) => e.file), ['smart.ts', 'presentational.ts']);
});

test('within tier + logic-signal group, lower coverage % sorts first', () => {
  const entries = [
    { file: 'high.ts', tier: 2, hasLogicSignal: true, hasSpec: true, lines: { pct: 90 } },
    { file: 'low.ts', tier: 2, hasLogicSignal: true, hasSpec: true, lines: { pct: 10 } },
  ];
  const sorted = sortEntriesByRisk(entries);
  assert.deepEqual(sorted.map((e) => e.file), ['low.ts', 'high.ts']);
});

test('"no dedicated spec" entries sort before a measured 0% without claiming to be 0%', () => {
  const entries = [
    { file: 'measured-zero.ts', tier: 2, hasLogicSignal: false, hasSpec: true, lines: { pct: 0 } },
    { file: 'no-spec.ts', tier: 2, hasLogicSignal: false, hasSpec: false, note: 'no dedicated spec' },
  ];
  const sorted = sortEntriesByRisk(entries);
  assert.deepEqual(sorted.map((e) => e.file), ['no-spec.ts', 'measured-zero.ts']);
  assert.equal(sorted[0].note, 'no dedicated spec');
  assert.equal('lines' in sorted[0], false);
});

test('ties break alphabetically by file path', () => {
  const entries = [
    { file: 'z.ts', tier: 1, hasLogicSignal: false, hasSpec: true, lines: { pct: 50 } },
    { file: 'a.ts', tier: 1, hasLogicSignal: false, hasSpec: true, lines: { pct: 50 } },
  ];
  const sorted = sortEntriesByRisk(entries);
  assert.deepEqual(sorted.map((e) => e.file), ['a.ts', 'z.ts']);
});
