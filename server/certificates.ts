import { Router, Request, Response } from 'express';
import { prisma } from '../server.js';
import { requireAuth } from './routes.js';
import { upload, handleUploadError } from './middleware/upload.js';
import { extractCertificateFromPDFPath } from './services/certificate-extractor.js';
import { cleanupFile } from './services/pdf-extractor.js';
import fs from 'fs';
import path from 'path';

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
        console.log(`[Certificates] Processing file: ${file.originalname}, size: ${file.size} bytes`);
        try {
          // Extract certificate data directly from PDF using Gemini Vision
          console.log(`[Certificates] Starting Gemini Vision extraction for: ${file.originalname}`);
          const certificate = await extractCertificateFromPDFPath(file.path);
          console.log(`[Certificates] Extraction complete. Found: ${certificate ? 'Yes' : 'No'}`);

          results.push({
            filename: file.originalname,
            extractionMethod: 'gemini-vision',
            certificate: certificate,
          });

          // Cleanup uploaded file
          cleanupFile(file.path);
          console.log(`[Certificates] Successfully processed: ${file.originalname}`);
        } catch (error: any) {
          console.error(`[Certificates] Failed to process ${file.originalname}:`, error.message);
          console.error(`[Certificates] Error stack:`, error.stack);
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
      console.error('Certificate extraction error:', error);
      return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
  }
});

// Create a new certificate
interface CreateCertificateBody {
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  skills?: string[];
  description?: string;
  sourceFile?: string;
}

certificateRouter.post('/certificates', requireAuth, async (req, res) => {
  try {
    const data = req.body as CreateCertificateBody;
    
    const certificate = await prisma.certificate.create({
      data: {
        name: data.name,
        issuer: data.issuer,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        credentialId: data.credentialId,
        skills: data.skills || [],
        description: data.description,
        sourceFile: data.sourceFile,
      },
    });

    return res.json(certificate);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update a certificate
interface UpdateCertificateBody {
  name?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  skills?: string[];
  description?: string;
  verified?: boolean;
}

certificateRouter.patch('/certificates/:id', requireAuth, async (req, res) => {
  try {
    const data = req.body as UpdateCertificateBody;
    
    const certificate = await prisma.certificate.update({
      where: { id: req.params.id },
      data,
    });

    return res.json(certificate);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
  }
});

// Sync certificates to context file (certificates.md)
certificateRouter.post('/certificates/sync-to-context', requireAuth, async (_req, res) => {
  try {
    console.log('[Certificates Sync] Starting sync to context...');
    
    const certificates = await prisma.certificate.findMany({
      orderBy: { issueDate: 'desc' },
    });
    console.log(`[Certificates Sync] Found ${certificates.length} certificates in database`);

    // Generate markdown content
    const markdown = generateCertificatesMarkdown(certificates);
    console.log(`[Certificates Sync] Generated markdown (${markdown.length} chars)`);
    console.log('[Certificates Sync] Markdown preview:', markdown.substring(0, 200) + '...');

    // Write to context file
    const contextDir = path.join(process.cwd(), 'context');
    console.log(`[Certificates Sync] Context directory: ${contextDir}`);
    
    if (!fs.existsSync(contextDir)) {
      console.log('[Certificates Sync] Creating context directory...');
      fs.mkdirSync(contextDir, { recursive: true });
    } else {
      console.log('[Certificates Sync] Context directory already exists');
    }

    const filePath = path.join(contextDir, 'certificates.md');
    console.log(`[Certificates Sync] Writing to: ${filePath}`);
    
    fs.writeFileSync(filePath, markdown);
    
    // Verify file was written
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`[Certificates Sync] File written successfully. Size: ${stats.size} bytes`);
    } else {
      console.error('[Certificates Sync] ERROR: File was not created!');
    }

    return res.json({ success: true, certificateCount: certificates.length });
  } catch (error: any) {
    console.error('[Certificates Sync] ERROR:', error);
    return res.status(500).json({ error: error.message });
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
  
  if (cert.credentialId) {
    entry += `  - Credential ID: ${cert.credentialId}\n`;
  }
  
  return entry;
}
