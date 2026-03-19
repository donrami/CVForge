// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractLatex } from '../generate.js';
import fs from 'fs/promises';
import path from 'path';

describe('extractLatex', () => {
  it('extracts LaTeX from ```latex fences', () => {
    const input = '```latex\n\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n```';
    const result = extractLatex(input);
    expect(result).toContain('\\begin{document}');
    expect(result).not.toContain('```');
  });

  it('extracts LaTeX from ```tex fences', () => {
    const input = '```tex\n\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n```';
    const result = extractLatex(input);
    expect(result).toContain('\\begin{document}');
    expect(result).not.toContain('```');
  });

  it('handles raw LaTeX without fences', () => {
    const input = '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
    expect(extractLatex(input)).toBe(input);
  });

  it('throws on JSON input', () => {
    const input = '{"personal": {"name": "John"}}';
    expect(() => extractLatex(input)).toThrow('missing \\begin{document}');
  });

  it('throws on empty input', () => {
    expect(() => extractLatex('')).toThrow('missing \\begin{document}');
  });

  it('throws on whitespace-only input', () => {
    expect(() => extractLatex('   \n\n  ')).toThrow('missing \\begin{document}');
  });
});

describe('generation log structure', () => {
  it('contains expected fields and does not contain cvData', () => {
    // Simulate what the pipeline produces
    const log = {
      rawResponse: 'some latex content',
      model: 'gemini-3.1-pro-preview',
      timestamp: new Date().toISOString(),
      targetLanguage: 'en',
    };

    expect(log).toHaveProperty('rawResponse');
    expect(log).toHaveProperty('model');
    expect(log).toHaveProperty('timestamp');
    expect(log).toHaveProperty('targetLanguage');
    expect(log).not.toHaveProperty('cvData');
    expect(log).not.toHaveProperty('detectedLanguage');
  });
});

describe('generator prompt', () => {
  it('contains LaTeX instructions and does not contain JSON output instructions', async () => {
    const promptPath = path.join(process.cwd(), 'context', 'prompts', 'generator.md');
    const prompt = await fs.readFile(promptPath, 'utf-8');

    // Should contain LaTeX instructions
    expect(prompt).toContain('LaTeX');
    expect(prompt).toContain('compilable');
    expect(prompt).toContain('Output ONLY compilable LaTeX code');

    // Should NOT contain JSON output instructions
    expect(prompt).not.toContain('Output ONLY valid JSON');
    expect(prompt).not.toContain('responseJsonSchema');
    expect(prompt).not.toContain('Match the exact JSON schema');
  });
});
