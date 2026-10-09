import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseCoverageSummary, parseLcov, withSnippets } from './lib/coverage-parser.mjs';
import { setupProject } from './lib/project-setup.mjs';
import { hasSpec, toSpecRelativePath } from './lib/spec-finder.mjs';
import { runCoverage } from './lib/test-runner.mjs';

function fail(message) {
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function parseArgs(argv) {
  const result = { project: null, projectDir: null, files: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--project') {
      result.project = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--project-dir') {
      result.projectDir = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--files') {
      result.files = (argv[i + 1] ?? '')
        .split(',')
        .map((file) => toPosix(file.trim()))
        .filter(Boolean);
      i += 1;
    }
  }

  return result;
}

function main() {
  const { project: requestedProject, projectDir, files } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    throw new Error('--files <comma-separated source file paths> is required.');
  }

  const setup = setupProject(process.cwd(), { projectDir, requestedProject });

  if (setup.status === 'multiple') {
    console.log(JSON.stringify({ multipleProjectsFound: setup.candidates }));
    process.exit(1);
    return;
  }

  const { projectRoot, projectRootSource, project } = setup;

  const missingSpec = files.filter((file) => !hasSpec(projectRoot, file));
  if (missingSpec.length > 0) {
    throw new Error(
      `verify-written-tests expects files that already have a spec written. No spec found for: ${missingSpec.join(', ')}.`,
    );
  }

  const includeSpecPaths = [...new Set(files.map((file) => toSpecRelativePath(file)))];
  const result = runCoverage({ projectRoot, projectName: project.name, includeSpecPaths });

  if (result.outcome === 'crash') {
    fail(`ng test crashed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
    return;
  }

  if (result.outcome === 'red-tests') {
    console.log(
      JSON.stringify({
        error:
          'One or more tests failed during verification. Coverage numbers from this run are unreliable until the failing tests are fixed.',
        stdout: result.stdout,
      }),
    );
    process.exit(1);
    return;
  }

  const coverageByFile = parseCoverageSummary(result.reportDir, projectRoot);
  const lcovByFile = parseLcov(result.reportDir, projectRoot);

  const results = files.map((file) => {
    const coverage = coverageByFile.get(file);
    if (!coverage) {
      return { file, note: 'spec exists but this file was not exercised by it', lines: { pct: 0 } };
    }

    const content = readFileSync(path.join(projectRoot, file), 'utf8');
    const lcov = lcovByFile.get(file);

    return {
      file,
      lines: coverage.lines,
      branches: coverage.branches,
      uncoveredLines: lcov?.uncoveredLines ?? [],
      uncoveredBranches: withSnippets(lcov?.uncoveredBranches ?? [], content),
    };
  });

  console.log(JSON.stringify({ projectRoot, projectRootSource, runOutcome: result.outcome, files: results }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error.message);
}
