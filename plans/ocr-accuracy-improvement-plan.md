# OCR Accuracy Improvement Plan - Simplified

## Solution: Remove OCR, Use Gemini Vision Directly

Instead of using Tesseract.js for OCR and then sending text to Gemini, we'll send the PDF directly to Gemini Vision. This is simpler, more accurate, and reduces code complexity.

## New Architecture

```
PDF Upload → Read as Base64 → Send to Gemini Vision → Extract Structured Data
```

## Changes Required

### 1. Update [`certificate-extractor.ts`](server/services/certificate-extractor.ts)
- Remove `extractCertificateFromText()` function
- Add `extractCertificateFromPDF()` function that accepts PDF buffer/path
- Send PDF as base64 inlineData to Gemini
- Use vision-optimized prompt

### 2. Update [`certificates.ts`](server/certificates.ts) Route
- Remove dependency on `pdf-extractor.ts` for text extraction
- Read uploaded PDF file as buffer
- Pass buffer directly to certificate extractor

### 3. Keep [`pdf-extractor.ts`](server/services/pdf-extractor.ts) for Utility
- Keep the file for any future PDF processing needs
- But remove it from the certificate extraction flow

### 4. Update Prompt for Vision
- Create new prompt optimized for visual certificate analysis
- Include layout hints (logos at top, signatures at bottom, etc.)

## Implementation

### New Flow in certificates.ts
```typescript
// Read PDF file
const pdfBuffer = fs.readFileSync(file.path);

// Extract directly with Gemini Vision
const certificate = await extractCertificateFromPDF(pdfBuffer);
```

### New Function in certificate-extractor.ts
```typescript
export async function extractCertificateFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedCertificate | null> {
  const base64PDF = pdfBuffer.toString('base64');
   
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: [{
      role: 'user',
      parts: [
        { text: VISION_CERTIFICATE_PROMPT },
        { 
          inlineData: {
            mimeType: 'application/pdf',
            data: base64PDF
          }
        }
      ]
    }]
  });
   
  // Parse response as before
}
```

## Benefits

1. **Simpler Code:** Remove Tesseract.js, pdf2pic, image preprocessing
2. **Higher Accuracy:** Gemini Vision > Tesseract.js for certificates
3. **Faster Processing:** Single API call instead of OCR + AI
4. **Better Layout Understanding:** Gemini sees the actual certificate design
5. **Native Language Support:** Better German/English handling

## Files to Modify

1. [`server/services/certificate-extractor.ts`](server/services/certificate-extractor.ts) - Add PDF extraction, remove text extraction
2. [`server/certificates.ts`](server/certificates.ts) - Update route to use new extractor

## Dependencies to Keep/Remove

**Keep:**
- `@google/genai` - For Gemini API

**Remove from certificate flow:**
- `tesseract.js` - No longer needed for certificates
- `pdf2pic` - No longer needed for certificates
- Sharp preprocessing - No longer needed

**Note:** These can still be kept in the project if used elsewhere, just removed from certificate extraction.
