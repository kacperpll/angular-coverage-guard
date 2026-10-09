import { readFileSync } from 'node:fs';
import path from 'node:path';

function normalizeDriveLetter(rawPath) {
  return /^[a-zA-Z]:/.test(rawPath) ? rawPath[0].toLowerCase() + rawPath.slice(1) : rawPath;
}

function toProjectRelativePosix(rawPath, projectRoot) {
  const normalizedRaw = normalizeDriveLetter(rawPath);
  const normalizedRoot = normalizeDriveLetter(projectRoot);
  const isAbsolute = /^[a-zA-Z]:[\\/]/.test(normalizedRaw) || normalizedRaw.startsWith('/');
  const relative = isAbsolute ? path.relative(normalizedRoot, normalizedRaw) : normalizedRaw;

  return relative.split('\\').join('/');
}

export function parseCoverageSummary(reportDir, projectRoot) {
  const summaryPath = path.join(reportDir, 'coverage-summary.json');
  const raw = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const perFile = new Map();

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'total') {
      continue;
    }

    const relative = toProjectRelativePosix(key, projectRoot);
    if (!relative.endsWith('.ts')) {
      // Compiled template files (e.g. foo.component.html) get their own coverage entry too;
      // this plugin only reports on .ts source files.
      continue;
    }

    perFile.set(relative, {
      lines: value.lines,
      statements: value.statements,
      branches: value.branches,
      functions: value.functions,
    });
  }

  return perFile;
}

export function snippetAt(fileContent, lineNumber) {
  const lines = fileContent.split('\n');
  return (lines[lineNumber - 1] ?? '').trim();
}

export function withSnippets(uncoveredBranches, fileContent) {
  return uncoveredBranches.map((branch) => ({ ...branch, snippet: snippetAt(fileContent, branch.line) }));
}

export function parseLcov(reportDir, projectRoot) {
  const lcovPath = path.join(reportDir, 'lcov.info');
  const raw = readFileSync(lcovPath, 'utf8');
  const perFile = new Map();

  let currentFile = null;
  let uncoveredLines = [];
  let uncoveredBranches = [];

  for (const line of raw.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = toProjectRelativePosix(line.slice(3).trim(), projectRoot);
      uncoveredLines = [];
      uncoveredBranches = [];
    } else if (line.startsWith('DA:')) {
      const [lineNum, hits] = line.slice(3).split(',');
      if (Number(hits) === 0) {
        uncoveredLines.push(Number(lineNum));
      }
    } else if (line.startsWith('BRDA:')) {
      const [lineNum, blockId, branchId, hits] = line.slice(5).split(',');
      if (hits === '-' || Number(hits) === 0) {
        uncoveredBranches.push({ line: Number(lineNum), block: Number(blockId), branch: Number(branchId) });
      }
    } else if (line.startsWith('end_of_record')) {
      if (currentFile && currentFile.endsWith('.ts')) {
        perFile.set(currentFile, { uncoveredLines, uncoveredBranches });
      }
      currentFile = null;
    }
  }

  return perFile;
}
