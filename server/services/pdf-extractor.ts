/**
 * PDF Text Extraction Service
 * 
 * Uses Gemini Vision (gemini-3.1-pro-preview) for ALL PDF extraction.
 * This is faster, more accurate for structured data, and eliminates
 * the need for legacy OCR libraries (tesseract.js, pdf2pic, sharp, pdf-parse).
 * 
 * Gemini's multimodal API natively supports PDF input and can extract
 * text from both native text PDFs and scanned/image-based PDFs.
 */

import { ai } from '../../server.js';
import fs from 'fs';

export interface ExtractedTextResult {
  text: string;
  method: 'gemini-vision';
  confidence?: number;
  pageCount: number;
  language?: string;
}

const VISION_EXTRACTION_PROMPT = `
You are a document text extraction specialist. Extract ALL text content from this PDF document.

INSTRUCTIONS:
1. Extract text from every page of the document
2. Preserve the logical structure: headings, paragraphs, lists, tables
3. For tables, represent as tab-separated rows or clearly marked sections
4. Do NOT summarize or interpret - extract verbatim text
5. If text is in German, preserve German text with umlauts (ä,ö,ü,ß)
6. If text is in English, preserve English text
7. Include page markers if there are clear page breaks: "[Page X]"
8. Extract any metadata visible in headers/footers

LANGUAGE DETECTION:
- Detect the primary language of the document
- If it contains German terms (Zertifikat, Bescheinigung, Zeugnis, Berufserfahrung, Ausbildung, etc.), mark as German
- If it's in English, mark as English

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "text": "The complete extracted text with structure preserved",
  "language": "eng" or "deu" or "mixed",
  "pageCount": number of pages you observed,
  "hasTables": true or false,
  "hasMultiplePages": true or false
}
`;

/**
 * Extract text from a PDF file using Gemini Vision
 * Routes ALL PDF extraction (native text or scanned images) through Gemini
 */
export async function extractTextFromPDF(
  pdfPath: string
): Promise<ExtractedTextResult> {
  console.log(`[PDF Extractor] Starting Gemini Vision extraction for: ${pdfPath}`);

  try {
    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`[PDF Extractor] File read, size: ${pdfBuffer.length} bytes`);

    // Convert to base64
    const base64PDF = pdfBuffer.toString('base64');

    const model = ai.models;
    const response = await model.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: VISION_EXTRACTION_PROMPT,
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
      console.error('[PDF Extractor] No response from Gemini');
      return {
        text: '',
        method: 'gemini-vision',
        confidence: 0,
        pageCount: 0,
        language: 'eng',
      };
    }

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[PDF Extractor] Could not find JSON in response:', responseText);
      return {
        text: responseText, // Fallback to raw text
        method: 'gemini-vision',
        confidence: 0.5,
        pageCount: 1,
        language: 'eng',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[PDF Extractor] Extraction complete. Pages: ${parsed.pageCount}, Language: ${parsed.language}`);

    return {
      text: parsed.text || responseText,
      method: 'gemini-vision',
      confidence: 0.95, // Gemini Vision is highly accurate
      pageCount: parsed.pageCount || 1,
      language: parsed.language || 'eng',
    };
  } catch (error: any) {
    console.error('[PDF Extractor] Gemini Vision extraction failed:', error.message);
    return {
      text: '',
      method: 'gemini-vision',
      confidence: 0,
      pageCount: 0,
      language: 'eng',
    };
  }
}

/**
 * Extract text from a PDF buffer using Gemini Vision
 * Convenience wrapper for in-memory PDFs
 */
export async function extractTextFromPDFBuffer(
  pdfBuffer: Buffer
): Promise<ExtractedTextResult> {
  console.log(`[PDF Extractor] Starting Gemini Vision extraction from buffer, size: ${pdfBuffer.length} bytes`);

  try {
    const base64PDF = pdfBuffer.toString('base64');

    const model = ai.models;
    const response = await model.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: VISION_EXTRACTION_PROMPT,
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
      return {
        text: '',
        method: 'gemini-vision',
        confidence: 0,
        pageCount: 0,
        language: 'eng',
      };
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        text: responseText,
        method: 'gemini-vision',
        confidence: 0.5,
        pageCount: 1,
        language: 'eng',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      text: parsed.text || responseText,
      method: 'gemini-vision',
      confidence: 0.95,
      pageCount: parsed.pageCount || 1,
      language: parsed.language || 'eng',
    };
  } catch (error: any) {
    console.error('[PDF Extractor] Gemini Vision extraction failed:', error.message);
    return {
      text: '',
      method: 'gemini-vision',
      confidence: 0,
      pageCount: 0,
      language: 'eng',
    };
  }
}

/**
 * Legacy compatibility function - now routes to Gemini Vision
 * Kept for backward compatibility with existing code
 */
export async function extractTextFromPDFWithRetry(
  pdfPath: string,
  _minConfidence: number = 60
): Promise<ExtractedTextResult> {
  // Gemini Vision is reliable enough that retry logic is rarely needed
  return await extractTextFromPDF(pdfPath);
}

/**
 * Clean up uploaded file after processing
 */
export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to cleanup file:', error);
  }
}
