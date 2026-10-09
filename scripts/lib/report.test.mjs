import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAnalysisReport, buildBranchGaps, sortEntriesByRisk } from './report.mjs';

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

test('buildBranchGaps surfaces a tier 1-2 file that meets the line threshold but has an uncovered branch', () => {
  const entries = [
    {
      file: 'src/app/services/price-calculator.service.ts',
      tier: 2,
      hasSpec: true,
      lines: { pct: 90 },
      uncoveredBranches: [{ line: 23, block: 1, branch: 0, snippet: 'if (quantity >= this.config.bulkThreshold) {' }],
    },
  ];
  const gaps = buildBranchGaps(entries, 80);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].file, 'src/app/services/price-calculator.service.ts');
  assert.equal(gaps[0].uncoveredBranches[0].snippet, 'if (quantity >= this.config.bulkThreshold) {');
});

test('buildBranchGaps excludes tier 3 files even with uncovered branches', () => {
  const entries = [
    {
      file: 'src/app/components/example.component.ts',
      tier: 3,
      hasSpec: true,
      lines: { pct: 90 },
      uncoveredBranches: [{ line: 5, block: 0, branch: 0, snippet: 'if (x) {' }],
    },
  ];
  assert.deepEqual(buildBranchGaps(entries, 80), []);
});

test('buildBranchGaps excludes files already below the line threshold (already a gap)', () => {
  const entries = [
    {
      file: 'src/app/interceptors/auth.interceptor.ts',
      tier: 1,
      hasSpec: true,
      lines: { pct: 50 },
      uncoveredBranches: [{ line: 11, block: 0, branch: 0, snippet: 'if (error.status === 401) {' }],
    },
  ];
  assert.deepEqual(buildBranchGaps(entries, 80), []);
});

test('buildBranchGaps excludes files with no dedicated spec', () => {
  const entries = [
    {
      file: 'src/app/guards/auth.guard.ts',
      tier: 1,
      hasSpec: false,
      uncoveredBranches: [{ line: 5, block: 0, branch: 0, snippet: 'if (!token) {' }],
    },
  ];
  assert.deepEqual(buildBranchGaps(entries, 80), []);
});

test('buildBranchGaps excludes files with no uncovered branches', () => {
  const entries = [
    { file: 'src/app/services/clean.service.ts', tier: 2, hasSpec: true, lines: { pct: 100 }, uncoveredBranches: [] },
  ];
  assert.deepEqual(buildBranchGaps(entries, 80), []);
});

test('buildAnalysisReport includes a branchGaps field alongside entries', () => {
  const entries = [
    {
      file: 'src/app/services/price-calculator.service.ts',
      tier: 2,
      hasLogicSignal: true,
      hasSpec: true,
      lines: { pct: 90 },
      uncoveredBranches: [{ line: 23, block: 1, branch: 0, snippet: 'if (quantity >= this.config.bulkThreshold) {' }],
    },
  ];
  const report = buildAnalysisReport({ threshold: 80, runOutcome: 'threshold-met', entries });
  assert.equal(report.branchGaps.length, 1);
  assert.equal(report.entries.length, 1);
});
