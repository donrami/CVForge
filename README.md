# CVForge

CVForge is a personal, self-hosted AI-powered CV generator and job application tracker. Paste a job description, and it uses your master CV plus context documents to produce a tailored, publication-ready LaTeX CV — compiled to PDF automatically.

## Features

- **AI-Powered CV Tailoring** — Single-pass generation pipeline using Gemini that produces LaTeX directly from your master CV template, giving the LLM full control over formatting and tailoring for high-quality, context-aware CVs
- **German & International Standards** — Automatically detects CV language and applies the correct conventions (German *Bewerbungskultur* vs. international/ATS-optimized format)
- **LaTeX to PDF** — Compiles generated `.tex` files to PDF via LuaLaTeX (with pdflatex fallback)
- **Application Tracker** — Track job applications through statuses (Generated → Applied → Interview → Offer / Rejected / Withdrawn) with notes and dates
- **Regeneration Lineage** — Regenerate CVs with additional context and track the parent/child history
- **Certificate OCR** — Upload PDF certificates (work references, certifications, course completions) and extract structured data via Gemini Vision. Extracted certificates are stored in the database and can be synced to a context file for use in generation
- **Profile Image Support** — Upload a profile photo that gets embedded into generated CVs automatically
- **Customizable Prompt** — Edit the consolidated generator prompt directly from the Settings UI. Reset to defaults anytime
- **LaTeX Sanitizer** — AI-generated LaTeX is stripped of dangerous commands (`\input`, `\write18`, etc.) and special characters are escaped before compilation
- **Structured Logging** — Pino-based JSON logging throughout the server

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router
- **Backend:** Node.js 22, Express, TypeScript (tsx), Prisma ORM
- **Database:** PostgreSQL 16
- **AI:** Google Gemini API (`gemini-3-flash-preview`) via `@google/genai`
- **PDF:** LuaLaTeX / pdflatex
- **DevOps:** Docker, Docker Compose, multi-stage Dockerfile

## Quick Start

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values:
   - `GEMINI_API_KEY` — Google Gemini API key
   - `DATABASE_URL` — PostgreSQL connection string (default works with Docker Compose)
3. Start with Docker Compose:
   ```bash
   docker compose up --build -d
   ```
4. Initialize the database:
   ```bash
   docker compose exec app npx prisma db push
   ```
5. Open `http://localhost:3000`

### Local Development (without Docker)

Requires Node.js 22+, PostgreSQL, and a LaTeX distribution (TeX Live with LuaLaTeX).

```bash
npm install
npx prisma db push
npm run dev
```

## Project Structure

```
├── server.ts              # Express server entry point
├── server/
│   ├── routes.ts          # API routes (applications, settings, profile image, prompts)
│   ├── generate.ts        # CV generation pipeline (direct LaTeX output from LLM)
│   ├── certificates.ts    # Certificate CRUD + OCR extraction + context sync
│   ├── middleware/         # Multer upload config
│   └── services/
│       ├── certificate-extractor.ts  # Gemini Vision PDF extraction
│       ├── latex-sanitizer.ts        # Security sanitization for LaTeX output
│       ├── pdf-extractor.ts          # PDF text + image extraction (native + OCR fallback)
│       ├── profile-image.ts          # Profile photo handling for LaTeX
│       ├── prompts.ts                # File-based prompt management (single generator prompt)
│       └── logger.ts                 # Pino logger
├── src/                   # React frontend
│   ├── pages/             # Dashboard, NewApplication, ApplicationDetail, Settings
│   ├── components/        # UI components, dialogs, layout
│   └── context/           # Dialog context providers
├── context/               # User context files (master CV, certificates, prompts)
├── prisma/schema.prisma   # Database schema
├── generated/             # Runtime output (LaTeX + PDF per application)
└── uploads/               # Uploaded certificates and profile images
```

## Configuration

All configuration happens in the Settings page:

- **Master CV** — Your base LaTeX CV template (the source of truth for all generations)
- **Certificates** — Upload PDFs to extract certificate data via Gemini Vision, review/edit extracted info, then sync to context
- **Profile Image** — Upload a photo to be included in generated CVs
- **Prompt** — Customize the generator prompt that instructs the LLM how to produce LaTeX CVs

## Security Notes

- `.env`, `context/`, `generated/`, and `uploads/` are all gitignored — never commit these
- LaTeX output is sanitized before compilation (no shell escape, no file I/O commands)
- The app is designed for single-user local/self-hosted use

## License

MIT
