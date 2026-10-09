// Content is checked first so classification works regardless of file-naming style (classic
// `*.guard.ts` suffixes or the concise 2025 style guide, which drops them). The filename-suffix
// fallback only applies when no content signal matches.
const CONTENT_SIGNALS = [
  { tier: 1, patterns: [/\bCanActivateFn\b/, /\bCanMatchFn\b/, /\bCanActivateChildFn\b/, /implements\s+Can(Activate|Match)(Child)?\b/] },
  { tier: 1, patterns: [/\bHttpInterceptorFn\b/, /implements\s+HttpInterceptor\b/] },
  { tier: 1, patterns: [/\bResolveFn\b/, /implements\s+Resolve\b/] },
  { tier: 2, patterns: [/@Injectable\s*\(/] },
  { tier: 2, patterns: [/@Pipe\s*\(/] },
  { tier: 2, patterns: [/@Directive\s*\(/] },
  { tier: 3, patterns: [/@Component\s*\(/] },
];

const FILENAME_SUFFIX_TIERS = [
  { tier: 1, test: (p) => /\.(guard|interceptor|resolver)\.ts$/.test(p) },
  {
    tier: 2,
    test: (p) =>
      /\.(service|pipe|directive|validator|validators|reducer|effects|selectors|store|util|utils|helper)\.ts$/.test(p) ||
      /\/(utils|util|helpers)\//.test(p),
  },
];

export function classifyTier(relativePath, fileContents) {
  for (const signal of CONTENT_SIGNALS) {
    if (signal.patterns.some((pattern) => pattern.test(fileContents))) {
      return signal.tier;
    }
  }

  for (const fallback of FILENAME_SUFFIX_TIERS) {
    if (fallback.test(relativePath)) {
      return fallback.tier;
    }
  }

  return 3;
}

const LOGIC_SIGNAL_PATTERNS = [
  /\binject\(/,
  /constructor\s*\(\s*(private|public|protected|readonly)/,
  /\bsubscribe\(/,
  /\bSubject\b/,
  /\bObservable\b/,
  /\beffect\(/,
  /\bcomputed\(/,
];

export function hasLogicSignal(fileContents) {
  return LOGIC_SIGNAL_PATTERNS.some((pattern) => pattern.test(fileContents));
}
