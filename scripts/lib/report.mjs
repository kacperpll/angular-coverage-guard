function sortKey(entry) {
  // "No dedicated spec" entries sort as if worse than any measured percentage (including a
  // measured 0%), without claiming they *are* 0% in the reported data — see spec-finder.mjs.
  const pct = entry.hasSpec ? (entry.lines?.pct ?? 0) : -1;
  return { tier: entry.tier, hasLogicSignal: entry.hasLogicSignal, pct, file: entry.file };
}

export function sortEntriesByRisk(entries) {
  return [...entries].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);

    if (ka.tier !== kb.tier) {
      return ka.tier - kb.tier;
    }

    if (ka.hasLogicSignal !== kb.hasLogicSignal) {
      return ka.hasLogicSignal ? -1 : 1;
    }

    if (ka.pct !== kb.pct) {
      return ka.pct - kb.pct;
    }

    return ka.file.localeCompare(kb.file);
  });
}

// Tier 1-2 files that meet the line threshold never show up as a "gap" by lines.pct alone, but a
// file can hit its line threshold while a specific branch (e.g. one business rule inside an
// if/else) is never exercised. Surfaced separately so the skill proposes tests for these the same
// way it does for files below threshold, instead of silently passing them over.
export function buildBranchGaps(entries, threshold) {
  return entries
    .filter(
      (entry) =>
        entry.hasSpec &&
        entry.tier <= 2 &&
        (entry.lines?.pct ?? 0) >= threshold &&
        (entry.uncoveredBranches?.length ?? 0) > 0,
    )
    .map((entry) => ({ file: entry.file, uncoveredBranches: entry.uncoveredBranches }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

export function buildAnalysisReport({ threshold, runOutcome, entries }) {
  return {
    threshold,
    runOutcome,
    entries: sortEntriesByRisk(entries),
    branchGaps: buildBranchGaps(entries, threshold),
  };
}
