import Tesseract from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface ExtractedTextResult {
  text: string;
  method: 'native' | 'ocr';
  confidence?: number;
  pageCount: number;
  language?: string;
}

export interface OCROptions {
  /** DPI for PDF to image conversion (higher = better quality but slower) */
  density?: number;
  /** Image width in pixels */
  width?: number;
  /** Enable image preprocessing */
  preprocess?: boolean;
  /** Language(s) for OCR: 'eng', 'deu', 'eng+deu', or 'osd' for autodetect */
  language?: string;
  /** Tesseract OEM mode: 1=LSTM only (best accuracy), 2=Legacy+LSTM, 3=Default */
  oemMode?: number;
  /** Page Segmentation Mode: 1=Auto+OSD, 3=Auto, 6=Uniform block, 11=Sparse text */
  psmMode?: number;
}

const DEFAULT_OCR_OPTIONS: Required<OCROptions> = {
  density: 300,        // Increased from 150 for maximum quality
  width: 3000,         // Increased from 2000 for better text recognition
  preprocess: true,    // Enable image preprocessing
  language: 'eng+deu', // Support both English and German
  oemMode: 1,          // LSTM engine only - best accuracy
  psmMode: 3,          // Auto page segmentation with OSD
};

// Dynamic import for pdf-parse to handle ESM issues
async function getPdfParse() {
  const mod: any = await import('pdf-parse');
  return mod.default || mod;
}

/**
 * Preprocess image for better OCR results
 * Applies: grayscale, contrast enhancement, sharpening, adaptive thresholding
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const processed = await sharp(imageBuffer as Buffer)
      // Convert to grayscale
      .grayscale()
      // Increase contrast significantly for better text detection
      .linear(1.5, -0.2)
      // Apply unsharp mask for sharpening text edges
      .sharpen({
        sigma: 1.5,
        m1: 1.5,
        m2: 0.5,
      })
      // Normalize to full range
      .normalize()
      // Apply adaptive thresholding (binarization)
      .threshold(128)
      // Ensure high quality output
      .png({
        compressionLevel: 3,
        adaptiveFiltering: true,
        force: true,
      })
      .toBuffer();

    return processed;
  } catch (error) {
    console.error('[PDF Extractor] Image preprocessing failed:', error);
    // Return original buffer if preprocessing fails
    return imageBuffer;
  }
}

/**
 * Detect the dominant language in text sample
 * Returns 'eng', 'deu', or 'eng+deu' based on character analysis
 */
function detectLanguage(text: string): string {
  if (!text || text.length < 10) {
    return 'eng+deu'; // Default to both for short texts
  }

  const sample = text.toLowerCase().slice(0, 1000);

  // German-specific characters and patterns
  const germanPatterns = [
    /[äöüß]/g,                              // Umlauts and eszett
    /\b(der|die|das|den|dem|des)\b/gi,      // German articles
    /\b(und|oder|aber|weil|wenn|dass)\b/gi, // Common conjunctions
    /\b(Zertifikat|Bescheinigung|Zeugnis)\b/gi, // Certificate terms
    /\b(ausgestellt|erteilt|bestanden)\b/gi,    // Certificate verbs
  ];

  // English patterns
  const englishPatterns = [
    /\b(the|a|an)\b/gi,                     // English articles
    /\b(and|or|but|because|if|that)\b/gi,   // Common conjunctions
    /\b(certificate|certified|credential)\b/gi, // Certificate terms
    /\b(issued|awarded|completed)\b/gi,     // Certificate verbs
  ];

  let germanScore = 0;
  let englishScore = 0;

  // Score German patterns
  for (const pattern of germanPatterns) {
    const matches = sample.match(pattern);
    if (matches) {
      germanScore += matches.length * (pattern.source.includes('äöüß') ? 3 : 1);
    }
  }

  // Score English patterns
  for (const pattern of englishPatterns) {
    const matches = sample.match(pattern);
    if (matches) {
      englishScore += matches.length;
    }
  }

  // Determine language based on scores
  if (germanScore > englishScore * 1.5) {
    return 'deu';
  } else if (englishScore > germanScore * 1.5) {
    return 'eng';
  } else {
    return 'eng+deu'; // Mixed or unclear - use both
  }
}

