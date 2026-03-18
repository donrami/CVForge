import { Router } from 'express';
import { prisma, ai } from '../server.js';
import { requireAuth } from './routes.js';
import fs from 'fs/promises';
import path from 'path';
import { stripDangerousLatex } from './services/latex-sanitizer.js';
import { logger } from './services/logger.js';
import { prepareProfileImage } from './services/profile-image.js';

export const generateRouter = Router();

// ... prompts remain the same ...
const GENERATOR_PROMPT = `
You are a professional CV writer with deep expertise in both English and German job markets.
You are given a master CV in LaTeX format, supporting context documents, and a job description.
Your task is to produce a tailored LaTeX CV that:

ABSOLUTE RULES:
- Never invent facts, skills, technologies, dates, or achievements not present in the source documents
- Never exaggerate or stretch facts beyond reasonable professional framing
- Never use AI-generated filler phrases: "passionate about", "results-driven", "dynamic", "leverage", "spearhead", "synergy", "fast-paced environment", or similar
- Output only valid, compilable LaTeX — no markdown, no explanation, no preamble text
- CRITICAL: Preserve the ENTIRE document structure from the master CV EXACTLY:
  * Keep the same document class (article, scrlttr2, etc.)
  * Keep ALL packages and preamble commands
  * Keep the same section headings (\section{...}) in the SAME ORDER
  * Keep the same column layout (paracol, minipage, etc.)
  * Keep the same formatting (titleformat, colors, fonts, etc.)
  * NEVER add, remove, or reorder sections - only modify their content
- Only modify the text content within each section - never change the LaTeX markup

GERMAN CV RULES (apply only when target language is DE):
- Use formal "Sie" register throughout
- Follow chronological reverse order (most recent first)
- Include Lichtbild placeholder comment if photo section exists in master
- Use German date format: MM/YYYY or month written out
- Section headers: Berufserfahrung, Ausbildung, Kenntnisse, Sprachen, Zertifikate
- Achievements written as noun phrases, not action verb sentences (German convention)
- No "References available upon request" — omit entirely
- Personal data section (Persönliche Daten) with standard German fields if present in master

ENGLISH CV RULES (apply only when target language is EN):
- Use action verbs at the start of bullet points
- Quantify achievements wherever the source data supports it
- ATS-friendly: mirror keywords from the job description naturally
- No personal data beyond name and contact info

TAILORING RULES:
- Reorder and emphasize experience sections to match the job description priorities
- Surface relevant skills from the master CV that match the job requirements
- Adjust the professional summary/profile to speak directly to this role
- De-emphasize irrelevant experience (do not remove, just condense)

OUTPUT: Return only the complete LaTeX source. Nothing else.
`;

const CRITIQUE_PROMPT = `
You are a strict CV quality reviewer. You are given a LaTeX CV that was generated for a specific job.
Your task is to:

1. Identify any violations of the rules listed below
2. Identify any AI-sounding language
3. Identify any factual inventions or stretches not supported by the original context
4. Identify any LaTeX syntax issues
5. Identify any changes to the document structure (sections, columns, formatting) that don't match the master CV
6. Rewrite the CV fixing all identified issues

RULES TO CHECK:
- Never invent facts, skills, technologies, dates, or achievements not present in the source documents
- Never exaggerate or stretch facts beyond reasonable professional framing
- Never use AI-generated filler phrases: "passionate about", "results-driven", "dynamic", "leverage", "spearhead", "synergy", "fast-paced environment", or similar
- Output only valid, compilable LaTeX — no markdown, no explanation, no preamble text
- CRITICAL: Preserve the ENTIRE document structure from the master CV EXACTLY:
  * Keep the same document class
  * Keep ALL packages and preamble commands
  * Keep the same section headings in the SAME ORDER
  * Keep the same column layout
  * Keep the same formatting
  * NEVER add, remove, or reorder sections
- Only modify the text content within each section - never change the LaTeX markup

OUTPUT FORMAT:
First output a CRITIQUE section (plain text) listing all issues found.
Then output the corrected LaTeX, clearly separated by the delimiter: ---LATEX---
If no issues are found, write "CRITIQUE: None" and then ---LATEX--- followed by the unchanged LaTeX.
`;

const VALIDATION_PROMPT = `
You are performing a final quality gate check on this LaTeX CV.
Answer each question with YES or NO and a one-line explanation:

1. Does the CV contain any invented facts not present in the source context?
2. Does the CV contain any AI-sounding filler phrases?
3. Does the CV preserve the EXACT same document structure as the master CV (sections in same order, same columns, same formatting)?
4. Does the LaTeX appear structurally valid (matching braces, no obvious compile errors)?
5. Is the CV well-tailored to the job description, or is it generic?

Then output: PASS or FAIL
If FAIL, output the corrected LaTeX after the delimiter: ---LATEX---
If PASS, output: ---LATEX--- followed by the unchanged content.
`;

