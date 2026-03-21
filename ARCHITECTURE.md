# CVForge — Technical Architecture Context

## What It Is

CVForge is a self-hosted, single-user AI-powered CV generator and job application tracker. You paste a job description, and it produces a tailored LaTeX CV compiled to PDF using your master CV as the source of truth. It uses Google Gemini for generation and Gemini Vision for certificate OCR.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, React Router
- Backend: Node.js 22, Express, TypeScript (via tsx), Prisma ORM
- Database: PostgreSQL 16
- AI: Google Gemini API (`gemini-3.1-pro-preview`) via `@google/genai`
- PDF compilation: LuaLaTeX (primary), pdflatex (fallback), 30s timeout
- PDF extraction: Gemini Vision multimodal API (replaces legacy OCR)
- LaTeX Sanitizer: strips dangerous commands, deduplicates preamble, escapes special chars on direct LLM output
- DevOps: Docker multi-stage build, Docker Compose (app + PostgreSQL)
- Logging: Pino (structured JSON)

## Project Structure

```
server.ts                         # Express entry point. Initializes Prisma, Gemini client, Vite dev middleware, static serving, health check. Exports `prisma` and `ai` singletons.
server/
  routes.ts                       # Main API router. CRUD for applications (list, get, patch, soft-delete). Download endpoints for .tex and .pdf (compiles on demand). Backup/restore endpoints (JSON export/import with merge). PDF export endpoint. Settings endpoints for master CV, certificates.md, profile image (multer upload), and prompt management. Chat assistant endpoint (/prompts/chat). Job status endpoints for background generation polling.
  generate.ts                     # CV generation pipeline. LLM produces LaTeX directly. Fire-and-forget pattern: POST returns immediately with jobId, processing happens async via setImmediate(). Job status tracked in GenerationJob model. Extracts LaTeX from response (handles markdown fences), sanitizes, handles profile image injection, saves to DB and filesystem. Also handles /regenerate (creates child application from parent).
  certificates.ts                 # Certificate CRUD + PDF extraction via Gemini Vision + sync-to-context (writes certificates.md). Supports both skill certificates and work certificates (Arbeitszeugnisse).
  middleware/upload.ts            # Multer config for certificate PDF uploads (temp directory, file size limits).
  services/
    certificate-extractor.ts      # Sends PDF as base64 to Gemini Vision with a detailed extraction prompt. Returns structured data: name, issuer, dates, skills, activities, confidence score. Handles both skill certs and employment letters.
    cv-template.ts                # Legacy Handlebars template engine (not used in generation pipeline — retained for reference).
    latex-sanitizer.ts            # Security layer for direct LLM LaTeX output. stripDangerousLatex() removes \write18, \input, \directlua, etc. and logs violations. deduplicatePreamble() removes duplicate \usepackage lines. escapeLatexSpecialChars() fixes unescaped & outside tabular environments.
    pdf-extractor.ts              # Gemini Vision-based PDF text extraction. Sends PDF directly to Gemini's multimodal API which handles both native text and scanned/image-based PDFs. Returns structured extraction results with language detection.
    profile-image.ts              # Finds user's uploaded profile image, copies it to generation directory, patches \includegraphics references in LaTeX. Falls back to 1x1 transparent PNG placeholder if no image uploaded.
    prompts.ts                    # File-based prompt management. Reads/writes generator.md from context/prompts/. No hardcoded fallback — the file must exist. Exposes loadAllPrompts(), saveAllPrompts(), getDefaults().
    cv-schema.ts                 # CV JSON schema definition for structured LLM output (alternative to direct LaTeX).
    template-deriver.ts          # Parses plain LaTeX master CV and auto-derives Handlebars templates by replacing content with placeholders.
    backup.ts                     # BackupService. Exports all non-deleted applications as a JSON file with version metadata. Returns BackupData with version, exportedAt, and applications array.
    restore.ts                    # RestoreService. Validates uploaded JSON backup files (structure, required fields, enum values, ISO dates). Restores via Prisma $transaction with upsert (merge by id). Returns created/updated counts.
    pdf-export.ts                 # PDFExportService. Generates a PDF table of applications using pdfkit. Columns: Company, Role, Status, Language, Date. Returns a Buffer.
    job.ts                        # Job management service. CRUD operations for GenerationJob model: createJob, startJob, updateJobProgress, completeJob, failJob, getJob, getActiveJobs.
    logger.ts                     # Pino logger instance.

src/                              # React SPA frontend
  pages/
    Dashboard.tsx                 # Lists applications with pagination (10 per page). Toolbar with Backup (JSON), Export PDF, and Restore buttons. Search filter resets to page 1. Restore flow: file picker → confirmation dialog → upload → refresh.
    NewApplication.tsx            # Form: company name, job title, job description, target language (EN/DE), additional context. Uses job-based generation with polling for progress. User can navigate away while generation continues in background.
    ApplicationDetail.tsx         # View application details, download PDF/TEX, update status/notes/dates, regenerate with additional context.
    Settings.tsx                 # Tabs: Master CV editor, Certificate management (upload/extract/edit/sync), Profile image upload, Prompt editor (generator with reset-to-defaults).
    Login.tsx                    # (Removed — no auth needed for self-hosted use)
  hooks/
    useJobStatus.ts              # Hook for polling job status until completion or error. Manages polling lifecycle, callbacks for progress/complete/error.
    useActiveJobChecker.ts       # Hook for monitoring completed jobs when user returns to the app. Stores known job IDs in sessionStorage for cross-page-load continuity.
  components/                     # UI components, dialogs, layout wrapper. Includes PaginationControls (Previous/Next with page info), RestoreConfirmationDialog (merge confirmation), AlertDialog, ConfirmDialog, Toast (persistent notifications), ThemeToggle, BackgroundTexture, EmptyState, CertificateUpload, CertificatePreview, and ChatPanel.
  components/                     # UI components, dialogs, layout wrapper. Includes PaginationControls (Previous/Next with page info) and RestoreConfirmationDialog (merge confirmation with application count).
  context/                        # React context providers for dialog state.

context/                          # User context files (gitignored, persisted via Docker volumes)
  master-cv.tex                   # The user's base LaTeX CV template — source of truth for all generations. German-language, uses LuaLaTeX with fontspec, paracol two-column layout, Roboto font.
  certificates.md                 # Auto-generated markdown from extracted certificates. Includes work certificates (with activities) and skill certificates. Used as context during generation.
  instructions.md                 # Optional personal CV writing preferences (career focus, company-specific rules, content guidelines, exclusions). Template with empty sections by default.
  prompts/
    generator.md                  # Customizable generator prompt for direct LaTeX output. Instructs the LLM to produce a complete, compilable LaTeX document based on the master CV's structure. Contains all content rules (Arbeitszeugnisse grounding, tailoring, language/format requirements).

generated/                        # Runtime output. Each application gets a directory named by its CUID. Contains cv.tex, cv.pdf, cv.aux, cv.log, cv.out, and profile image copy.
uploads/
  profile/                        # Single profile image (JPG/PNG/WebP, max 5MB).
  certificates/                   # Uploaded certificate PDFs (processed then cleaned up).
  temp/                           # Temporary files for OCR processing.
```