/**
 * Extract text from a PDF file
 * First tries native text extraction, falls back to OCR if needed
 */
export async function extractTextFromPDF(
  pdfPath: string,
  options?: OCROptions
): Promise<ExtractedTextResult> {
  const opts = { ...DEFAULT_OCR_OPTIONS, ...options };
  console.log(`[PDF Extractor] Starting extraction for: ${pdfPath}`);
  console.log(`[PDF Extractor] OCR settings: ${JSON.stringify({
    density: opts.density,
    width: opts.width,
    preprocess: opts.preprocess,
    language: opts.language,
    oemMode: opts.oemMode,
    psmMode: opts.psmMode,
  })}`);

  // First, try native text extraction
  let nativeResult;
  try {
    nativeResult = await extractNativeText(pdfPath);
  } catch (error: any) {
    console.error(`[PDF Extractor] Native extraction failed, will try OCR:`, error.message);
    nativeResult = { text: '', pageCount: 0 };
  }

  // If we got substantial text (more than 100 characters), use native
  if (nativeResult.text.trim().length > 100) {
    console.log(`[PDF Extractor] Using native extraction, text length: ${nativeResult.text.trim().length}`);
    return {
      ...nativeResult,
      method: 'native',
      language: detectLanguage(nativeResult.text),
    };
  }

  console.log(`[PDF Extractor] Native text too short (${nativeResult.text.trim().length} chars), falling back to OCR`);
  // Otherwise, fall back to OCR
  return await extractWithOCR(pdfPath, opts);
}

/**
 * Extract text using pdf-parse (for text-based PDFs)
 */
