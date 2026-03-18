import { Router, Request, Response } from 'express';
import { prisma } from '../server.js';
import { requireAuth } from './routes.js';
import { upload, handleUploadError } from './middleware/upload.js';
import { extractCertificateFromPDFPath } from './services/certificate-extractor.js';
import { cleanupFile } from './services/pdf-extractor.js';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { logger } from './services/logger.js';

export const certificateRouter = Router();

// Process uploaded PDFs and extract certificate data
certificateRouter.post(
  '/certificates/extract',
  requireAuth,
  upload.array('files', 10),
  handleUploadError,
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];

      for (const file of files) {
        logger.info({ filename: file.originalname, size: file.size }, 'Processing certificate file');
        try {
          const certificate = await extractCertificateFromPDFPath(file.path);
          logger.info({ filename: file.originalname, found: !!certificate }, 'Extraction complete');

          results.push({
            filename: file.originalname,
            extractionMethod: 'gemini-vision',
            certificate: certificate,
          });

          cleanupFile(file.path);
        } catch (error: any) {
          logger.error({ filename: file.originalname, err: error }, 'Failed to process certificate');
          results.push({
            filename: file.originalname,
            error: error.message,
            certificate: null,
          });
          cleanupFile(file.path);
        }
      }

      return res.json({ results });
    } catch (error: any) {
      logger.error({ err: error }, 'Certificate extraction error');
      return res.status(500).json({ error: 'Certificate extraction failed' });
    }
  }
);

// Get all certificates
certificateRouter.get('/certificates', requireAuth, async (_req, res) => {
  try {
    const certificates = await prisma.certificate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ certificates });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to fetch certificates');
    return res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// Create a new certificate
const createCertificateSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().min(1),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  credentialId: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
  sourceFile: z.string().optional(),
}).strip();

certificateRouter.post('/certificates', requireAuth, async (req, res) => {
  try {
    const parsed = createCertificateSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ body: req.body, errors: parsed.error.flatten() }, 'Certificate validation failed');
      return res.status(400).json({ error: 'Invalid fields', details: parsed.error.flatten() });
    }
    
    // Convert null optional strings to undefined for Prisma
    const data = {
      ...parsed.data,
      skills: parsed.data.skills || [],
      activities: parsed.data.activities || [],
      issueDate: parsed.data.issueDate ?? undefined,
      expiryDate: parsed.data.expiryDate ?? undefined,
      credentialId: parsed.data.credentialId ?? undefined,
      description: parsed.data.description ?? undefined,
    };
    
    const certificate = await prisma.certificate.create({ data });

    return res.json(certificate);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create certificate');
    return res.status(500).json({ error: 'Failed to create certificate' });
  }
});

// Update a certificate
const updateCertificateSchema = z.object({
  name: z.string().min(1).optional(),
  issuer: z.string().min(1).optional(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  credentialId: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
  verified: z.boolean().optional(),
}).strip();

certificateRouter.patch('/certificates/:id', requireAuth, async (req, res) => {
  try {
    const parsed = updateCertificateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid fields', details: parsed.error.flatten() });
    }
    
    const certificate = await prisma.certificate.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    return res.json(certificate);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update certificate');
    return res.status(500).json({ error: 'Failed to update certificate' });
  }
});

// Delete a certificate
certificateRouter.delete('/certificates/:id', requireAuth, async (req, res) => {
  try {
    await prisma.certificate.delete({
      where: { id: req.params.id },
    });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to delete certificate');
    return res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

// Sync certificates to context file (certificates.md)
certificateRouter.post('/certificates/sync-to-context', requireAuth, async (_req, res) => {
  try {
    const certificates = await prisma.certificate.findMany({
      orderBy: { issueDate: 'desc' },
    });
    logger.info({ count: certificates.length }, 'Syncing certificates to context');

    const markdown = generateCertificatesMarkdown(certificates);

    const contextDir = path.join(process.cwd(), 'context');
    await fs.mkdir(contextDir, { recursive: true });

    const filePath = path.join(contextDir, 'certificates.md');
    await fs.writeFile(filePath, markdown);
    logger.info({ path: filePath, size: markdown.length }, 'Certificates context file written');

    return res.json({ success: true, certificateCount: certificates.length });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to sync certificates to context');
    return res.status(500).json({ error: 'Failed to sync certificates' });
  }
});

// Helper function to generate markdown from certificates
function generateCertificatesMarkdown(certificates: any[]): string {
  const sections = {
    professional: [] as any[],
    courses: [] as any[],
    other: [] as any[],
  };

  // Categorize certificates
  for (const cert of certificates) {
    const name = cert.name.toLowerCase();
    const isCertification = 
      name.includes('certified') || 
      name.includes('certificate') || 
      name.includes('aws') ||
      name.includes('google') ||
      name.includes('microsoft') ||
      name.includes('azure');
    
    const isCourse = 
      name.includes('course') || 
      name.includes('specialization') ||
      name.includes('nanodegree');

    if (isCertification) {
      sections.professional.push(cert);
    } else if (isCourse) {
      sections.courses.push(cert);
    } else {
      sections.other.push(cert);
    }
  }

  let markdown = '# Certificates & Qualifications\n\n';
  markdown += '<!-- Auto-generated from extracted certificates -->\n\n';

  // Professional Certifications
  if (sections.professional.length > 0) {
    markdown += '## Professional Certifications\n\n';
    for (const cert of sections.professional) {
      markdown += formatCertificateEntry(cert);
    }
    markdown += '\n';
  }

  // Courses & Training
  if (sections.courses.length > 0) {
    markdown += '## Courses & Training\n\n';
    for (const cert of sections.courses) {
      markdown += formatCertificateEntry(cert);
    }
    markdown += '\n';
  }

  // Additional Qualifications
  if (sections.other.length > 0) {
    markdown += '## Additional Qualifications\n\n';
    for (const cert of sections.other) {
      markdown += formatCertificateEntry(cert);
    }
    markdown += '\n';
  }

  markdown += '---\n\n';
  markdown += '**Note for AI**: Use these certificates to:\n';
  markdown += '1. Enhance the skills section when relevant to the job description\n';
  markdown += '2. Add a "Certifications" section if not present in the master CV\n';
  markdown += '3. Highlight certifications that match job requirements\n';
  markdown += '4. Never claim certifications not listed here\n';
  markdown += '5. For work certificates with listed activities, use those activities to enrich the work experience section with concrete, factual responsibilities\n';

  return markdown;
}

function formatCertificateEntry(cert: any): string {
  let entry = `- **${cert.name}**`;
  
  if (cert.issuer) {
    entry += ` | ${cert.issuer}`;
  }
  
  if (cert.issueDate) {
    entry += ` | ${cert.issueDate}`;
  }
  
  if (cert.skills && cert.skills.length > 0) {
    entry += ` | ${cert.skills.join(', ')}`;
  }
  
  entry += '\n';
  
  if (cert.description) {
    entry += `  - ${cert.description}\n`;
  }

  if (cert.activities && cert.activities.length > 0) {
    entry += `  - Key activities:\n`;
    for (const activity of cert.activities) {
      entry += `    - ${activity}\n`;
    }
  }
  
  if (cert.credentialId) {
    entry += `  - Credential ID: ${cert.credentialId}\n`;
  }
  
  return entry;
}
