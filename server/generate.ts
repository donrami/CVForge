import { Router } from 'express';
import { prisma, ai } from '../server.js';
import { requireAuth } from './routes.js';
import fs from 'fs/promises';
import path from 'path';
import { escapeLatexSpecialChars, deduplicatePreamble, stripDangerousLatex } from './services/latex-sanitizer.js';
import { logger } from './services/logger.js';
import { prepareProfileImage } from './services/profile-image.js';
import { loadAllPrompts } from './services/prompts.js';

export const generateRouter = Router();

/**
 * Generator prompt is loaded from context/prompts/generator.md at runtime.
 * No hardcoded fallback — the file is the single source of truth.
 * If the file is missing, generation will fail with a clear error.
 */

/**
 * Extract LaTeX from LLM response, stripping markdown fences if present.
 * Validates that the result contains \begin{document}.
 */
export function extractLatex(responseText: string): string {
  let latex = responseText;

  // Strip markdown fences if present
  const fenceMatch = latex.match(/```(?:latex|tex)\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    latex = fenceMatch[1];
  }

  latex = latex.trim();

  if (!latex.includes('\\begin{document}')) {
    throw new Error('LLM response is not valid LaTeX: missing \\begin{document}');
  }

  return latex;
}

const handleGenerate = async (req: any, res: any) => {
  const { jobDescription, companyName, jobTitle, targetLanguage, additionalContext, parentId } = req.body;
  
  // Convert targetLanguage to uppercase for Prisma enum (EN, DE)
  const normalizedLanguage = (targetLanguage || 'en').toUpperCase();
  // Use lowercase for LLM prompt (prompt expects "en" or "de")
  const promptLanguage = normalizedLanguage.toLowerCase();
  
  // DEBUG: Log the target language being used
  logger.info({ targetLanguage, normalizedLanguage, promptLanguage }, 'Generation requested with target language');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    sendEvent('step', { message: 'Assembling context...' });

    // Load the generator prompt — must exist on disk, no hardcoded fallback
    const prompts = await loadAllPrompts();
    const generatorPrompt = prompts.generator;
    if (!generatorPrompt || generatorPrompt.trim().length === 0) {
      throw new Error('Generator prompt is empty or missing. Ensure context/prompts/generator.md exists and contains the prompt.');
    }

    const contextDir = path.join(process.cwd(), 'context');
    
    const readContextFile = async (name: string) => {
      try { return await fs.readFile(path.join(contextDir, name), 'utf-8'); } catch { return ''; }
    };
    const masterCv = await readContextFile('master-cv.tex');
    const certs = await readContextFile('certificates.md');

     const generationContext = `
MASTER CV (SOURCE OF TRUTH):
${masterCv}

CERTIFICATES:
${certs}

JOB DESCRIPTION:
${jobDescription}

COMPANY: ${companyName}
TITLE: ${jobTitle}
TARGET LANGUAGE: ${promptLanguage}
ADDITIONAL CONTEXT: ${additionalContext || 'None'}

IMPORTANT: Always use TARGET LANGUAGE = "${promptLanguage}" for the output format and language selection. Do not detect language from the master CV.
`;

    sendEvent('step', { message: 'Analyzing job requirements and crafting your CV...' });

    const modelId = 'gemini-3-flash-preview';
    
    // Use streaming to provide live progress during the long AI generation step
    const stream = await ai.models.generateContentStream({
      model: modelId,
      contents: `${generatorPrompt}\n\nCONTEXT:\n${generationContext}`,
      config: {},
    });

    let responseText = '';
    let lastProgressAt = 0;

    for await (const chunk of stream) {
      const text = chunk.text || '';
      responseText += text;

      if (responseText.length - lastProgressAt >= 300) {
        lastProgressAt = responseText.length;
        sendEvent('ai-progress', {
          chars: responseText.length,
        });
      }
    }

    sendEvent('ai-progress', { chars: responseText.length, done: true });
    
    sendEvent('step', { message: 'Compiling and saving...' });

    // Extract LaTeX from response
    let latexOutput = extractLatex(responseText);

    // Sanitize
    const sanitizeResult = stripDangerousLatex(latexOutput);
    if (!sanitizeResult.safe) {
      logger.warn({ violations: sanitizeResult.violations }, 'Stripped dangerous LaTeX commands from LLM output');
    }
    latexOutput = sanitizeResult.sanitized;
    latexOutput = deduplicatePreamble(latexOutput);
    latexOutput = escapeLatexSpecialChars(latexOutput);

    // Profile image handling (unchanged)
    const genDir = path.join(process.cwd(), 'generated', Date.now().toString());
    await fs.mkdir(genDir, { recursive: true });
    latexOutput = await prepareProfileImage(latexOutput, genDir);

    const app = await prisma.application.create({
      data: {
        companyName,
        jobTitle,
        jobDescription,
        targetLanguage: normalizedLanguage,
        iterationCount: 0,
        additionalContext,
        latexOutput,
        generationLog: JSON.stringify({
          rawResponse: responseText,
          model: modelId,
          timestamp: new Date().toISOString(),
          targetLanguage: targetLanguage,
        }),
        parentId
      }
    });

    // Write LaTeX to file
    await fs.writeFile(path.join(genDir, 'cv.tex'), latexOutput);

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
  const { additionalContext, targetLanguage } = req.body;
  const parentApp = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!parentApp) return res.status(404).json({ error: 'Parent application not found' });
  
  req.body = {
    jobDescription: parentApp.jobDescription,
    companyName: parentApp.companyName,
    jobTitle: parentApp.jobTitle,
    targetLanguage: targetLanguage || parentApp.targetLanguage,
    additionalContext: additionalContext || parentApp.additionalContext,
    parentId: parentApp.id
  };
  
  return handleGenerate(req, res);
});
