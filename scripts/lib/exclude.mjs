import path from 'node:path';

// `**/` prefixed so these match regardless of depth (e.g. `src/main.ts`), not just at the project
// root — the brief's bare `main.ts` / `*.module.ts` wording describes the user-facing defaults,
// this is the matching implementation of that intent.
export const DEFAULT_EXCLUDES = [
  '**/*.module.ts',
  '**/main.ts',
  '**/environments/**',
  '**/*.routes.ts',
  '**/app.config*.ts',
];

export function resolveExcludes(userExcludes) {
  return [...DEFAULT_EXCLUDES, ...(userExcludes ?? [])];
}

export function isExcluded(relativePath, excludes) {
  return excludes.some((pattern) => path.matchesGlob(relativePath, pattern));
}
