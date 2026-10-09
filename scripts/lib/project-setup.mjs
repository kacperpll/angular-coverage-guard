import { detectRunner, resolveProject } from './angular-project.mjs';
import { locateProjectRoot } from './project-locator.mjs';

export function setupProject(cwd, { projectDir, requestedProject } = {}) {
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
    return { status: 'multiple', candidates: location.candidates };
  }

  const { projectRoot, source: projectRootSource } = location;
  const project = resolveProject(projectRoot, requestedProject);

  const runner = detectRunner(project.config);
  if (runner === 'karma') {
    throw new Error('This project uses Karma. angular-coverage-guard v1 only supports Vitest-based Angular projects.');
  }

  return { status: 'ready', projectRoot, projectRootSource, project };
}
