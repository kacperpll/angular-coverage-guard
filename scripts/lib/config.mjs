import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_THRESHOLD = 80;
const DEFAULT_HOOK = true;

export function loadUserConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'coverage-guard.config.json');

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

export function resolveThreshold(userConfig, angularGlobalLinesThreshold) {
  if (typeof angularGlobalLinesThreshold === 'number') {
    return { threshold: angularGlobalLinesThreshold, thresholdSource: 'angular.json' };
  }

  if (typeof userConfig.threshold === 'number') {
    return { threshold: userConfig.threshold, thresholdSource: 'coverage-guard.config.json' };
  }

  return { threshold: DEFAULT_THRESHOLD, thresholdSource: 'default' };
}

export function resolveExcludeConfig(userConfig) {
  return Array.isArray(userConfig.exclude) ? userConfig.exclude : [];
}

export function resolveBaseBranchOverride(userConfig) {
  return typeof userConfig.baseBranch === 'string' ? userConfig.baseBranch : null;
}

export function resolveHookEnabled(userConfig) {
  return userConfig.hook !== false && DEFAULT_HOOK;
}
