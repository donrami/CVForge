import { Router } from 'express';
import { prisma, ai } from '../server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import { assertSafeLatex, detectDangerousLatex, escapeLatexSpecialChars } from './services/latex-sanitizer.js';
import { logger } from './services/logger.js';
import { prepareProfileImage } from './services/profile-image.js';
import { generateBackup } from './services/backup.js';
import { validateBackupFile, restoreFromBackup } from './services/restore.js';
import { generateApplicationsPDF } from './services/pdf-export.js';
import { getJob, getActiveJobsSummary } from './services/job.js';
import { getGenDir } from './utils/gen-dir.js';
import stringSimilarity from 'string-similarity';

const execFileAsync = util.promisify(execFile);

const DUPLICATE_THRESHOLD = 0.7; // 70% similarity = potential duplicate

/** Sanitize a string for use in Content-Disposition filename */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '').replace(/\s+/g, '_') || 'download';
}

/** Return a safe error response — hide internals in production */
function errorResponse(res: any, status: number, error: unknown, code?: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === 'production') {
    logger.error({ err: error, code }, 'Request error');
    return res.status(status).json({ error: 'Internal server error', ...(code && { code }) });
  }
  logger.error({ err: error, code }, message);
  return res.status(status).json({ error: message, ...(code && { code }) });
}

export const apiRouter = Router();

// No-op auth middleware (app runs locally for a single user)
export const requireAuth = (_req: any, _res: any, next: any) => next();

