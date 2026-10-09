import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { setupProject } from './project-setup.mjs';

function writeAngularJson(dir, projects) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'angular.json'), JSON.stringify({ projects }));
}

const vitestProject = {
  architect: { test: { builder: '@angular/build:unit-test', options: {} } },
};

const karmaProject = {
  architect: { test: { builder: '@angular-devkit/build-angular:karma', options: {} } },
};

test('setupProject resolves a single-project workspace found upward', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-guard-setup-'));
  try {
    writeAngularJson(root, { demo: vitestProject });
    const result = setupProject(root, {});
    assert.equal(result.status, 'ready');
    assert.equal(result.projectRoot, root);
    assert.equal(result.projectRootSource, 'upward');
    assert.equal(result.project.name, 'demo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('setupProject rejects a Karma project with a clear error', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-guard-setup-'));
  try {
    writeAngularJson(root, { demo: karmaProject });
    assert.throws(() => setupProject(root, {}), /Karma/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('setupProject returns a "multiple" status instead of throwing when several projects are found downward', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-guard-setup-'));
  try {
    writeAngularJson(path.join(root, 'apps', 'one'), { demo: vitestProject });
    writeAngularJson(path.join(root, 'apps', 'two'), { demo: vitestProject });
    const result = setupProject(root, {});
    assert.equal(result.status, 'multiple');
    assert.equal(result.candidates.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('setupProject throws a clear error when nothing is found anywhere', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-guard-setup-'));
  try {
    assert.throws(() => setupProject(root, {}), /No angular\.json found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('setupProject honors an explicit --project-dir and --project name', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-guard-setup-'));
  try {
    writeAngularJson(path.join(root, 'examples', 'demo-app'), { demo: vitestProject, demo2: vitestProject });
    const result = setupProject(root, { projectDir: 'examples/demo-app', requestedProject: 'demo2' });
    assert.equal(result.status, 'ready');
    assert.equal(result.projectRootSource, 'explicit');
    assert.equal(result.project.name, 'demo2');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
