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

export function buildAnalysisReport({ threshold, runOutcome, entries }) {
  return { threshold, runOutcome, entries: sortEntriesByRisk(entries) };
}
