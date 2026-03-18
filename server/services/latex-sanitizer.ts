/**
 * LaTeX sanitizer — strips or rejects dangerous commands that could
 * allow arbitrary file reads, writes, or shell execution during compilation.
 */

const DANGEROUS_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\\write18\b/gi, description: '\\write18 (shell execution)' },
  { pattern: /\\immediate\s*\\write18\b/gi, description: '\\immediate\\write18 (shell execution)' },
  { pattern: /\\input\s*\{/gi, description: '\\input (file inclusion)' },
  { pattern: /\\include\s*\{/gi, description: '\\include (file inclusion)' },
  { pattern: /\\openout\b/gi, description: '\\openout (file write)' },
  { pattern: /\\openin\b/gi, description: '\\openin (file read)' },
  { pattern: /\\closein\b/gi, description: '\\closein (file handle)' },
  { pattern: /\\closeout\b/gi, description: '\\closeout (file handle)' },
  { pattern: /\\special\s*\{/gi, description: '\\special (driver command)' },
  { pattern: /\\catcode\b/gi, description: '\\catcode (category code manipulation)' },
  { pattern: /\\csname\b.*\\endcsname/gi, description: '\\csname...\\endcsname (dynamic command construction)' },
  { pattern: /\\directlua\b/gi, description: '\\directlua (Lua code execution)' },
  { pattern: /\\latelua\b/gi, description: '\\latelua (Lua code execution)' },
  { pattern: /\\luaexec\b/gi, description: '\\luaexec (Lua code execution)' },
  { pattern: /\\luadirect\b/gi, description: '\\luadirect (Lua code execution)' },
];

export interface SanitizeResult {
  safe: boolean;
  violations: string[];
  sanitized: string;
}

/**
 * Checks LaTeX content for dangerous commands.
 * Returns the list of violations found. Does NOT modify the content —
 * the caller decides whether to reject or strip.
 */
export function detectDangerousLatex(latex: string): string[] {
  const violations: string[] = [];
  for (const { pattern, description } of DANGEROUS_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    if (pattern.test(latex)) {
      violations.push(description);
    }
  }
  return violations;
}

/**
 * Strips dangerous commands from LaTeX content and returns the result.
 * Use this for AI-generated output where we want to silently remove bad commands.
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
 * Validates LaTeX content and throws if dangerous commands are found.
 * Use this as a hard gate before compilation.
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
 * Escapes unescaped LaTeX special characters in content areas.
 * Handles & characters that appear in text (not in tabular/align environments).
 * Skips already-escaped sequences like \&.
 */
export function escapeLatexSpecialChars(latex: string): string {
  // Escape unescaped & that are NOT inside tabular/align environments
  // and NOT already escaped (preceded by \)
  const lines = latex.split('\n');
  let inTabular = 0;

  return lines.map(line => {
    // Track tabular-like environments where & is a column separator
    if (/\\begin\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular++;
    if (/\\end\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular--;

    if (inTabular > 0) return line;

    // Replace unescaped & (not preceded by \) with \&
    return line.replace(/(?<!\\)&/g, '\\&');
  }).join('\n');
}
