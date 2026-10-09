import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { detectRunner, readGlobalLinesThreshold, resolveProject } from './lib/angular-project.mjs';
import { loadUserConfig, resolveBaseBranchOverride, resolveExcludeConfig, resolveThreshold } from './lib/config.mjs';
import { parseCoverageSummary, parseLcov, withSnippets } from './lib/coverage-parser.mjs';
import { isExcluded, resolveExcludes } from './lib/exclude.mjs';
import { detectBaseBranch, getChangedFiles } from './lib/git.mjs';
import { buildAnalysisReport } from './lib/report.mjs';
import { classifyTier, hasLogicSignal } from './lib/risk.mjs';
import { locateProjectRoot } from './lib/project-locator.mjs';
import { hasSpec, toSpecRelativePath } from './lib/spec-finder.mjs';
import { runCoverage } from './lib/test-runner.mjs';

function fail(message) {
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isSourceTs(relativePath) {
  return relativePath.endsWith('.ts') && !relativePath.endsWith('.spec.ts') && !relativePath.endsWith('.test.ts');
}

function collectSourceFiles(walkRoot, projectRoot) {
  const results = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') {
        continue;
      }

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      const relative = toPosix(path.relative(projectRoot, full));
      if (isSourceTs(relative)) {
        results.push(relative);
      }
    }
  }

  walk(walkRoot);
  return results;
}

function parseArgs(argv) {
  const result = { all: false, project: null, projectDir: null, positional: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--all') {
      result.all = true;
    } else if (arg === '--project') {
      result.project = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--project-dir') {
      result.projectDir = argv[i + 1] ?? null;
      i += 1;
    } else if (!arg.startsWith('--')) {
      result.positional = arg;
    }
  }

  return result;
}

function resolveScope({ all, positional }, projectRoot, baseBranchOverride) {
  if (all) {
    return collectSourceFiles(path.join(projectRoot, 'src'), projectRoot);
  }

  if (positional) {
    const full = path.join(projectRoot, positional);
    if (!existsSync(full)) {
      throw new Error(`Path not found: ${positional}`);
    }

    if (statSync(full).isDirectory()) {
      return collectSourceFiles(full, projectRoot);
    }

    const relative = toPosix(path.relative(projectRoot, full));
    return isSourceTs(relative) ? [relative] : [];
  }

  const baseBranch = baseBranchOverride ?? detectBaseBranch(projectRoot);
  return getChangedFiles(projectRoot, baseBranch).filter(isSourceTs);
}

function buildEntry(projectRoot, file, { withoutSpec, coverageByFile, lcovByFile }) {
  const content = readFileSync(path.join(projectRoot, file), 'utf8');
  const tier = classifyTier(file, content);
  const logicSignal = hasLogicSignal(content);

  if (withoutSpec.has(file)) {
    return { file, hasSpec: false, note: 'no dedicated spec', tier, hasLogicSignal: logicSignal };
  }

  const coverage = coverageByFile.get(file);
  if (!coverage) {
    return {
      file,
      hasSpec: true,
      note: 'spec exists but this file was not exercised by it',
      lines: { pct: 0 },
      tier,
      hasLogicSignal: logicSignal,
    };
  }

  const lcov = lcovByFile.get(file);
  return {
    file,
    hasSpec: true,
    lines: coverage.lines,
    branches: coverage.branches,
    uncoveredLines: lcov?.uncoveredLines ?? [],
    uncoveredBranches: withSnippets(lcov?.uncoveredBranches ?? [], content),
    tier,
    hasLogicSignal: logicSignal,
  };
}

function printReport(projectRoot, projectRootSource, report) {
  console.log(JSON.stringify({ projectRoot, projectRootSource, ...report }, null, 2));
}

function main() {
  const { all, project: requestedProject, projectDir, positional } = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const location = locateProjectRoot(cwd, projectDir);

  if (location.status === 'not-found-at-explicit-path') {
    throw new Error(`No angular.json found at ${location.path} (from --project-dir).`);
  }

  if (location.status === 'none') {
    throw new Error(
      `No angular.json found searching upward from ${cwd}, nor downward (max 3 levels, skipping node_modules/dist). ` +
        'Pass --project-dir <path> to point at the Angular project directly.',
    );
  }

  if (location.status === 'multiple') {
    console.log(JSON.stringify({ multipleProjectsFound: location.candidates }));
    process.exit(1);
    return;
  }

  const { projectRoot, source: projectRootSource } = location;

  const project = resolveProject(projectRoot, requestedProject);

  const runner = detectRunner(project.config);
  if (runner === 'karma') {
    throw new Error('This project uses Karma. angular-coverage-guard v1 only supports Vitest-based Angular projects.');
  }

  const userConfig = loadUserConfig(projectRoot);
  const excludes = resolveExcludes(resolveExcludeConfig(userConfig));
  const baseBranchOverride = resolveBaseBranchOverride(userConfig);
  const { threshold } = resolveThreshold(userConfig, readGlobalLinesThreshold(project.config));

  let relevantFiles = resolveScope({ all, positional }, projectRoot, baseBranchOverride);
  relevantFiles = relevantFiles.filter((file) => !isExcluded(file, excludes));

  if (relevantFiles.length === 0) {
    printReport(projectRoot, projectRootSource, buildAnalysisReport({ threshold, runOutcome: null, entries: [] }));
    return;
  }

  const withSpec = relevantFiles.filter((file) => hasSpec(projectRoot, file));
  const withoutSpec = new Set(relevantFiles.filter((file) => !hasSpec(projectRoot, file)));

  let coverageByFile = new Map();
  let lcovByFile = new Map();
  let runOutcome = null;

  if (withSpec.length > 0) {
    const includeSpecPaths = withSpec.map((file) => toSpecRelativePath(file));
    const result = runCoverage({ projectRoot, projectName: project.name, includeSpecPaths });
    runOutcome = result.outcome;

    if (result.outcome === 'crash') {
      fail(`ng test crashed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
      return;
    }

    if (result.outcome === 'red-tests') {
      console.log(
        JSON.stringify({
          error:
            'One or more tests failed during the coverage run. Coverage numbers from this run are unreliable until the failing tests are fixed.',
          stdout: result.stdout,
        }),
      );
      process.exit(1);
      return;
    }

    coverageByFile = parseCoverageSummary(result.reportDir, projectRoot);
    lcovByFile = parseLcov(result.reportDir, projectRoot);
  }

  const entries = relevantFiles.map((file) => buildEntry(projectRoot, file, { withoutSpec, coverageByFile, lcovByFile }));

  printReport(projectRoot, projectRootSource, buildAnalysisReport({ threshold, runOutcome, entries }));
}

try {
  main();
} catch (error) {
  fail(error.message);
}
