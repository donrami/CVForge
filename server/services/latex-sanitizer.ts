/**
 * LaTeX Sanitizer — security layer for direct LLM LaTeX output
 * 
 * The LLM produces LaTeX directly, so this module is the primary
 * safety gate. It strips dangerous commands, deduplicates preamble
 * entries, and escapes special characters in text content.
 */

const DANGEROUS_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\\write18\b/gi, description: '\\write18 (shell execution)' },
  { pattern: /\\immediate\s*\\write18\b/gi, description: '\\immediate\\write18 (shell execution)' },
  { pattern: /\\input\s*\{/gi, description: '\\input (file inclusion)' },
  { pattern: /\\include\s*\{/gi, description: '\\include (file inclusion)' },
  { pattern: /\\openout\b/gi, description: '\\openout (file write)' },
  { pattern: /\\openin\b/gi, description: '\\openin (file read)' },
  { pattern: /\\directlua\b/gi, description: '\\directlua (Lua code execution)' },
];

export interface SanitizeResult {
  safe: boolean;
  violations: string[];
  sanitized: string;
}

/**
 * Detect dangerous LaTeX commands
 */
export function detectDangerousLatex(latex: string): string[] {
  const violations: string[] = [];
  for (const { pattern, description } of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(latex)) {
      violations.push(description);
    }
  }
  return violations;
}

/**
 * Strip dangerous commands (for backward compatibility)
 */
export function stripDangerousLatex(latex: string): SanitizeResult {
  const violations = detectDangerousLatex(latex);
  let sanitized = latex;

  for (const { pattern } of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, '% [REMOVED: dangerous command]');
  }

  return { safe: violations.length === 0, violations, sanitized };
}

/**
 * Validate LaTeX before compilation (hard gate)
 */
export function assertSafeLatex(latex: string): void {
  const violations = detectDangerousLatex(latex);
  if (violations.length > 0) {
    throw new Error(
      `LaTeX content contains dangerous commands: ${violations.join(', ')}`
    );
  }
}

/**
 * Deduplicate preamble entries
 */
export function deduplicatePreamble(latex: string): string {
  const docStart = latex.indexOf('\\begin{document}');
  if (docStart === -1) return latex;

  const preamble = latex.slice(0, docStart);
  const body = latex.slice(docStart);

  const seen = new Set<string>();
  const dedupedLines: string[] = [];

  for (const line of preamble.split('\n')) {
    const trimmed = line.trim();
    if (/^\\(usepackage|newcommand|renewcommand|definecolor|setlength|pagestyle)\b/.test(trimmed)) {
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
    }
    dedupedLines.push(line);
  }

  return dedupedLines.join('\n') + body;
}

/**
 * Escape LaTeX special characters in text content.
 * Replaces unescaped & with \& outside tabular-like environments
 * where & serves as a column separator.
 */
export function escapeLatexSpecialChars(latex: string): string {
  const lines = latex.split('\n');
  let inTabular = 0;

  return lines.map(line => {
    // Track tabular environments where & is a column separator
    if (/\\begin\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular++;
    if (/\\end\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular--;

    if (inTabular > 0) return line;

    // Replace unescaped & with \&
    return line.replace(/(?<!\\)&/g, '\\&');
  }).join('\n');
}