const handleGenerate = async (req: any, res: any) => {
  const { jobDescription, companyName, jobTitle, targetLanguage, iterationCount, additionalContext, parentId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    sendEvent('step', { message: 'Assembling context...' });
    const contextDir = path.join(process.cwd(), 'context');
    
    const readContextFile = async (name: string) => {
      try { return await fs.readFile(path.join(contextDir, name), 'utf-8'); } catch { return ''; }
    };
    const masterCv = await readContextFile('master-cv.tex');
    const certs = await readContextFile('certificates.md');
    const instructions = await readContextFile('instructions.md');

    const fullContext = `
MASTER CV:
${masterCv}

CERTIFICATES:
${certs}

INSTRUCTIONS:
${instructions}

JOB DESCRIPTION:
${jobDescription}

COMPANY: ${companyName}
TITLE: ${jobTitle}
TARGET LANGUAGE: ${targetLanguage}
ADDITIONAL CONTEXT: ${additionalContext || 'None'}
`;

    sendEvent('step', { message: 'Initial generation pass...' });
    
    let currentLatex = '';
    const generationLog = [];

    const initialResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `${GENERATOR_PROMPT}\n\nCONTEXT:\n${fullContext}`,
    });
    
    currentLatex = initialResponse.text || '';
    currentLatex = currentLatex.replace(/^```latex\n/, '').replace(/\n```$/, '');
    
    generationLog.push({ pass: 0, critique: 'Initial Generation', output: currentLatex });

    const maxIterations = Math.min(Math.max(iterationCount || 2, 1), 5);

    for (let i = 1; i <= maxIterations; i++) {
      sendEvent('step', { message: `Running critique pass ${i}/${maxIterations}...` });
      
      const critiqueResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `${CRITIQUE_PROMPT}\n\nCURRENT LATEX:\n${currentLatex}`,
      });

      const responseText = critiqueResponse.text || '';
      const parts = responseText.split('---LATEX---');
      const critique = parts[0].trim();
      if (parts.length > 1) {
        currentLatex = parts[1].trim().replace(/^```latex\n/, '').replace(/\n```$/, '');
      }
      
      generationLog.push({ pass: i, critique, output: currentLatex });
      sendEvent('iteration', { pass: i, critique });
    }

    sendEvent('step', { message: 'Final validation pass...' });
    const validationResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `${VALIDATION_PROMPT}\n\nCURRENT LATEX:\n${currentLatex}`,
    });

    const valText = validationResponse.text || '';
    const valParts = valText.split('---LATEX---');
    const validationCritique = valParts[0].trim();
    if (valParts.length > 1) {
      currentLatex = valParts[1].trim().replace(/^```latex\n/, '').replace(/\n```$/, '');
    }
    
    generationLog.push({ pass: maxIterations + 1, critique: validationCritique, output: currentLatex });

    // Sanitize AI-generated LaTeX before saving
    const sanitizeResult = stripDangerousLatex(currentLatex);
    if (!sanitizeResult.safe) {
      logger.warn({ violations: sanitizeResult.violations }, 'Stripped dangerous LaTeX commands from AI output');
    }
    currentLatex = sanitizeResult.sanitized;

    sendEvent('step', { message: 'Saving application...' });
    
    const app = await prisma.application.create({
      data: {
        companyName,
        jobTitle,
        jobDescription,
        targetLanguage,
        iterationCount: maxIterations,
        additionalContext,
        latexOutput: currentLatex,
        generationLog: JSON.stringify(generationLog),
        parentId
      }
    });

    const genDir = path.join(process.cwd(), 'generated', app.id);
    await fs.mkdir(genDir, { recursive: true });
    
    // Handle profile image and write final LaTeX
    currentLatex = await prepareProfileImage(currentLatex, genDir);
    await fs.writeFile(path.join(genDir, 'cv.tex'), currentLatex);

    sendEvent('complete', { applicationId: app.id });
    res.end();

  } catch (e: any) {
    logger.error({ err: e }, 'Generation pipeline failed');
    sendEvent('error', { message: e.message });
    res.end();
  }
};

generateRouter.post('/generate', requireAuth, handleGenerate);

generateRouter.post('/applications/:id/regenerate', requireAuth, async (req, res) => {
  const { additionalContext, iterationCount, targetLanguage } = req.body;
  const parentApp = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!parentApp) return res.status(404).json({ error: 'Parent application not found' });
  
  req.body = {
    jobDescription: parentApp.jobDescription,
    companyName: parentApp.companyName,
    jobTitle: parentApp.jobTitle,
    targetLanguage: targetLanguage || parentApp.targetLanguage,
    iterationCount: iterationCount || parentApp.iterationCount,
    additionalContext: additionalContext || parentApp.additionalContext,
    parentId: parentApp.id
  };
  
  return handleGenerate(req, res);
});
