import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git']);

export function findProjectRootUpward(startDir) {
  let dir = startDir;

  for (;;) {
    if (existsSync(path.join(dir, 'angular.json'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

export function findProjectRootsDownward(startDir, maxDepth = 3) {
  const found = [];

  function walk(dir, depth) {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === 'angular.json')) {
      found.push(dir);
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIR_NAMES.has(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  }

  walk(startDir, 0);
  return found;
}

// Shared by the interactive scripts (which disambiguate a single project to use) and the Stop
// hook (which instead checks every project it finds, since it can't ask the user anything).
export function findAllProjectRoots(cwd) {
  const upward = findProjectRootUpward(cwd);
  if (upward) {
    return { roots: [upward], source: 'upward' };
  }

  return { roots: findProjectRootsDownward(cwd, 3), source: 'downward' };
}

export function locateProjectRoot(cwd, explicitProjectDir) {
  if (explicitProjectDir) {
    const absolute = path.resolve(cwd, explicitProjectDir);

    if (existsSync(path.join(absolute, 'angular.json'))) {
      return { status: 'found', projectRoot: absolute, source: 'explicit' };
    }

    return { status: 'not-found-at-explicit-path', path: absolute };
  }

  const { roots, source } = findAllProjectRoots(cwd);

  if (roots.length === 1) {
    return { status: 'found', projectRoot: roots[0], source };
  }

  if (roots.length > 1) {
    return { status: 'multiple', candidates: roots };
  }

  return { status: 'none' };
}
