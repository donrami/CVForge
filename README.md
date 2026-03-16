# CVForge

CVForge is a personal AI-powered CV generation and job application tracking tool. It takes a job description, applies a stored master CV and context documents, and uses the Gemini API in a multi-pass self-critique loop to generate a tailored, high-quality LaTeX CV.

## Features

- **AI-Powered Tailoring:** Uses Gemini 3.1 Flash Lite Preview to rewrite and tailor your CV with self-critique loops.
- **Self-Critique Loop:** Runs multiple passes to ensure high quality, no hallucinations, and strict adherence to rules.
- **LaTeX Compilation:** Automatically compiles the generated `.tex` files to PDF.
- **Application Tracking:** Manage your job applications, statuses, and notes in one place.
- **Regeneration Lineage:** Regenerate CVs with additional context and track the history.
- **Certificate OCR:** Upload PDF certificates to extract information via Gemini Vision and add them to your context.

## Technology Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL
- **AI:** Google Gemini API (Gemini 3.1 Flash Lite Preview for all AI operations)
- **DevOps:** Docker, Docker Compose

## Quick Start

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in your secrets:
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `AUTH_PASSWORD_HASH`: A bcrypt hash of your master password (generate with: `node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"`)
   - `NEXTAUTH_SECRET`: A random string for JWT signing (generate with: `openssl rand -base64 32`)
   - `NEXTAUTH_URL`: The URL where the app is hosted (default: `http://localhost:3000` for development)
   - `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://cvforge:cvforge@db:5432/cvforge` for Docker)
3. Run `docker compose up --build -d` to start the services.
4. Run `docker compose exec app npx prisma db push` to initialize the database.
5. Access the app at `http://localhost:3000`.

## Configuration

- **Master CV:** Upload your base LaTeX CV in the Settings page.
- **Certificates & Instructions:** Add extra context and custom rules for the AI.
- **Certificate Import:** Use the Certificate Import section in Settings to upload PDF certificates and extract their information via OCR.

## Security Note

**NEVER** commit your `.env` file or the `context/` directory to version control. They contain your private API keys and personal information.

## License

MIT
