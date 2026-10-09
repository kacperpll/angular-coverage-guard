import { spawnSync } from 'node:child_process';

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function refExists(ref, cwd) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd }).status === 0;
}

export function detectBaseBranch(projectRoot) {
  for (const name of ['main', 'master']) {
    if (refExists(name, projectRoot)) {
      return name;
    }
  }

  for (const name of ['origin/main', 'origin/master']) {
    if (refExists(name, projectRoot)) {
      return name;
    }
  }

  throw new Error(
    'Could not detect a base branch (tried main, master, origin/main, origin/master). ' +
      'Set "baseBranch" in coverage-guard.config.json.',
  );
}

export function getWorkingTreeChangedFiles(projectRoot) {
  const unstaged = runGit(['diff', '--relative', '--name-only'], projectRoot);
  const staged = runGit(['diff', '--cached', '--relative', '--name-only'], projectRoot);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard'], projectRoot);

  return [...new Set([...unstaged, ...staged, ...untracked])];
}

export function getChangedFiles(projectRoot, baseBranch) {
  const vsBase = runGit(['diff', '--relative', '--name-only', `${baseBranch}...HEAD`], projectRoot);

  return [...new Set([...vsBase, ...getWorkingTreeChangedFiles(projectRoot)])];
}