// Job Routes - for background generation polling
apiRouter.get('/jobs', requireAuth, async (req, res) => {
  try {
    const jobs = await getActiveJobsSummary();
    res.json({ jobs });
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

apiRouter.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
    }
    res.json({
      id: job.id,
      status: job.status,
      phase: job.phase,
      aiChars: job.aiChars,
      applicationId: job.applicationId,
      error: job.error,
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

// Fuzzy duplicate detection
apiRouter.post('/applications/check-duplicate', requireAuth, async (req, res) => {
  try {
    const { jobDescription, companyName, jobTitle } = req.body;
    
    if (!jobDescription || typeof jobDescription !== 'string') {
      return res.status(400).json({ error: 'jobDescription is required' });
    }
    
    // Fetch all existing applications
    const existingApps = await prisma.application.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        jobDescription: true,
      },
    });
    
    // Normalize the input text
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedInput = normalizeText(jobDescription);
    
    // Find matches
    const matches = [];
    
    for (const app of existingApps) {
      if (!app.jobDescription) continue;
      
      const normalizedExisting = normalizeText(app.jobDescription);
      const similarity = stringSimilarity.compareTwoStrings(normalizedInput, normalizedExisting);
      
      if (similarity >= DUPLICATE_THRESHOLD) {
        matches.push({
          id: app.id,
          companyName: app.companyName,
          jobTitle: app.jobTitle,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
    
    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);
    
    res.json({
      hasDuplicate: matches.length > 0,
      matches: matches.slice(0, 5), // Return top 5 matches
    });
  } catch (e) {
    errorResponse(res, 500, e, 'DUPLICATE_CHECK_ERROR');
  }
});

// Applications Routes
apiRouter.get('/applications', requireAuth, async (req, res) => {
  try {
    const skip = Math.max(0, parseInt(req.query.skip as string) || 0);
    const take = Math.min(100, Math.max(1, parseInt(req.query.take as string) || 10));
    const search = req.query.search as string | undefined;

    const where: Record<string, any> = { deletedAt: null };
    
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { companyName: { contains: searchTerm, mode: 'insensitive' } },
        { jobTitle: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [applications, total, inProgress, active, outcomes] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.application.count({ where }),
      prisma.application.count({
        where: { ...where, status: { in: ['GENERATING', 'GENERATED'] } },
      }),
      prisma.application.count({
        where: { ...where, status: { in: ['APPLIED', 'INTERVIEW'] } },
      }),
      prisma.application.count({
        where: { ...where, status: { in: ['OFFER', 'REJECTED'] } },
      }),
    ]);
    res.json({
      applications,
      total,
      stats: { total, inProgress, active, outcomes },
      skip,
      take
    });
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

apiRouter.get('/applications/backup', requireAuth, async (_req, res) => {
  try {
    const backup = await generateBackup();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cvforge-backup-${date}.json"`);
    res.json(backup);
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

// Multer config for JSON backup restore uploads (memory storage)
const restoreUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (path.extname(file.originalname).toLowerCase() === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only .json files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

apiRouter.post('/applications/restore', requireAuth, restoreUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', code: 'INVALID_FORMAT' });
    }

    // Parse JSON from uploaded buffer
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON format', code: 'INVALID_FORMAT' });
    }

    // Validate backup structure
    let backup;
    try {
      backup = validateBackupFile(parsed);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Distinguish between missing applications array and field-level validation errors
      const code = message.includes('applications array') || message.includes('must be a JSON object')
        ? 'INVALID_STRUCTURE'
        : 'VALIDATION_ERROR';
      return res.status(400).json({ error: message, code });
    }

    // Perform the restore
    const result = await restoreFromBackup(backup);
    return res.json({ success: true, created: result.created, updated: result.updated });
  } catch (e) {
    return errorResponse(res, 500, e, 'RESTORE_ERROR');
  }
});

apiRouter.get('/applications/export/pdf', requireAuth, async (_req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const pdfBuffer = await generateApplicationsPDF(applications, {
      title: 'CVForge Applications',
      exportDate: new Date(),
    });

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cvforge-applications-${date}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    errorResponse(res, 500, e, 'PDF_ERROR');
  }
});

apiRouter.get('/applications/:id', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { parent: true, regenerations: { where: { deletedAt: null } } }
    });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    res.json(app);
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

// Whitelist of fields allowed in PATCH updates
const applicationUpdateSchema = z.object({
  status: z.enum(['GENERATED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']).optional(),
  notes: z.string().nullable().optional(),
  appliedAt: z.string().datetime().nullable().optional(),
  interviewAt: z.string().datetime().nullable().optional(),
  offerAt: z.string().datetime().nullable().optional(),
  rejectedAt: z.string().datetime().nullable().optional(),
  latexOutput: z.string().min(1).optional(),
}).strict();

apiRouter.patch('/applications/:id', requireAuth, async (req, res) => {
  try {
    const parsed = applicationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid fields', details: parsed.error.flatten() });
    }

    const updateData: Record<string, any> = { ...parsed.data };

    if (parsed.data.latexOutput !== undefined) {
      const violations = detectDangerousLatex(parsed.data.latexOutput);
      if (violations.length > 0) {
        return res.status(400).json({
          error: `LaTeX contains dangerous commands: ${violations.join(', ')}`,
          code: 'LATEX_UNSAFE',
          violations,
        });
      }
      updateData.pdfGenerated = false;
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (app) {
        const genDir = getGenDir(app);
        await fs.rm(path.join(genDir, 'cv.tex'), { force: true });
        await fs.rm(path.join(genDir, 'cv.pdf'), { force: true });
      }
    }

    const app = await prisma.application.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(app);
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

apiRouter.delete('/applications/:id', requireAuth, async (req, res) => {
  try {
    await prisma.application.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });

    // Remove generated files from disk
    const app = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (app) {
      const genDir = getGenDir(app);
      await fs.rm(genDir, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (e) {
    errorResponse(res, 500, e, 'DATABASE_ERROR');
  }
});

apiRouter.get('/applications/:id/download/tex', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    
    res.setHeader('Content-Type', 'application/x-tex');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(app.companyName)}_CV.tex"`);
    res.send(app.latexOutput);
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

apiRouter.get('/applications/:id/download/pdf', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    
    const genDir = getGenDir(app);
    const pdfPath = path.join(genDir, 'cv.pdf');
    const texPath = path.join(genDir, 'cv.tex');
    
    await fs.mkdir(genDir, { recursive: true });
    
    // Check if LaTeX file exists, if not create it with profile image handling
    let texExists = false;
    try { await fs.access(texPath); texExists = true; } catch {}

    if (!texExists) {
      let latexContent = app.latexOutput;
      
      // Handle profile image and placeholders
      latexContent = await prepareProfileImage(latexContent, genDir);
      
      // Escape unescaped special characters (e.g. & in text)
      latexContent = escapeLatexSpecialChars(latexContent);
      
      // Sanitize before writing to disk
      assertSafeLatex(latexContent);
      await fs.writeFile(texPath, latexContent);
    }

    let pdfExists = false;
    try { await fs.access(pdfPath); pdfExists = true; } catch {}

    if (!app.pdfGenerated || !pdfExists) {
      let lastError: any = null;
      const compileTimeout = 30_000; // 30 seconds
      
      try {
        await execFileAsync('lualatex', [
          '--no-shell-escape',
          '-interaction=nonstopmode',
          `-output-directory=${genDir}`,
          texPath,
        ], { timeout: compileTimeout });
        await prisma.application.update({ where: { id: app.id }, data: { pdfGenerated: true } });
      } catch (e: any) {
        lastError = e;
        
        const errorOutput = e.stdout || e.message || '';
        const needsPdflatex = errorOutput.includes('fontspec') && 
          (errorOutput.includes('XeTeX') || errorOutput.includes('LuaTeX') || errorOutput.includes('xelatex') || errorOutput.includes('lualatex'));
        
        if (needsPdflatex) {
          logger.info('lualatex failed, trying pdflatex as fallback...');
          try {
            await execFileAsync('pdflatex', [
              '--no-shell-escape',
              '-interaction=nonstopmode',
              `-output-directory=${genDir}`,
              texPath,
            ], { timeout: compileTimeout });
            await prisma.application.update({ where: { id: app.id }, data: { pdfGenerated: true } });
            lastError = null;
          } catch (pdflatexError: any) {
            lastError = pdflatexError;
          }
        }
      }
      
      if (lastError) {
        // Check if PDF was produced despite non-zero exit code (non-fatal LaTeX errors)
        let pdfProduced = false;
        try { await fs.access(pdfPath); pdfProduced = true; } catch {}
        
        if (pdfProduced) {
          logger.warn({ err: lastError }, 'LaTeX had non-fatal errors but PDF was produced');
          await prisma.application.update({ where: { id: app.id }, data: { pdfGenerated: true } });
        } else {
          const errorDetails = lastError.stdout || lastError.message || '';
          logger.error({ err: lastError }, 'LaTeX compilation failed');
          
          let userMessage = 'LaTeX compilation failed.';
          const errorLines = errorDetails.split('\n').filter((line: string) => line.trim().startsWith('!') || line.includes('Error'));
          if (errorLines.length > 0) {
            userMessage = errorLines.slice(0, 3).join(' ').substring(0, 500);
          }
          
          return res.status(500).json({ error: userMessage });
        }
      }
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(app.companyName)}_CV.pdf"`);
    res.sendFile(pdfPath);
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

// Context Settings
apiRouter.get('/settings/context', requireAuth, async (req, res) => {
  const contextDir = path.join(process.cwd(), 'context');
  const files = ['master-cv.tex', 'certificates.md'];
  const result: Record<string, string> = {};
  
  for (const file of files) {
    try {
      result[file] = await fs.readFile(path.join(contextDir, file), 'utf-8');
    } catch (e) {
      result[file] = '';
    }
  }
  res.json(result);
});

apiRouter.post('/settings/context', requireAuth, async (req, res) => {
  const contextDir = path.join(process.cwd(), 'context');
  await fs.mkdir(contextDir, { recursive: true });
  
  const { 'master-cv.tex': masterCv, 'certificates.md': certs } = req.body;
  
  if (masterCv !== undefined) await fs.writeFile(path.join(contextDir, 'master-cv.tex'), masterCv);
  if (certs !== undefined) await fs.writeFile(path.join(contextDir, 'certificates.md'), certs);
  
  res.json({ success: true });
});

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Profile Image Management - use __dirname for consistent path
const profileImageDir = path.join(__dirname, '..', 'uploads', 'profile');
if (!fsSync.existsSync(profileImageDir)) {
  fsSync.mkdirSync(profileImageDir, { recursive: true });
}

// Multer configuration for profile images
import multer from 'multer';

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profileImageDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile${ext}`);
  },
});

const profileFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WebP images are allowed'));
  }
};

const profileUpload = multer({
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Get profile image info
apiRouter.get('/settings/profile-image', requireAuth, async (_req, res) => {
  const files = await fs.readdir(profileImageDir);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  
  if (imageFiles.length > 0) {
    const filename = imageFiles[0];
    const filePath = path.join(profileImageDir, filename);
    const stats = await fs.stat(filePath);
    res.json({
      exists: true,
      filename,
      url: `/uploads/profile/${filename}`,
      size: stats.size,
      uploadedAt: stats.mtime,
    });
  } else {
    res.json({ exists: false });
  }
});

// Upload profile image
apiRouter.post('/settings/profile-image', requireAuth, profileUpload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Remove old profile images, but keep the newly uploaded one
    const files = await fs.readdir(profileImageDir);
    for (const file of files) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file) && file !== req.file.filename) {
        await fs.unlink(path.join(profileImageDir, file));
      }
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      url: `/uploads/profile/${req.file.filename}`,
    });
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

import { loadAllPrompts, saveAllPrompts, getDefaults, PROMPT_KEYS } from './services/prompts.js';

// Delete profile image
apiRouter.delete('/settings/profile-image', requireAuth, async (_req, res) => {
  try {
    const files = await fs.readdir(profileImageDir);
    for (const file of files) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
        await fs.unlink(path.join(profileImageDir, file));
      }
    }
    res.json({ success: true });
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

// Prompt Settings
apiRouter.get('/settings/prompts', requireAuth, async (_req, res) => {
  try {
    const prompts = await loadAllPrompts();
    res.json(prompts);
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

apiRouter.post('/settings/prompts', requireAuth, async (req, res) => {
  try {
    const data: Record<string, string> = {};
    for (const key of PROMPT_KEYS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    await saveAllPrompts(data);
    res.json({ success: true });
  } catch (e) {
    errorResponse(res, 500, e);
  }
});

apiRouter.get('/settings/prompts/defaults', requireAuth, (_req, res) => {
  res.json(getDefaults());
});

// Chat Assistant
apiRouter.post('/prompts/chat', requireAuth, async (req, res) => {
  const { messages, includeFullContext } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    // Always include a brief system prompt explaining the app
    const briefSystemPrompt = `You are CVForge Assistant, a helpful AI that helps users with their CV generation pipeline.

CVForge is a tool that generates tailored CVs using AI. It uses a consolidated prompt with three phases:
1. Analysis - Analyzes job requirements and candidate background
2. Review - Verifies quality and accuracy
3. LaTeX - Produces the final compilable CV

Be conversational, friendly, and helpful. Keep responses concise unless detailed analysis is requested.

IMPORTANT: You are a prompt improvement assistant. You may suggest edits to improve clarity, structure, tone, and specificity. You must NEVER suggest removing or weakening: (1) rules that prevent fact invention or hallucination, (2) the Arbeitszeugnis grounding rules for job titles and responsibilities, (3) the LaTeX layout safety rules, (4) the language immutability rule for the Languages section. If the user asks you to remove or soften any of these, explain why they are load-bearing and offer an alternative improvement instead.`;

    // Only inject full prompt when explicitly requested via includeFullContext flag
    let systemInstruction: string;

    if (includeFullContext === true) {
      // User explicitly requested full prompt context
      const prompts = await loadAllPrompts();
      
      const lineCount = (text: string) => text.split('\n').length;
      const generatorLines = lineCount(prompts.generator);

      systemInstruction = `You are a CVForge Assistant that helps users understand and improve their CV generation pipeline.

The pipeline uses a single consolidated prompt with three phases:
1. Phase 1: Analysis — Reasons about the job-candidate match and identifies relevant experience.
2. Phase 2: Review — Verifies the generated CV for quality issues.
3. Phase 3: LaTeX — Produces the final compilable LaTeX output.

--- PROMPT METADATA ---
- Generator Prompt: ${generatorLines} lines

--- FULL PROMPT CONTENTS ---

## Generator Prompt:
${prompts.generator}

---

When answering questions about the prompt, use the metadata above for statistics.
When suggesting modifications, wrap full replacements in code blocks.

IMPORTANT: You are a prompt improvement assistant. You may suggest edits to improve clarity, structure, tone, and specificity. You must NEVER suggest removing or weakening: (1) rules that prevent fact invention or hallucination, (2) the Arbeitszeugnis grounding rules for job titles and responsibilities, (3) the LaTeX layout safety rules, (4) the language immutability rule for the Languages section. If the user asks you to remove or soften any of these, explain why they are load-bearing and offer an alternative improvement instead.`;
    } else {
      // Default: brief system prompt only (no keyword matching needed)
      systemInstruction = briefSystemPrompt;
    }

    const contents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const result = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      config: { systemInstruction },
      contents,
    });

    const responseText = result.text ?? '';
    res.json({ response: responseText });
  } catch (e) {
    errorResponse(res, 500, e);
  }
});
