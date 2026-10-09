import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseCoverageSummary, parseLcov } from './coverage-parser.mjs';

const FIXTURES_DIR = path.join(import.meta.dirname, '..', '__fixtures__');

function makeReportDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-'));
  copyFileSync(path.join(FIXTURES_DIR, 'coverage-summary.sample.json'), path.join(dir, 'coverage-summary.json'));
  copyFileSync(path.join(FIXTURES_DIR, 'lcov.sample.info'), path.join(dir, 'lcov.info'));
  return dir;
}

test('parseCoverageSummary normalizes absolute Windows paths to project-relative posix paths', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseCoverageSummary(reportDir, 'C:\\fake\\project');
    assert.ok(result.has('src/app/services/example.service.ts'));
    assert.equal(result.get('src/app/services/example.service.ts').lines.pct, 90);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test('parseCoverageSummary is case-insensitive on the drive letter', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseCoverageSummary(reportDir, 'c:\\fake\\project');
    assert.ok(result.has('src/app/services/example.service.ts'));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test('parseCoverageSummary skips non-.ts entries (compiled templates)', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseCoverageSummary(reportDir, 'C:\\fake\\project');
    assert.ok(!result.has('src/app/components/example/example.component.html'));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test('parseCoverageSummary skips the "total" key', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseCoverageSummary(reportDir, 'C:\\fake\\project');
    assert.ok(!result.has('total'));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test('parseLcov reports uncovered lines and branches, backslash SF paths normalized', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseLcov(reportDir, 'C:\\fake\\project');
    const entry = result.get('src/app/services/example.service.ts');
    assert.ok(entry);
    assert.deepEqual(entry.uncoveredLines, [12]);
    assert.deepEqual(entry.uncoveredBranches, [{ line: 8, block: 0, branch: 1 }]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test('parseLcov skips non-.ts entries (compiled templates)', () => {
  const reportDir = makeReportDir();

  try {
    const result = parseLcov(reportDir, 'C:\\fake\\project');
    assert.ok(!result.has('src/app/components/example/example.component.html'));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});
