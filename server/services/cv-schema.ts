/**
 * CV JSON Schema
 * 
 * This defines the structured JSON output format for CV generation.
 * Instead of generating raw LaTeX (which can have syntax errors),
 * the LLM outputs this JSON schema, which is then safely injected
 * into a Handlebars template to produce the final LaTeX.
 */

export interface CVData {
  /** Personal information */
  personal: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    dateOfBirth?: string; // DD.MM.YYYY format
    photo?: string; // Path to photo or base64
  };
  
  /** Professional summary */
  summary?: string;
  
  /** Work experience - reverse chronological order */
  experience: Array<{
    company: string;
    position: string;
    startDate: string; // MM/YYYY or Month YYYY
    endDate?: string; // "Present" or MM/YYYY
    location?: string;
    highlights: string[]; // Bullet points of achievements
  }>;
  
  /** Education - reverse chronological order */
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
    grade?: string;
    details?: string[];
  }>;
  
  /** Skills and competencies */
  skills: {
    technical?: string[]; // Programming languages, tools, technologies
    soft?: string[]; // Leadership, communication, etc.
    languages?: Array<{
      language: string;
      proficiency: string; // Native, Fluent, Conversational, Basic
    }>;
  };
  
  /** Certifications */
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
    credentialId?: string;
  }>;
  
  /** Projects */
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
    highlights?: string[];
  }>;
  
  /** Additional sections (custom) */
  additional?: Array<{
    title: string;
    content: string[];
  }>;
  
  /** Metadata */
  metadata: {
    language: 'en' | 'de';
    format: 'german' | 'international';
    generatedAt: string;
  };
}

/**
 * Default empty CV structure
 */
export function createEmptyCV(language: 'en' | 'de' = 'en'): CVData {
  return {
    personal: {
      name: '',
    },
    experience: [],
    education: [],
    skills: {},
    metadata: {
      language,
      format: language === 'de' ? 'german' : 'international',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Validation schema for CV data
 * Used to validate the LLM output before templating
 */
export const CV_SCHEMA_PROMPT = `
You are a CV data extraction and restructuring specialist. Transform the candidate's master CV and the job requirements into a structured JSON object.

CRITICAL: Output ONLY valid JSON. No markdown, no explanation, no LaTeX code.

SCHEMA:
{
  "personal": {
    "name": "Full name",
    "email": "email@example.com",
    "phone": "+49 123 4567890", 
    "location": "City, Country",
    "linkedin": "https://linkedin.com/in/...",
    "github": "https://github.com/...",
    "website": "https://...",
    "dateOfBirth": "DD.MM.YYYY (only for German format)"
  },
  "summary": "2-4 sentence professional summary tailored to the job",
  "experience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or 'Present'",
      "location": "City, Country",
      "highlights": ["Achievement 1", "Achievement 2", ...]
    }
  ],
  "education": [
    {
      "institution": "University/School Name",
      "degree": "Degree type (Bachelor, Master, etc.)",
      "field": "Field of study",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY",
      "grade": "Grade (optional)",
      "details": ["Relevant coursework", "Thesis topic", etc.]
    }
  ],
  "skills": {
    "technical": ["Python", "React", "AWS", ...],
    "soft": ["Leadership", "Communication", ...],
    "languages": [
      {"language": "German", "proficiency": "Native"},
      {"language": "English", "proficiency": "Fluent"}
    ]
  },
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "MM/YYYY",
      "credentialId": "ID (if available)"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "https://...",
      "highlights": ["Key feature 1", ...]
    }
  ],
  "metadata": {
    "language": "en" or "de",
    "format": "international" or "german",
    "generatedAt": "${new Date().toISOString()}"
  }
}

RULES:
1. Only include fields that have actual data
2. Tailor the summary and experience highlights to the job description
3. Use the job description to determine: language (en/de), format (german/international)
4. For German format: include dateOfBirth, nationality, photo reference, full address. Do NOT include birthPlace.
5. For International format: include photo if present in master CV, dateOfBirth, nationality. Do NOT include full street address, birthPlace, or marital status.
6. Experience should be reverse chronological (most recent first)
7. Quantify achievements where possible (e.g., "Reduced latency by 40%")
8. Match keywords from job description naturally in skills and experience
9. NEVER fabricate information - only use what exists in the master CV
`;
