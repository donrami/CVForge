import { describe, it, expect } from 'vitest';
import { loadMasterTemplate, compileCVTemplate } from '../services/cv-template.js';
import { deriveTemplate } from '../services/template-deriver.js';
import fs from 'fs/promises';
import path from 'path';

const sampleEnglishData = {
  personal: {
    name: 'John Doe',
    subtitle: 'M.Sc. Engineer | Mechanical Engineering \\& AI',
    email: 'john@example.com',
    phone: '+49 123 456789',
    location: 'Mannheim, Germany',
    linkedin: 'https://linkedin.com/in/johndoe',
    dateOfBirth: 'Date of Birth: January 1, 1990',
    nationality: 'Nationality: German',
  },
  summary: 'Experienced engineer with focus on AI.',
  experience: [
    {
      company: 'Acme Corp',
      position: 'Senior Engineer',
      startDate: 'March 2020',
      endDate: 'Present',
      location: 'Berlin | Software',
      highlights: ['Built ML pipelines', 'Led team of 5'],
    },
    {
      company: 'Beta Inc',
      position: 'Engineer',
      startDate: 'Jan 2018',
      endDate: 'Feb 2020',
      location: 'Munich | Engineering',
      highlights: ['Developed APIs'],
    },
  ],
  education: [
    {
      institution: 'TU Munich',
      degree: 'M.Sc.',
      field: 'Computer Science',
      endDate: '2019',
      details: ['Focus on machine learning.'],
    },
  ],
  skills: {
    technical: ['Python', 'TypeScript'],
    soft: ['Leadership'],
    languages: [
      { language: 'English', proficiency: 'Native / C2' },
      { language: 'German', proficiency: 'Fluent / C1' },
    ],
    groups: [
      { label: 'AI \\& ML', items: ['PyTorch', 'TensorFlow'] },
      { label: 'Software Development', items: ['Python', 'TypeScript'] },
    ],
  },
  certifications: [
    { name: 'AWS Certified', date: '2021' },
  ],
  projects: [],
  metadata: {
    language: 'en',
    format: 'international',
    generatedAt: new Date().toISOString(),
    sectionTitles: {
      experience: 'Work Experience',
      education: 'Education',
      skills: 'Core Competencies',
      languages: 'Languages',
      certifications: 'Certifications',
    },
  },
};

const sampleGermanData = {
  personal: {
    name: 'John Doe',
    subtitle: 'M.Sc. Ingenieur | Maschinenbau \\& KI',
    email: 'john@example.com',
    phone: '+49 123 456789',
    location: 'Musterstraße 1, 68165 Mannheim',
    linkedin: 'https://linkedin.com/in/johndoe',
    dateOfBirth: 'Geburtsdatum: 01. Januar 1990',
    nationality: 'Staatsangehörigkeit: Deutsch',
    photo: 'profile.png',
  },
  summary: 'Erfahrener Ingenieur mit Fokus auf KI.',
  experience: [
    {
      company: 'Acme GmbH',
      position: 'Senior Ingenieur',
      startDate: 'März 2020',
      endDate: 'Heute',
      location: 'Berlin | Software',
      highlights: ['ML-Pipelines aufgebaut', 'Team von 5 geleitet'],
    },
  ],
  education: [
    {
      institution: 'TU München',
      degree: 'M.Sc.',
      field: 'Informatik',
      endDate: '2019',
      details: ['Schwerpunkt maschinelles Lernen.'],
    },
  ],
  skills: {
    technical: ['Python', 'TypeScript'],
    soft: ['Führung'],
    languages: [
      { language: 'Deutsch', proficiency: 'Muttersprache / C2' },
      { language: 'Englisch', proficiency: 'Verhandlungssicher / C1' },
    ],
    groups: [
      { label: 'KI \\& ML', items: ['PyTorch', 'TensorFlow'] },
      { label: 'Softwareentwicklung', items: ['Python', 'TypeScript'] },
    ],
  },
  certifications: [
    { name: 'AWS Zertifiziert', date: '2021' },
  ],
  projects: [],
  metadata: {
    language: 'de',
    format: 'german',
    generatedAt: new Date().toISOString(),
    sectionTitles: {
      experience: 'Berufserfahrung',
      education: 'Ausbildung',
      skills: 'Kernkompetenzen',
      languages: 'Sprachen',
      certifications: 'Zertifikate',
    },
  },
};

