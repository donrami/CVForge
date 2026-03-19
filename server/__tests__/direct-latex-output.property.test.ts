// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { stripDangerousLatex, deduplicatePreamble, escapeLatexSpecialChars } from '../services/latex-sanitizer.js';
import { extractLatex } from '../generate.js';

/**
 * Feature: direct-latex-output
 * Property-based tests for LaTeX sanitization and extraction functions.
 */

const DANGEROUS_COMMANDS = [
  '\\write18{rm -rf /}',
  '\\input{/etc/passwd}',
  '\\include{secrets}',
  '\\openout\\myfile',
  '\\openin\\myfile',
  '\\directlua{os.execute("ls")}',
  '\\immediate\\write18{echo pwned}',
];

describe('Feature: direct-latex-output, Property 1: Dangerous LaTeX commands are detected and stripped', () => {
  /**
   * Validates: Requirements 3.1, 3.4
   *
   * For any LaTeX string containing dangerous commands, stripDangerousLatex()
   * should return a result where violations is non-empty and the sanitized
   * output does not match any dangerous command patterns.
   */
  it('should detect and strip all dangerous commands from generated inputs', () => {
    const dangerousCommandArb = fc.constantFrom(...DANGEROUS_COMMANDS);
    const surroundingTextArb = fc.string({ minLength: 0, maxLength: 100 });

    fc.assert(
      fc.property(
        surroundingTextArb,
        dangerousCommandArb,
        surroundingTextArb,
        (before, dangerous, after) => {
          const input = `${before}${dangerous}${after}`;
          const result = stripDangerousLatex(input);

          // Violations must be non-empty since we injected a dangerous command
          expect(result.violations.length).toBeGreaterThan(0);
          expect(result.safe).toBe(false);

          // The sanitized output should not contain any dangerous patterns
          const dangerousPatterns = [
            /\\write18\b/gi,
            /\\immediate\s*\\write18\b/gi,
            /\\input\s*\{/gi,
            /\\include\s*\{/gi,
            /\\openout\b/gi,
            /\\openin\b/gi,
            /\\directlua\b/gi,
          ];
          for (const pattern of dangerousPatterns) {
            pattern.lastIndex = 0;
            expect(pattern.test(result.sanitized)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Feature: direct-latex-output, Property 2: Preamble deduplication is idempotent', () => {
  /**
   * Validates: Requirements 3.2
   *
   * For any LaTeX document with duplicate \\usepackage lines,
   * deduplicatePreamble() should produce output where each line appears
   * at most once. Applying it twice should produce the same result as once.
   */
  it('should deduplicate preamble entries and be idempotent', () => {
    const packageNames = ['geometry', 'amsmath', 'graphicx', 'hyperref', 'fontenc', 'babel', 'xcolor', 'tikz'];
    const packageArb = fc.array(fc.constantFrom(...packageNames), { minLength: 1, maxLength: 10 });

    fc.assert(
      fc.property(packageArb, (packages) => {
        // Build a preamble with intentional duplicates
        const preambleLines = packages.map((p) => `\\usepackage{${p}}`);
        const latex = `\\documentclass{article}\n${preambleLines.join('\n')}\n\\begin{document}\nHello\n\\end{document}`;

        const once = deduplicatePreamble(latex);
        const twice = deduplicatePreamble(once);

        // Idempotence: applying twice equals applying once
        expect(twice).toBe(once);

        // Each usepackage line should appear at most once in the preamble
        const docStart = once.indexOf('\\begin{document}');
        const preamble = once.slice(0, docStart);
        const preambleLinesSeen = preamble.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('\\usepackage'));
        const uniqueLines = new Set(preambleLinesSeen);
        expect(preambleLinesSeen.length).toBe(uniqueLines.size);
      }),
      { numRuns: 100 },
    );
  });
});


describe('Feature: direct-latex-output, Property 3: Ampersand escaping outside tabular', () => {
  /**
   * Validates: Requirements 3.3
   *
   * For any LaTeX string NOT inside a tabular environment, all & in the
   * output of escapeLatexSpecialChars() should be preceded by \\.
   */
  it('should escape all & characters outside tabular environments', () => {
    const textWithAmpersandsArb = fc.array(
      fc.constantFrom('a', 'b', 'c', ' ', '&', 'x', 'y', '1', '2', '\n'),
      { minLength: 1, maxLength: 80 },
    ).map((chars) => chars.join(''));

    fc.assert(
      fc.property(textWithAmpersandsArb, (text) => {
        // Ensure no tabular environments in input
        const input = text.replace(/\\begin\{tabular\}/g, '').replace(/\\end\{tabular\}/g, '');
        const result = escapeLatexSpecialChars(input);

        // Every & in the result should be preceded by \
        const lines = result.split('\n');
        for (const line of lines) {
          // Find all & characters and check they are escaped
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '&') {
              expect(i).toBeGreaterThan(0);
              expect(line[i - 1]).toBe('\\');
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


describe('Feature: direct-latex-output, Property 4: LaTeX extraction round-trip', () => {
  /**
   * Validates: Requirements 4.1, 4.2
   *
   * For any valid LaTeX document, wrapping in ```latex fences and calling
   * extractLatex() should return the original (trimmed). Calling on
   * unwrapped should also return it unchanged.
   */
  it('should extract LaTeX from fenced and unfenced inputs preserving content', () => {
    const contentArb = fc.string({ minLength: 0, maxLength: 200 }).filter(
      (s) => !s.includes('```'),
    );

    fc.assert(
      fc.property(contentArb, fc.boolean(), (content, useFences) => {
        const validLatex = `\\documentclass{article}\n\\begin{document}\n${content}\n\\end{document}`;

        const input = useFences ? `\`\`\`latex\n${validLatex}\n\`\`\`` : validLatex;

        const extracted = extractLatex(input);
        expect(extracted.trim()).toBe(validLatex.trim());
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: direct-latex-output, Property 5: Invalid LaTeX rejection', () => {
  /**
   * Validates: Requirements 4.3, 8.3
   *
   * For any string NOT containing \\begin{document}, extractLatex() should throw.
   */
  it('should throw for any input missing \\begin{document}', () => {
    const invalidArb = fc.string({ minLength: 0, maxLength: 300 }).filter(
      (s) => !s.includes('\\begin{document}'),
    );

    fc.assert(
      fc.property(invalidArb, (input) => {
        expect(() => extractLatex(input)).toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
