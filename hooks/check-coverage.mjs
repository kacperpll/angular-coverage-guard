import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadUserConfig, resolveExcludeConfig, resolveHookEnabled } from '../scripts/lib/config.mjs';
import { isExcluded, resolveExcludes } from '../scripts/lib/exclude.mjs';
import { getWorkingTreeChangedFiles } from '../scripts/lib/git.mjs';
import { findAllProjectRoots } from '../scripts/lib/project-locator.mjs';
import { toSpecRelativePath } from '../scripts/lib/spec-finder.mjs';

function isSourceTs(relativePath) {
  return relativePath.endsWith('.ts') && !relativePath.endsWith('.spec.ts') && !relativePath.endsWith('.test.ts');
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function stateFilePath(sessionId) {
  return path.join(tmpdir(), `angular-coverage-guard-hook-${sessionId}.json`);
}

function readLastFlagged(sessionId) {
  const file = stateFilePath(sessionId);

  if (!existsSync(file)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed.flaggedFiles) ? parsed.flaggedFiles : [];
  } catch {
    return [];
  }
}

function writeLastFlagged(sessionId, flaggedFiles) {
  try {
    writeFileSync(stateFilePath(sessionId), JSON.stringify({ flaggedFiles }));
  } catch {
    // Non-fatal: worst case the next turn repeats a notice it shouldn't.
  }
}

function sameSet(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function flaggedFilesForProject(projectRoot) {
  const userConfig = loadUserConfig(projectRoot);
  if (!resolveHookEnabled(userConfig)) {
    return [];
  }

  const excludes = resolveExcludes(resolveExcludeConfig(userConfig));
  const changedFiles = getWorkingTreeChangedFiles(projectRoot);
  const changedSet = new Set(changedFiles);

  return changedFiles
    .filter(isSourceTs)
    .filter((file) => !isExcluded(file, excludes))
    .filter((file) => !changedSet.has(toSpecRelativePath(file)));
}

function main() {
  const payload = JSON.parse(readFileSync(0, 'utf8'));

  if (payload.stop_hook_active) {
    return;
  }

  // Same project detection the skill uses: upward first, then downward (max 3 levels, skipping
  // node_modules/dist/.git). Unlike the skill, several matches downward aren't ambiguous here -
  // there's no one to ask, so every project found is checked and the results are merged.
  const cwd = payload.cwd ?? process.cwd();
  const { roots: projectRoots } = findAllProjectRoots(cwd);

  if (projectRoots.length === 0) {
    return;
  }

  const flaggedFiles = projectRoots
    .flatMap((projectRoot) => {
      const prefix = projectRoots.length > 1 ? `${toPosix(path.relative(cwd, projectRoot))}/` : '';
      return flaggedFilesForProject(projectRoot).map((file) => `${prefix}${file}`);
    })
    .sort();

  const sessionId = payload.session_id ?? 'unknown-session';
  const lastFlagged = readLastFlagged(sessionId);
  writeLastFlagged(sessionId, flaggedFiles);

  if (flaggedFiles.length === 0 || sameSet(flaggedFiles, lastFlagged)) {
    return;
  }

  console.log(
    JSON.stringify({
      systemMessage: `angular-coverage-guard: changed without a matching spec update: ${flaggedFiles.join(', ')}. Try /coverage-check.`,
    }),
  );
}

try {
  main();
} catch {
  // Fail open - this is an opt-in convenience, not a gate.
}

process.exit(0);
