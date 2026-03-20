// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { escapeLatexSpecialChars } from '../services/latex-sanitizer.js';

describe('escapeLatexSpecialChars', () => {
  // --- & (ampersand) ---
  describe('ampersand (&)', () => {
    it('escapes & in plain text', () => {
      const input = '\\begin{document}\nR\\&D & Strategy\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('R\\&D \\& Strategy');
    });

    it('preserves & inside tabular environments', () => {
      const input = '\\begin{tabular}{ll}\nA & B\n\\end{tabular}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('A & B');
    });

    it('does not double-escape already escaped \\&', () => {
      const input = '\\begin{document}\nR\\&D\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('R\\&D');
      expect(result).not.toContain('R\\\\&D');
    });
  });

  // --- % (percent) ---
  describe('percent (%)', () => {
    it('escapes % in plain text', () => {
      const input = '\\begin{document}\nImproved efficiency by 30%\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('30\\%');
    });

    it('preserves full-line comments starting with %', () => {
      const input = '% This is a comment\n\\begin{document}\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('% This is a comment');
    });

    it('preserves % inside \\href{} arguments', () => {
      const input = '\\begin{document}\n\\href{https://example.com/path%20with%20spaces}{Link}\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('path%20with%20spaces');
    });

    it('preserves % inside \\url{} arguments', () => {
      const input = '\\begin{document}\n\\url{https://example.com/100%25}\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('100%25');
    });
  });

  // --- # (hash) ---
  describe('hash (#)', () => {
    it('escapes # in plain text', () => {
      const input = '\\begin{document}\nIssue #42 resolved\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('Issue \\#42');
    });

    it('preserves # in \\newcommand definitions', () => {
      const input = '\\newcommand{\\foo}[1]{Hello #1}\n\\begin{document}\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('Hello #1');
    });

    it('preserves # in \\renewcommand definitions', () => {
      const input = '\\renewcommand{\\bar}[2]{#1 and #2}\n\\begin{document}\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('#1 and #2');
    });
  });

  // --- _ (underscore) ---
  describe('underscore (_)', () => {
    it('escapes _ in plain text', () => {
      const input = '\\begin{document}\nfile_name here\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('file\\_name');
    });

    it('preserves _ inside math mode', () => {
      const input = '\\begin{document}\n$x_1 + x_2$\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('$x_1 + x_2$');
    });
  });

  // --- ^ (caret) ---
  describe('caret (^)', () => {
    it('escapes ^ in plain text', () => {
      const input = '\\begin{document}\n10^3 items\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('10\\^{}3');
    });

    it('preserves ^ inside math mode', () => {
      const input = '\\begin{document}\n$2^{10}$\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('$2^{10}$');
    });
  });

  // --- Combined scenarios ---
  describe('combined characters', () => {
    it('handles multiple special chars on one line', () => {
      const input = '\\begin{document}\n30% growth & 5# issues with file_v2\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      expect(result).toContain('30\\%');
      expect(result).toContain('\\&');
      expect(result).toContain('5\\#');
      expect(result).toContain('file\\_v2');
    });

    it('handles math mode mixed with text on same line', () => {
      const input = '\\begin{document}\nThe formula $x_1^2$ shows 50% improvement\n\\end{document}';
      const result = escapeLatexSpecialChars(input);
      // Math mode preserved
      expect(result).toContain('$x_1^2$');
      // Text escaped
      expect(result).toContain('50\\%');
    });
  });
});
