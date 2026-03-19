// @vitest-environment node
/**
 * Property-based tests for master CV tailoring.
 *
 * Generates 2 tailored CVs from synthetic JDs via the real Gemini API,
 * then verifies all 10 correctness properties against each output.
 * This keeps LLM calls to a minimum (2 total) while still exercising
 * the property checks across different inputs.
 *
 * Requires GEMINI_API_KEY in .env.
 */
import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import {
  extractJobPositions,
  extractSection,
  extractSkillGroups,
  countItems,
  extractStructuralElements,
  extractSectionOrder,
} from './latex-test-helpers';
import { loadAllPrompts } from '../prompts.js';

// ── Helpers ─────────────────────────────────────────────────────

function extractLatex(responseText: string): string {
  let latex = responseText;
  const fenceMatch = latex.match(/```(?:latex|tex)\s*([\s\S]*?)```/i);
  if (fenceMatch) latex = fenceMatch[1];
  latex = latex.trim();
  if (!latex.includes('\\begin{document}')) {
    throw new Error('LLM response is not valid LaTeX: missing \\begin{document}');
  }
  return latex;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function stripLatex(text: string): string {
  let s = text;
  s = s.replace(/~/g, ' ');
  s = s.replace(/\\&/g, '&');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\text(?:bf|it)\{([^}]*)\}/g, '$1');
  s = s.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1');
  s = s.replace(/\\[a-zA-Z]+/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const KNOWN_TOOL_NAMES: string[] = [
  'YOLOv11', 'Florence-2', 'RAG', 'TypeScript', 'React', 'Node.js',
  'FastAPI', 'Python', 'Docker', 'Redis', 'PostgreSQL', 'Drizzle ORM',
  'GitHub Actions', 'MCP',
  'VGSTUDIO MAX', 'JIRA', 'FLEXERA', 'Revenera', 'WIBU CodeMeter',
  '3DCS',
  'CATIA V5', 'Smaragd', 'Teamcenter', 'Enventive', 'VisVSA',
  'Cadenas PartSolution',
  'ANSYS', 'Fortran', 'Bash',
  'ISO 1101', 'ISO 5459', 'ISO 5458', 'ISO 14405-1', 'ISO 1660',
  'ISO 2692', 'ASME Y14.5',
  'BDG-P201', 'BDG-P202', 'BDG-P203',
  'ASTM E1441', 'ASTM E1695',
  'ISO-GPS',
];

function extractToolNamesFromText(text: string, knownTools: string[]): string[] {
  const plain = stripLatex(text).toLowerCase();
  return knownTools.filter((tool) => {
    const toolLower = tool.toLowerCase();
    if (toolLower.length <= 3) {
      const escaped = toolLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(plain);
    }
    return plain.includes(toolLower);
  });
}

function extractMetrics(text: string): string[] {
  const plain = stripLatex(text);
  const metrics: string[] = [];
  const pctMatches = plain.match(/\d+[\.,]?\d*\s*%/g);
  if (pctMatches) metrics.push(...pctMatches);
  const germanDecimalMatches = plain.match(/\d+,\d+/g);
  if (germanDecimalMatches) metrics.push(...germanDecimalMatches);
  return [...new Set(metrics)];
}

function tokenize(text: string): Set<string> {
  const plain = stripLatex(text).toLowerCase();
  return new Set(plain.split(/\s+/).filter((w) => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function findBestMatchingBullet(
  generatedBullet: string,
  masterBullets: string[],
  threshold = 0.15,
): { masterBullet: string; similarity: number } | null {
  const genTokens = tokenize(generatedBullet);
  let bestMatch: { masterBullet: string; similarity: number } | null = null;
  for (const masterBullet of masterBullets) {
    const masterTokens = tokenize(masterBullet);
    const sim = jaccardSimilarity(genTokens, masterTokens);
    if (sim > (bestMatch?.similarity ?? 0)) bestMatch = { masterBullet, similarity: sim };
  }
  return bestMatch && bestMatch.similarity >= threshold ? bestMatch : null;
}

// ── Gemini client & context ─────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function loadContext() {
  const contextDir = path.join(process.cwd(), 'context');
  const masterCv = await fs.readFile(path.join(contextDir, 'master-cv.tex'), 'utf-8');
  const certs = await fs.readFile(path.join(contextDir, 'certificates.md'), 'utf-8').catch(() => '');
  const prompts = await loadAllPrompts();
  return { masterCv, certs, generatorPrompt: prompts.generator };
}

async function generateTailoredCv(jd: string, ctx: Awaited<ReturnType<typeof loadContext>>): Promise<string> {
  const generationContext = `
MASTER CV (SOURCE OF TRUTH):
${ctx.masterCv}

CERTIFICATES:
${ctx.certs}

JOB DESCRIPTION:
${jd}

COMPANY: Test GmbH
TITLE: Test Position
TARGET LANGUAGE: de
ADDITIONAL CONTEXT: None

IMPORTANT: Always use TARGET LANGUAGE = "de" for the output format and language selection.
`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `${ctx.generatorPrompt}\n\nCONTEXT:\n${generationContext}`,
    config: {},
  });
  return extractLatex(response.text ?? '');
}

// ── Property tests (TODO: implement with reduced LLM calls) ─────
// Properties 1–10 will be implemented in a future pass.
// Infrastructure above (helpers, context loading, generation) is ready.
