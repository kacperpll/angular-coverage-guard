import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { detectRunner, readGlobalLinesThreshold, resolveProject } from './angular-project.mjs';

function withAngularJson(projectsObject, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-angular-project-'));
  writeFileSync(path.join(dir, 'angular.json'), JSON.stringify({ projects: projectsObject }));

  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const vitestProject = {
  architect: { test: { builder: '@angular/build:unit-test', options: {} } },
};

const karmaProject = {
  architect: { test: { builder: '@angular-devkit/build-angular:karma', options: {} } },
};

test('resolveProject picks the single project when there is only one', () => {
  withAngularJson({ demo: vitestProject }, (dir) => {
    const project = resolveProject(dir, null);
    assert.equal(project.name, 'demo');
  });
});

test('resolveProject errors clearly when multiple projects exist and none was requested', () => {
  withAngularJson({ demo: vitestProject, demo2: vitestProject }, (dir) => {
    assert.throws(() => resolveProject(dir, null), /Multiple projects found.*--project/s);
  });
});

test('resolveProject honors an explicit --project among multiple', () => {
  withAngularJson({ demo: vitestProject, demo2: vitestProject }, (dir) => {
    const project = resolveProject(dir, 'demo2');
    assert.equal(project.name, 'demo2');
  });
});

test('resolveProject errors clearly when the requested project does not exist', () => {
  withAngularJson({ demo: vitestProject }, (dir) => {
    assert.throws(() => resolveProject(dir, 'nope'), /not found in angular\.json/);
  });
});

test('resolveProject errors clearly when angular.json is missing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'coverage-guard-no-angular-json-'));
  try {
    assert.throws(() => resolveProject(dir, null), /No angular\.json found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectRunner identifies vitest (unit-test builder, no runner override)', () => {
  assert.equal(detectRunner(vitestProject), 'vitest');
});

test('detectRunner identifies karma via the classic karma builder', () => {
  assert.equal(detectRunner(karmaProject), 'karma');
});

test('detectRunner identifies karma via the unit-test builder with runner: karma', () => {
  const project = { architect: { test: { builder: '@angular/build:unit-test', options: { runner: 'karma' } } } };
  assert.equal(detectRunner(project), 'karma');
});

test('readGlobalLinesThreshold reads the configured value', () => {
  const project = {
    architect: { test: { builder: '@angular/build:unit-test', options: { coverageThresholds: { lines: 85 } } } },
  };
  assert.equal(readGlobalLinesThreshold(project), 85);
});

test('readGlobalLinesThreshold returns null when not configured', () => {
  assert.equal(readGlobalLinesThreshold(vitestProject), null);
});
