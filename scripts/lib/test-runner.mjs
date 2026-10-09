import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function resolveNgEntry(projectRoot) {
  const local = path.join(projectRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

  if (existsSync(local)) {
    return { command: process.execPath, prefixArgs: [local] };
  }

  // Fallback only: no local Angular CLI install found in the target project.
  return { command: 'ng', prefixArgs: [] };
}

export function resolveReportDir(projectRoot, projectName) {
  // v1: @angular/build's unit-test builder schema exposes no option for a custom coverage output
  // directory, so this default is the only location there is to check. A project pointing
  // `runnerConfig` at a custom Vitest config that overrides `coverage.reportsDirectory` would not
  // be found here; runCoverage()'s post-run existence check turns that into a clear "crash"
  // outcome instead of silently reading stale or missing data.
  return path.join(projectRoot, 'coverage', projectName);
}

export function runCoverage({ projectRoot, projectName, includeSpecPaths }) {
  const reportDir = resolveReportDir(projectRoot, projectName);
  rmSync(reportDir, { recursive: true, force: true });

  const { command, prefixArgs } = resolveNgEntry(projectRoot);
  const args = [
    ...prefixArgs,
    'test',
    projectName,
    '--coverage',
    '--coverage-reporters=json-summary',
    '--coverage-reporters=lcov',
    '--watch=false',
    ...includeSpecPaths.flatMap((specPath) => ['--include', specPath]),
  ];

  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8' });
  const stdout = stripAnsi(result.stdout ?? '');
  const stderr = stripAnsi(result.stderr ?? '');
  const summaryPath = path.join(reportDir, 'coverage-summary.json');

  // Failing tests produce no coverage report at all (confirmed empirically), same as the
  // --include-with-no-spec crash. Check for failed tests first so that case is reported as
  // "red-tests" (an expected, actionable outcome) rather than misclassified as a generic crash.
  const testsFailed = /Test Files\s+\d+\s+failed/.test(stdout);
  if (testsFailed) {
    return { outcome: 'red-tests', exitCode: result.status, stdout, stderr, reportDir: null };
  }

  if (!existsSync(summaryPath)) {
    return { outcome: 'crash', exitCode: result.status, stdout, stderr, reportDir: null };
  }

  const thresholdNotMet = /ERROR: Coverage for lines/.test(stdout);
  return {
    outcome: thresholdNotMet ? 'threshold-not-met' : 'threshold-met',
    exitCode: result.status,
    stdout,
    stderr,
    reportDir,
  };
}