describe('Template Deriver', () => {
  let masterLatex: string;

  // Load the actual master CV once
  beforeAll(async () => {
    masterLatex = await fs.readFile(
      path.join(process.cwd(), 'context', 'master-cv.tex'),
      'utf-8'
    );
  });

  it('should derive a template from the master CV without errors', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toBeDefined();
    expect(template.length).toBeGreaterThan(0);
    // Should contain Handlebars expressions
    expect(template).toContain('{{');
    expect(template).toContain('}}');
  });

  it('should preserve preamble design elements', () => {
    const template = deriveTemplate(masterLatex);
    // Fonts, colors, formatting should be preserved
    expect(template).toContain('\\setmainfont{Roboto}');
    expect(template).toContain('\\newfontfamily\\headerfont{Charter}');
    expect(template).toContain('\\definecolor{cvblue}');
    expect(template).toContain('\\definecolor{cvgray}');
    expect(template).toContain('\\columnratio{0.69}');
    expect(template).toContain('\\begin{paracol}{2}');
  });

  it('should make babel language-conditional', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#eq metadata.language "de"}}');
    expect(template).toContain('\\usepackage[german]{babel}');
    expect(template).toContain('\\usepackage[english]{babel}');
  });

  it('should wrap babelhyphenation in German conditional', () => {
    const template = deriveTemplate(masterLatex);
    // babelhyphenation should be inside a conditional
    const hyphenIdx = template.indexOf('\\babelhyphenation');
    const condIdx = template.lastIndexOf('{{#eq metadata.language "de"}}', hyphenIdx);
    expect(condIdx).toBeGreaterThan(-1);
    expect(condIdx).toBeLessThan(hyphenIdx);
  });

  it('should have section title placeholders', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{{metadata.sectionTitles.experience}}}');
    expect(template).toContain('{{{metadata.sectionTitles.education}}}');
    expect(template).toContain('{{{metadata.sectionTitles.skills}}}');
    expect(template).toContain('{{{metadata.sectionTitles.languages}}}');
    expect(template).toContain('{{{metadata.sectionTitles.certifications}}}');
  });

  it('should have experience loop', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#each experience}}');
    expect(template).toContain('{{{position}}}');
    expect(template).toContain('{{{company}}}');
    expect(template).toContain('{{{startDate}}}');
    expect(template).toContain('{{{endDate}}}');
    expect(template).toContain('{{#each highlights}}');
  });

  it('should have education loop', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#each education}}');
    expect(template).toContain('{{{degree}}}');
    expect(template).toContain('{{{institution}}}');
  });

  it('should have skills groups loop', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#each skills.groups}}');
    expect(template).toContain('{{{label}}}');
  });

  it('should have languages loop', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#each skills.languages}}');
    expect(template).toContain('{{{language}}}');
    expect(template).toContain('{{{proficiency}}}');
  });

  it('should have certifications loop', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#each certifications}}');
  });

  it('should wrap photo in format conditional', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{#eq metadata.format "german"}}');
    expect(template).toContain('{{{personal.photo}}}');
  });

  it('should have personal data placeholders', () => {
    const template = deriveTemplate(masterLatex);
    expect(template).toContain('{{{personal.name}}}');
    expect(template).toContain('{{{personal.subtitle}}}');
    expect(template).toContain('{{{personal.email}}}');
    expect(template).toContain('{{{personal.phone}}}');
    expect(template).toContain('{{{personal.location}}}');
  });
});

describe('CV Template Compilation', () => {
  it('should produce English output for EN metadata', async () => {
    const template = await loadMasterTemplate();
    const output = compileCVTemplate(template, sampleEnglishData);

    expect(output).toContain('\\usepackage[english]{babel}');
    expect(output).not.toContain('\\usepackage[german]{babel}');
    expect(output).toContain('Work Experience');
    expect(output).toContain('Education');
    expect(output).toContain('Core Competencies');
    expect(output).toContain('Languages');
    expect(output).toContain('Certifications');
    // International format should have photo when provided
    // (English sample has no photo field, so no includegraphics expected)
    expect(output).not.toContain('\\includegraphics');
    // Should have date of birth and nationality (always included)
    expect(output).toContain('Date of Birth');
    expect(output).toContain('Nationality');
    // Should NOT have birth place (never included)
    expect(output).not.toContain('Geburtsort');
    // Should have content from JSON
    expect(output).toContain('Senior Engineer');
    expect(output).toContain('Acme Corp');
    expect(output).toContain('Built ML pipelines');
    expect(output).toContain('English');
    expect(output).toContain('Native / C2');
  });

  it('should produce German output for DE metadata', async () => {
    const template = await loadMasterTemplate();
    const output = compileCVTemplate(template, sampleGermanData);

    expect(output).toContain('\\usepackage[german]{babel}');
    expect(output).not.toContain('\\usepackage[english]{babel}');
    expect(output).toContain('Berufserfahrung');
    expect(output).toContain('Ausbildung');
    expect(output).toContain('Kernkompetenzen');
    expect(output).toContain('Sprachen');
    expect(output).toContain('Zertifikate');
    // German format should have photo
    expect(output).toContain('\\includegraphics');
    expect(output).toContain('profile.png');
    // Should have German personal data
    expect(output).toContain('Geburtsdatum');
    expect(output).toContain('Staatsangehörigkeit');
    // Should NOT have birth place (never included)
    expect(output).not.toContain('Geburtsort');
    expect(output).toContain('babelhyphenation');
    // Should have content from JSON
    expect(output).toContain('Senior Ingenieur');
    expect(output).toContain('Acme GmbH');
    expect(output).toContain('ML-Pipelines aufgebaut');
  });

  it('should render multiple experience entries with spacing', async () => {
    const template = await loadMasterTemplate();
    const output = compileCVTemplate(template, sampleEnglishData);

    // Should have both entries
    expect(output).toContain('Senior Engineer');
    expect(output).toContain('Acme Corp');
    expect(output).toContain('Engineer');
    expect(output).toContain('Beta Inc');
    // Should have spacing between entries (vspace)
    expect(output).toContain('\\vspace{0.4cm}');
  });

  it('should render skill groups', async () => {
    const template = await loadMasterTemplate();
    const output = compileCVTemplate(template, sampleEnglishData);

    expect(output).toContain('AI \\& ML');
    expect(output).toContain('PyTorch');
    expect(output).toContain('Software Development');
    expect(output).toContain('TypeScript');
  });

  it('should produce valid LaTeX structure', async () => {
    const template = await loadMasterTemplate();
    const output = compileCVTemplate(template, sampleEnglishData);

    // Basic LaTeX structure checks
    expect(output).toContain('\\documentclass');
    expect(output).toContain('\\begin{document}');
    expect(output).toContain('\\end{document}');
    expect(output).toContain('\\begin{paracol}');
    expect(output).toContain('\\end{paracol}');
    // Should not contain unresolved Handlebars
    expect(output).not.toMatch(/\{\{[^{]/);
  });
});