async function extractNativeText(pdfPath: string): Promise<Omit<ExtractedTextResult, 'method' | 'language'>> {
  try {
    console.log(`[PDF Extractor] Starting native extraction for: ${pdfPath}`);
    const pdfParse = await getPdfParse();
    const buffer = fs.readFileSync(pdfPath);
    console.log(`[PDF Extractor] File read, size: ${buffer.length} bytes`);
    const data = await pdfParse(buffer);
    console.log(`[PDF Extractor] Native extraction complete. Pages: ${data.numpages}, Text length: ${data.text?.length || 0}`);

    return {
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error: any) {
    console.error(`[PDF Extractor] Native extraction failed:`, error.message);
    throw error;
  }
}

/**
 * Extract text using OCR (for scanned/image-based PDFs)
 * Converts PDF pages to images with high quality settings and runs Tesseract on each
 */
async function extractWithOCR(
  pdfPath: string,
  options: Required<OCROptions>
): Promise<ExtractedTextResult> {
  console.log(`[PDF Extractor] Starting enhanced OCR extraction for: ${pdfPath}`);

  const tempDir = path.join(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    console.log(`[PDF Extractor] Converting PDF to images at ${options.density} DPI...`);
    // Convert PDF to images with enhanced settings
    const convert = fromPath(pdfPath, {
      density: options.density,           // Higher DPI for better OCR accuracy
      saveFilename: `ocr-${Date.now()}`,
      savePath: tempDir,
      format: 'png',
      width: options.width,               // Higher resolution
      quality: 100,                       // Maximum quality
    });

    // Get all pages as buffer
    console.log(`[PDF Extractor] Running bulk conversion...`);
    const pageResponse = await convert.bulk(-1); // -1 means all pages
    console.log(`[PDF Extractor] Converted ${pageResponse.length} pages`);

    let fullText = '';
    let totalConfidence = 0;
    let pageCount = 0;
    const pageTexts: string[] = [];

    // Process each page with Tesseract
    for (let i = 0; i < pageResponse.length; i++) {
      const page = pageResponse[i];

      // Read the image file from the saved path
      const imagePath = page.path;
      if (!imagePath || !fs.existsSync(imagePath)) {
        console.log(`[PDF Extractor] Page ${i + 1}: Image path not found: ${imagePath}`);
        continue;
      }

      console.log(`[PDF Extractor] Processing page ${i + 1}...`);
      let imageBuffer = fs.readFileSync(imagePath);

      // Apply image preprocessing if enabled
      if (options.preprocess) {
        console.log(`[PDF Extractor] Page ${i + 1}: Applying image preprocessing...`);
        imageBuffer = await preprocessImage(imageBuffer) as Buffer;
      }

      try {
        console.log(`[PDF Extractor] Page ${i + 1}: Running Tesseract OCR with ${options.language}...`);
        const result = await Tesseract.recognize(
          imageBuffer,
          options.language,
          {
            logger: (m: any) => {
              if (m.status === 'recognizing text') {
                console.log(`[PDF Extractor] Tesseract progress: ${Math.round(m.progress * 100)}%`);
              }
            },
            // Advanced Tesseract configuration
            errorHandler: (err: any) => {
              console.error(`[PDF Extractor] Tesseract error:`, err);
            },
          }
        );

        const pageText = result.data.text;
        pageTexts.push(pageText);
        fullText += pageText + '\n\n';
        totalConfidence += result.data.confidence;
        pageCount++;
        console.log(`[PDF Extractor] Page ${i + 1} OCR complete. Confidence: ${result.data.confidence.toFixed(2)}%`);
      } catch (tesseractError: any) {
        console.error(`[PDF Extractor] Tesseract failed on page ${i + 1}:`, tesseractError.message);
      }
    }

    // Cleanup temp images
    for (const page of pageResponse) {
      if (page.path && fs.existsSync(page.path)) {
        fs.unlinkSync(page.path);
      }
    }

    // Detect language from combined text
    const detectedLanguage = detectLanguage(fullText);
    console.log(`[PDF Extractor] Detected language: ${detectedLanguage}`);

    // Calculate overall confidence with quality weighting
    const avgConfidence = pageCount > 0 ? totalConfidence / pageCount : 0;
    const textLengthScore = Math.min(fullText.length / 500, 1) * 10; // Bonus for longer texts
    const qualityScore = Math.min(avgConfidence + textLengthScore, 100);

    console.log(`[PDF Extractor] OCR extraction complete. Pages: ${pageCount}, Avg Confidence: ${avgConfidence.toFixed(2)}%, Quality Score: ${qualityScore.toFixed(2)}%`);

    return {
      text: fullText,
      method: 'ocr',
      confidence: qualityScore,
      pageCount,
      language: detectedLanguage,
    };
  } catch (error) {
    console.error('[PDF Extractor] OCR extraction failed:', error);
    // Fallback to returning empty text with note
    return {
      text: '',
      method: 'ocr',
      confidence: 0,
      pageCount: 0,
      language: 'eng+deu',
    };
  }
}

/**
 * Retry OCR with different settings if initial attempt has low confidence
 */
export async function extractTextFromPDFWithRetry(
  pdfPath: string,
  minConfidence: number = 60
): Promise<ExtractedTextResult> {
  // First attempt with default settings
  const result = await extractTextFromPDF(pdfPath, DEFAULT_OCR_OPTIONS);

  // If confidence is good enough or method is native, return result
  if (result.method === 'native' || (result.confidence && result.confidence >= minConfidence)) {
    return result;
  }

  console.log(`[PDF Extractor] Low confidence (${result.confidence?.toFixed(2)}%), retrying with alternative settings...`);

  // Retry with different PSM mode (6 = single uniform block of text)
  const retryResult = await extractTextFromPDF(pdfPath, {
    ...DEFAULT_OCR_OPTIONS,
    psmMode: 6,
    preprocess: true,
  });

  // Return the better result
  if ((retryResult.confidence || 0) > (result.confidence || 0)) {
    console.log(`[PDF Extractor] Retry improved confidence to ${retryResult.confidence?.toFixed(2)}%`);
    return retryResult;
  }

  return result;
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
