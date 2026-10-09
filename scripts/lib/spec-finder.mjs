import { existsSync } from 'node:fs';
import path from 'node:path';

export function toSpecRelativePath(sourceRelativePath) {
  if (sourceRelativePath.endsWith('.spec.ts') || sourceRelativePath.endsWith('.test.ts')) {
    return sourceRelativePath;
  }

  return sourceRelativePath.replace(/\.ts$/, '.spec.ts');
}

export function hasSpec(projectRoot, sourceRelativePath) {
  return existsSync(path.join(projectRoot, toSpecRelativePath(sourceRelativePath)));
}
