import { ai } from '../../server.js';
import fs from 'fs';

export interface ExtractedCertificate {
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  skills: string[];
  activities: string[];
  description?: string;
  confidence: number;
}

const VISION_CERTIFICATE_PROMPT = `
You are a certificate OCR and data extraction specialist. Analyze this document (which may be a skill certificate OR a work/employment certificate) and extract structured information.

DOCUMENT TYPE DETECTION:
First determine if this is:
1. SKILL CERTIFICATE - Certifies completion of a course, exam, or skill (e.g., AWS Certified, Language Certificate, University Course)
2. WORK CERTIFICATE/EMPLOYMENT LETTER - Documents work experience, employment period, or job position (e.g., Arbeitszeugnis, Employment Certificate, Internship Certificate)

FOR SKILL CERTIFICATES, LOOK FOR:
- Certificate title/name (usually largest text, centered, bold, at the top)
- Issuing organization (logo, header, or mentioned prominently)
- Recipient name (the person who earned the certificate)
- Issue date (when the certificate was awarded)
- Expiry date (if present - "Valid until", "Expires", "Gültig bis", "Ablaufdatum")
- Credential ID (certificate number, "Zertifikatsnummer", "Credential ID")
- Skills/competencies listed (topics covered by the certification)

FOR WORK CERTIFICATES/EMPLOYMENT LETTERS, LOOK FOR:
- Employee name (the person who worked there)
- Employer/Company name (the organization)
- Job title/Position (e.g., "Software Engineer", "Project Manager", "Werkstudent")
- Employment period (start date to end date, or "from...to")
- Work description/responsibilities (what the person did)
- Skills demonstrated (technologies used, competencies shown)

CERTIFICATE/WORK LETTER LAYOUT CLUES:
- Official documents typically have decorative borders, seals, or watermarks
- The issuer/employer logo is usually at the top
- Signatures or digital stamps appear at the bottom
- QR codes or verification URLs may be present
- The document title is often the most prominent text

LANGUAGE HANDLING:
- This document may be in English OR German
- German terms to look for:
  Skill certs: "Zertifikat", "Bescheinigung", "Zeugnis", "Urkunde", "Ausgestellt", "Gültig bis", "Zertifikatsnummer"
  Work certs: "Arbeitszeugnis", "Praktikumsbescheinigung", "Dienstzeugnis", "Arbeitnehmer", "Arbeitgeber", "beschäftigt von", "bis", "Tätigkeitsbereich"
- Extract text exactly as written, preserving the original language
- Pay special attention to German umlauts (ä, ö, ü, ß)

REQUIRED FIELDS (must extract):
- name: For skill certs: the full certificate name. For work certs: create descriptive name like "Work Certificate - [Company] - [Job Title]" or "Employment at [Company]"
- issuer: For skill certs: the issuing organization. For work certs: the employer/company name

OPTIONAL FIELDS (extract if present, use null if not found):
- issueDate: When issued/signed. Use any format (e.g., "May 2023", "2023-05-15", "15.05.2023")
- expiryDate: For skill certs: when it expires. For work certs: use null.
- credentialId: For skill certs: certificate ID. For work certs: employee ID or reference number if present.
- skills: Array of skills/technologies/competencies (1-3 words each, max 10 items)
- activities: For work certificates ONLY: Array of specific work activities, tasks, and responsibilities performed. Each entry should be a concise phrase describing a concrete activity (e.g., "Developed REST APIs for customer portal", "Led migration from monolith to microservices", "Conducted code reviews and mentored junior developers"). Extract as many distinct activities as mentioned in the document. For skill certificates: use an empty array [].
- description: Brief 1-2 sentence summary. For skill certs: what it certifies. For work certs: role and responsibilities.

RULES:
1. NEVER invent information - if a field is not present in the document, use null
2. For work certificates, infer the job title from context if not explicitly stated (e.g., from "Software Developer at..." or responsibilities described)
3. Name should be descriptive and professional
4. Issuer should be the organization name only, not URLs or extra text
5. Skills should be specific technologies or competencies demonstrated
6. Be precise - don't guess dates that aren't clearly stated
7. Handle both English (MM/DD/YYYY) and German (DD.MM.YYYY) date formats

CONFIDENCE SCORING:
After extraction, assign a confidence score (0.0-1.0) based on:
- How clearly the information was visible in the document
- Whether text was readable vs blurry or obscured
- Whether the document structure was standard
- 0.9-1.0: Text clearly readable, standard layout
- 0.7-0.9: Minor issues but likely correct
- 0.5-0.7: Some difficulty reading or unusual layout
- <0.5: Unable to extract with confidence

OUTPUT FORMAT:
Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "name": "string",
  "issuer": "string",
  "issueDate": "string or null",
  "expiryDate": "string or null",
  "credentialId": "string or null",
  "skills": ["array", "of", "strings"],
  "activities": ["array", "of", "activity", "strings"],
  "description": "string or null",
  "confidence": 0.95
}
`;

/**
 * Extract structured certificate data from a PDF file using Gemini Vision
 * Sends the PDF directly to Gemini for OCR and structured extraction
 */
export async function extractCertificateFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedCertificate | null> {
  try {
    console.log(`[Certificate Extractor] Starting Gemini Vision extraction, PDF size: ${pdfBuffer.length} bytes`);
    
    // Convert PDF to base64
    const base64PDF = pdfBuffer.toString('base64');
    
    const model = ai.models;
    const response = await model.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: VISION_CERTIFICATE_PROMPT,
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64PDF,
              },
            },
          ],
        },
      ],
    });

    const responseText = response.text;
    if (!responseText) {
      console.error('[Certificate Extractor] No response from Gemini');
      return null;
    }

    // Clean up the response - remove markdown code blocks if present
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Certificate Extractor] Could not find JSON in response:', responseText);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.name || !parsed.issuer) {
      console.error('[Certificate Extractor] Missing required fields in extraction:', parsed);
      return null;
    }

    // Ensure skills is an array
    if (!Array.isArray(parsed.skills)) {
      parsed.skills = [];
    }

    // Ensure activities is an array
    if (!Array.isArray(parsed.activities)) {
      parsed.activities = [];
    }

    // Ensure confidence is a number
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = 0.5;
    }

    console.log(`[Certificate Extractor] Extraction successful. Certificate: "${parsed.name}" by "${parsed.issuer}" (confidence: ${parsed.confidence})`);
    
    return parsed as ExtractedCertificate;
  } catch (error) {
    console.error('[Certificate Extractor] PDF extraction failed:', error);
    return null;
  }
}

/**
 * Extract certificate from a PDF file path
 * Convenience wrapper that reads the file and calls extractCertificateFromPDF
 */
export async function extractCertificateFromPDFPath(
  pdfPath: string
): Promise<ExtractedCertificate | null> {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    return await extractCertificateFromPDF(pdfBuffer);
  } catch (error) {
    console.error(`[Certificate Extractor] Failed to read PDF file: ${pdfPath}`, error);
    return null;
  }
}

/**
 * Extract certificates from multiple PDF files (batch processing)
 * @deprecated Use extractCertificateFromPDFPath for individual files instead
 */
export async function extractCertificatesFromTexts(
  texts: Array<{ filename: string; text: string }>
): Promise<Array<{ filename: string; certificate: ExtractedCertificate | null }>> {
  console.warn('[Certificate Extractor] extractCertificatesFromTexts is deprecated. Text-based extraction is no longer supported. Use extractCertificateFromPDFPath instead.');
  
  // Return null for all - this function is deprecated
  return texts.map(({ filename }) => ({
    filename,
    certificate: null,
  }));
}
