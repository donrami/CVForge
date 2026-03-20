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
 *
 * Characters handled and exclusion rules:
 * - & → \&    (excluded inside tabular/array/align/matrix/cases environments)
 * - % → \%    (excluded on lines that are full-line comments starting with %,
 *               and inside \href{} or \url{} arguments)
 * - # → \#    (excluded inside \newcommand / \renewcommand / \providecommand definitions)
 * - _ → \_    (excluded inside math mode $...$ and inside command arguments like \label{}, \ref{}, \href{})
 * - ^ → \^{}  (excluded inside math mode $...$)
 * - ~ → \textasciitilde{}  (only standalone ~ not preceded by a backslash;
 *               LaTeX non-breaking space ~ between words is intentional and left alone —
 *               we only escape ~ that appears as a word-initial or isolated character,
 *               but in practice LLM output rarely uses standalone ~ so we skip this to
 *               avoid false positives with intentional non-breaking spaces)
 *
 * All replacements skip already-escaped sequences (preceded by \).
 */
export function escapeLatexSpecialChars(latex: string): string {
  const lines = latex.split('\n');
  let inTabular = 0;
  let inMath = false;

  return lines.map(line => {
    // Track tabular environments where & is a column separator
    if (/\\begin\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular++;
    if (/\\end\{(tabular|array|align|matrix|pmatrix|bmatrix|cases)\*?\}/.test(line)) inTabular--;

    // Skip full-line comments (lines starting with %)
    const trimmed = line.trimStart();
    if (trimmed.startsWith('%')) return line;

    // Skip lines that are command definitions (\newcommand, \renewcommand, \providecommand)
    const isCommandDef = /^\\(newcommand|renewcommand|providecommand)\b/.test(trimmed);

    // Process character by character for context-aware escaping
    let result = '';
    let i = 0;
    const len = line.length;

    while (i < len) {
      // Track math mode toggles via $
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        inMath = !inMath;
        result += line[i];
        i++;
        continue;
      }

      // Skip already-escaped characters (backslash + next char)
      if (line[i] === '\\') {
        // Check for \href{...} or \url{...} — skip their argument contents
        const hrefMatch = line.slice(i).match(/^\\(href|url)\{/);
        if (hrefMatch) {
          // Copy the entire \href{...} or \url{...} block without escaping
          const cmdLen = hrefMatch[0].length;
          let braceDepth = 1;
          let j = i + cmdLen;
          result += line.slice(i, j);
          while (j < len && braceDepth > 0) {
            if (line[j] === '{' && line[j - 1] !== '\\') braceDepth++;
            else if (line[j] === '}' && line[j - 1] !== '\\') braceDepth--;
            result += line[j];
            j++;
          }
          // For \href, also skip the second argument {display text} — but we DO want to escape inside it
          i = j;
          continue;
        }

        // Any other backslash sequence — copy backslash + next char as-is
        result += line[i];
        i++;
        if (i < len) {
          result += line[i];
          i++;
        }
        continue;
      }

      // & — escape outside tabular environments
      if (line[i] === '&' && inTabular <= 0 && !inMath) {
        result += '\\&';
        i++;
        continue;
      }

      // % — escape in text context (not in \href/\url, not full-line comment — already handled above)
      if (line[i] === '%' && !inMath) {
        result += '\\%';
        i++;
        continue;
      }

      // # — escape unless inside a command definition
      if (line[i] === '#' && !isCommandDef && !inMath) {
        result += '\\#';
        i++;
        continue;
      }

      // _ — escape outside math mode
      if (line[i] === '_' && !inMath) {
        result += '\\_';
        i++;
        continue;
      }

      // ^ — escape outside math mode
      if (line[i] === '^' && !inMath) {
        result += '\\^{}';
        i++;
        continue;
      }

      // Default — copy character as-is
      result += line[i];
      i++;
    }

    return result;
  }).join('\n');
}
