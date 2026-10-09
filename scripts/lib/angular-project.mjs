import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function readAngularJson(projectRoot) {
  const angularJsonPath = path.join(projectRoot, 'angular.json');

  if (!existsSync(angularJsonPath)) {
    return null;
  }

  return JSON.parse(readFileSync(angularJsonPath, 'utf8'));
}

export function resolveProject(projectRoot, requestedProjectName) {
  const angularJson = readAngularJson(projectRoot);

  if (!angularJson) {
    throw new Error(`No angular.json found at ${projectRoot}.`);
  }

  const projectNames = Object.keys(angularJson.projects ?? {});

  if (projectNames.length === 0) {
    throw new Error(`No projects defined in angular.json at ${projectRoot}.`);
  }

  if (requestedProjectName) {
    if (!projectNames.includes(requestedProjectName)) {
      throw new Error(
        `Project "${requestedProjectName}" not found in angular.json. Available projects: ${projectNames.join(', ')}.`,
      );
    }

    return { name: requestedProjectName, config: angularJson.projects[requestedProjectName] };
  }

  if (projectNames.length > 1) {
    throw new Error(
      `Multiple projects found in angular.json (${projectNames.join(', ')}). Pass --project <name> to pick one.`,
    );
  }

  return { name: projectNames[0], config: angularJson.projects[projectNames[0]] };
}

export function detectRunner(projectConfig) {
  const builder = projectConfig?.architect?.test?.builder ?? '';
  const runnerOption = projectConfig?.architect?.test?.options?.runner;

  if (builder.includes(':karma')) {
    return 'karma';
  }

  if (builder.includes('unit-test')) {
    return runnerOption === 'karma' ? 'karma' : 'vitest';
  }

  return 'unknown';
}

export function readGlobalLinesThreshold(projectConfig) {
  const value = projectConfig?.architect?.test?.options?.coverageThresholds?.lines;
  return typeof value === 'number' ? value : null;
}