## Database Schema

Three models in PostgreSQL via Prisma:

**Application**
- `id` (CUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- `companyName`, `jobTitle`, `jobDescription` (text), `targetLanguage` (EN | DE)
- `iterationCount` (int, default 2), `additionalContext` (text, optional)
- `latexOutput` (text — the generated LaTeX), `pdfGenerated` (boolean)
- `generationLog` (JSON — structured object: `{ rawResponse, model, timestamp, targetLanguage, jobId }`)
- `status` (GENERATING | GENERATED | APPLIED | INTERVIEW | OFFER | REJECTED | WITHDRAWN)
- `notes` (text), `appliedAt`, `interviewAt`, `offerAt`, `rejectedAt`
- `parentId` → self-referential relation for regeneration lineage

**GenerationJob**
- `id` (CUID), `createdAt`, `updatedAt`
- `status` (PENDING | PROCESSING | COMPLETED | FAILED)
- `error` (text) — set when job fails
- `companyName`, `jobTitle`, `jobDescription` (text), `targetLanguage` (EN | DE)
- `additionalContext` (text, optional), `parentId` (optional)
- `applicationId` (string) — set when job completes successfully
- `phase` (string) — current phase: "preparing" | "ai-working" | "finalizing"
- `aiChars` (int) — character count from AI response (for progress tracking)

**Certificate**
- `id` (CUID), `createdAt`, `updatedAt`
- `name`, `issuer`, `issueDate`, `expiryDate`, `credentialId` (all strings, flexible format)
- `skills` (string array), `activities` (string array — for work certificates)
- `description` (text), `sourceFile`, `verified` (boolean), `rawExtractedText` (text)
- `confidence` (float, 0-1)

## API Endpoints

### Applications
- `GET /api/applications` — paginated list (skip/take, default 10 per page), excludes soft-deleted, returns `{ applications, total, skip, take }`
- `GET /api/applications/backup` — download JSON backup of all non-deleted applications (Content-Disposition: `cvforge-backup-YYYY-MM-DD.json`)
- `POST /api/applications/restore` — upload JSON backup (multipart/form-data), validates structure, merges via upsert, returns `{ success, created, updated }`
- `GET /api/applications/export/pdf` — download PDF export of all non-deleted applications (Content-Disposition: `cvforge-applications-YYYY-MM-DD.pdf`)
- `GET /api/applications/:id` — detail with parent and regenerations
- `PATCH /api/applications/:id` — update status, notes, dates (Zod validated)
- `DELETE /api/applications/:id` — soft delete (sets deletedAt)
- `GET /api/applications/:id/download/tex` — download LaTeX source
- `GET /api/applications/:id/download/pdf` — compile and download PDF (LuaLaTeX → pdflatex fallback)

### Generation
- `POST /api/generate` — Fire-and-forget. Accepts: jobDescription, companyName, jobTitle, targetLanguage, additionalContext, parentId. Creates GenerationJob, returns 202 with `{ jobId, status, message }`. Processing happens asynchronously.
- `POST /api/applications/:id/regenerate` — Creates a new GenerationJob from parent application. Returns 202 with job ID. Same fire-and-forget pattern.

### Jobs
- `GET /api/jobs` — List active (non-terminal) jobs. Returns `{ jobs: [{ id, status, companyName, jobTitle, createdAt }] }`
- `GET /api/jobs/:id` — Get job status. Returns `{ id, status, phase, aiChars, applicationId, error, companyName, jobTitle }`

### Settings
- `GET/POST /api/settings/context` — read/write master-cv.tex and certificates.md
- `GET/POST/DELETE /api/settings/profile-image` — profile image CRUD (multer, max 5MB, JPG/PNG/WebP)
- `GET/POST /api/settings/prompts` — read/write generator prompt
- `GET /api/settings/prompts/defaults` — get hardcoded default prompt

### Certificates
- `GET /api/certificates` — list all
- `POST /api/certificates` — create (Zod validated)
- `PATCH /api/certificates/:id` — update
- `DELETE /api/certificates/:id` — hard delete
- `POST /api/certificates/extract` — upload PDFs (max 10), extract via Gemini Vision
- `POST /api/certificates/sync-to-context` — regenerate certificates.md from DB

### Chat
- `POST /api/prompts/chat` — conversational assistant for prompt improvement. Always includes a brief system prompt explaining the app. Full prompt context is only injected when `includeFullContext: true` is explicitly passed in the request body.

### Health
- `GET /api/health` — DB connectivity check

## CV Generation Pipeline (Core Flow)

1. User submits job description + company + title + language + optional context
2. Server creates a GenerationJob record with status PENDING, returns 202 with jobId immediately
3. User's browser polls GET /api/jobs/:id every 2 seconds for status updates
4. Server processes generation asynchronously via setImmediate():
   a. Loads: master-cv.tex, certificates.md, and the generator prompt from `context/prompts/generator.md`
   b. Sends the generator prompt + assembled context to Gemini in a single LLM call (no JSON schema constraints)
   c. Streams the response, updating job progress (phase, aiChars) every 300 chars
   d. `extractLatex()` strips markdown fences if present and validates `\begin{document}` is present
   e. LaTeX sanitization: `stripDangerousLatex()` removes dangerous commands and logs violations, `deduplicatePreamble()` removes duplicate `\usepackage` lines, `escapeLatexSpecialChars()` fixes unescaped `&` outside tabular environments
   f. Profile image: copy user's uploaded photo to generation directory, patch `\includegraphics` references
   g. Create Application record with raw LLM response in generation log, write to filesystem
   h. Update GenerationJob to COMPLETED with applicationId, or FAILED with error message
5. When user's polling detects COMPLETED status, show persistent toast notification and navigate to dashboard
6. PDF compilation happens on-demand when user downloads (not during generation)

### Background Generation

The generation pipeline supports background processing:
- User can navigate away from NewApplication page after submitting
- Job ID is persisted to sessionStorage for cross-page-load continuity
- Generation continues server-side regardless of client connection state
- When user returns, they can see progress via polling and receive toast notification on completion

## LaTeX Compilation (On-Demand)

When `/api/applications/:id/download/pdf` is called:
1. Check if cv.tex exists in generated/{id}/, create if not (with profile image + escaping)
2. Check if cv.pdf already exists and `pdfGenerated` flag is set
3. If not, compile with `lualatex --no-shell-escape -interaction=nonstopmode`
4. If LuaLaTeX fails with fontspec-related errors, fallback to `pdflatex`
5. If compilation fails but PDF was still produced (non-fatal errors), serve it anyway
6. If compilation fully fails, return error with first 3 LaTeX error lines

## Certificate Extraction Flow

1. User uploads PDF(s) via `/api/certificates/extract`
2. Each PDF is sent as base64 to Gemini Vision with a detailed extraction prompt
3. Gemini returns structured JSON: name, issuer, dates, skills, activities, description, confidence
4. Results returned to frontend for review/editing
5. User saves to DB via `POST /api/certificates`
6. User triggers sync via `POST /api/certificates/sync-to-context` → regenerates certificates.md
7. certificates.md is then available as context for future CV generations

## Security Model

- Single-user self-hosted app, no authentication required
- LaTeX sanitization: blocks \write18, \input, \include, \directlua, \openout, \catcode, etc.
- `--no-shell-escape` flag on LaTeX compilation
- File upload validation: type whitelist, size limits
- Soft deletes for audit trail
- .env, context/, generated/, uploads/ all gitignored

## Prompt Architecture

A single consolidated prompt controls the entire generation pipeline, customizable via the Settings UI:

- **Generator** (`context/prompts/generator.md`, ~150 lines): Instructs the LLM to produce a complete, compilable LaTeX document directly, using the master CV's structure and design as a basis. Contains all content rules: Arbeitszeugnisse grounding, no invented facts, chronological completeness, German/international format requirements, tailoring guidelines, skills sidebar rules, and certification rules.

The prompt is loaded from `context/prompts/generator.md` at generation time. There is no hardcoded fallback — if the file is missing or empty, generation fails with a clear error. The prompt service (`prompts.ts`) manages only the `generator` key.

## Context Files Used During Generation

- `context/master-cv.tex` — the source of truth for all factual claims
- `context/certificates.md` — extracted certificate data with skills and work activities
- `context/prompts/generator.md` — the consolidated generation prompt

## Key Design Decisions

- Single LLM pass with a consolidated prompt instead of three separate API calls — reduces latency and cost
- Direct LaTeX output from LLM — the model produces the final LaTeX document directly using the master CV as a structural reference, giving it full control over formatting and tailoring
- LaTeX sanitization as the primary safety gate — `stripDangerousLatex()`, `deduplicatePreamble()`, and `escapeLatexSpecialChars()` ensure safe, compilable output
- Polling-based progress tracking (GET /api/jobs/:id every 2s) instead of SSE
- Job ID persisted to sessionStorage for resume after page refresh
- Fire-and-forget generation with background processing — user can navigate away
- On-demand PDF compilation (not during generation) — faster generation, compilation only when needed
- File-based prompt storage — prompt is editable via Settings UI, no hardcoded fallback
- Regeneration lineage via parentId — tracks iterative refinement history
- Gemini Vision for PDF extraction (text and OCR) — no separate OCR library needed
- Chat endpoint uses explicit `includeFullContext` flag instead of fragile keyword matching
- Persistent toasts for important notifications (CV ready, generation failed) — user must dismiss explicitly
