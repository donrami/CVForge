import { Router } from 'express';
import { prisma, ai } from '../server.js';
import { requireAuth } from './routes.js';
import fs from 'fs/promises';
import path from 'path';
import { escapeLatexSpecialChars, deduplicatePreamble, stripDangerousLatex } from './services/latex-sanitizer.js';
import { logger } from './services/logger.js';
import { prepareProfileImage } from './services/profile-image.js';
import { loadAllPrompts } from './services/prompts.js';
import { createJob, startJob, updateJobProgress, completeJob, failJob, JobProgress } from './services/job.js';
import { getGenDir } from './utils/gen-dir.js';

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

/**
 * The actual CV generation logic - separated from HTTP handling.
 * This can be called synchronously or via setImmediate for background processing.
 */
export async function processGeneration(jobId: string) {
  // Load job from database
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logger.error({ jobId }, 'Job not found');
    return;
  }

  const { companyName, jobTitle, jobDescription, targetLanguage, additionalContext, parentId } = job;

  // Convert targetLanguage to uppercase for Prisma enum (EN, DE)
  const normalizedLanguage = (targetLanguage || 'EN').toUpperCase();
  // Use lowercase for LLM prompt (prompt expects "en" or "de")
  const promptLanguage = normalizedLanguage.toLowerCase();

  try {
    await startJob(jobId);
    await updateJobProgress(jobId, { phase: 'preparing', aiChars: 0 });

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
    const instructions = await readContextFile('instructions.md');
    if (!instructions || instructions.trim().length === 0) {
      logger.debug('instructions.md not found or empty — skipping optional context');
    }

    const generationContext = `
MASTER CV (SOURCE OF TRUTH):
${masterCv}

CERTIFICATES:
${certs}
${instructions && instructions.trim().length > 0 ? `\nPERSONAL INSTRUCTIONS:\n${instructions}\n` : ''}
JOB DESCRIPTION:
${jobDescription}

COMPANY: ${companyName}
TITLE: ${jobTitle}
TARGET LANGUAGE: ${promptLanguage}
ADDITIONAL CONTEXT: ${additionalContext || 'None'}

IMPORTANT: Always use TARGET LANGUAGE = "${promptLanguage}" for the output format and language selection. Do not detect language from the master CV.
`;

    await updateJobProgress(jobId, { phase: 'ai-working', aiChars: 0 });

    const modelId = 'gemini-3.1-pro-preview';

    // Use streaming to track progress
    const stream = await ai.models.generateContentStream({
      model: modelId,
      contents: `${generatorPrompt}\n\nCONTEXT:\n${generationContext}`,
      config: {},
    });

    let responseText = '';
    let lastProgressUpdate = 0;

    for await (const chunk of stream) {
      const text = chunk.text || '';
      responseText += text;

      // Update progress every 300 chars or on completion
      if (responseText.length - lastProgressUpdate >= 300 || !chunk.text) {
        lastProgressUpdate = responseText.length;
        await updateJobProgress(jobId, { phase: 'ai-working', aiChars: responseText.length });
      }
    }

    await updateJobProgress(jobId, { phase: 'finalizing', aiChars: responseText.length });

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

    // Create application record FIRST to get the ID for folder naming
    // This ensures the folder path is consistent between generation and retrieval
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
          jobId, // Track which job created this application
        }),
        parentId,
      },
    });

    // Profile image handling - use consistent folder path with app ID
    const genDir = getGenDir(app);
    await fs.mkdir(genDir, { recursive: true });
    latexOutput = await prepareProfileImage(latexOutput, genDir);

    // Write LaTeX to file
    await fs.writeFile(path.join(genDir, 'cv.tex'), latexOutput);

    // Mark job as complete
    await completeJob(jobId, app.id);
    logger.info({ jobId, applicationId: app.id }, 'Generation job completed successfully');

  } catch (e: any) {
    logger.error({ err: e, jobId }, 'Generation pipeline failed');
    await failJob(jobId, e.message);
  }
}

/**
 * POST /api/generate
 * 
 * Fire-and-forget endpoint. Creates a job and returns immediately.
 * The actual generation happens asynchronously in the background.
 */
generateRouter.post('/generate', requireAuth, async (req, res) => {
  const { jobDescription, companyName, jobTitle, targetLanguage, additionalContext, parentId } = req.body;

  // Validate required fields
  if (!jobDescription || !companyName || !jobTitle) {
    return res.status(400).json({ error: 'Missing required fields: jobDescription, companyName, jobTitle' });
  }

  // Convert targetLanguage to uppercase for Prisma enum (EN, DE)
  const normalizedLanguage = (targetLanguage || 'EN').toUpperCase();

  try {
    // Create job in database
    const job = await createJob({
      companyName,
      jobTitle,
      jobDescription,
      targetLanguage: normalizedLanguage,
      additionalContext,
      parentId,
    });

    logger.info({ jobId: job.id, companyName, jobTitle }, 'Generation job created');

    // Return immediately with job ID (202 Accepted)
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Generation started in background',
    });

    // Process generation asynchronously (fire-and-forget)
    setImmediate(() => {
      processGeneration(job.id).catch((e) => {
        logger.error({ err: e, jobId: job.id }, 'Async generation failed');
      });
    });

  } catch (e: any) {
    logger.error({ err: e }, 'Failed to create generation job');
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

/**
 * POST /api/applications/:id/regenerate
 * 
 * Regeneration endpoint - creates a new generation job from a parent application.
 * Uses the same fire-and-forget pattern.
 */
generateRouter.post('/applications/:id/regenerate', requireAuth, async (req, res) => {
  const { additionalContext, targetLanguage } = req.body;
  const parentApp = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!parentApp) return res.status(404).json({ error: 'Parent application not found' });

  const normalizedLanguage = (targetLanguage || parentApp.targetLanguage || 'EN').toUpperCase();

  try {
    // Create job in database
    const job = await createJob({
      companyName: parentApp.companyName,
      jobTitle: parentApp.jobTitle,
      jobDescription: parentApp.jobDescription,
      targetLanguage: normalizedLanguage,
      additionalContext: additionalContext || parentApp.additionalContext,
      parentId: parentApp.id,
    });

    logger.info({ jobId: job.id, parentId: parentApp.id }, 'Regeneration job created');

    // Return immediately with job ID (202 Accepted)
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Regeneration started in background',
    });

    // Process generation asynchronously
    setImmediate(() => {
      processGeneration(job.id).catch((e) => {
        logger.error({ err: e, jobId: job.id }, 'Async regeneration failed');
      });
    });

  } catch (e: any) {
    logger.error({ err: e }, 'Failed to create regeneration job');
    res.status(500).json({ error: 'Failed to start regeneration' });
  }
});
