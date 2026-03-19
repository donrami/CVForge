/**
 * CV Template Service
 * 
 * Handles the transformation of CV JSON data into LaTeX using Handlebars.
 * This replaces the previous approach of having the LLM generate raw LaTeX,
 * which was prone to syntax errors and hallucinations.
 */

import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { deriveTemplate } from './template-deriver.js';

export interface TemplateOptions {
  /** Whether to include a photo (based on personal.photo presence in CV data) */
  includePhoto: boolean;
  /** Language: 'en' or 'de' */
  language: 'en' | 'de';
  /** Format: 'german' or 'international' */
  format: 'german' | 'international';
}

/**
 * Escape special characters for LaTeX
 */
function escapeLatex(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Register Handlebars helpers
 */
function registerHelpers(): void {
  // Escape LaTeX special characters
  Handlebars.registerHelper('escape', function(text: string) {
    return escapeLatex(text);
  });

  // Format date for LaTeX
  Handlebars.registerHelper('formatDate', function(date: string) {
    if (!date) return '';
    // If already in German format, return as-is
    if (date.match(/^\d{2}\.\d{2}\.\d{4}$/)) return date;
    // Convert MM/YYYY to Month YYYY
    const match = date.match(/^(\d{1,2})\/(\d{4})$/);
    if (match) {
      const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const month = months[parseInt(match[1])] || match[1];
      return `${month} ${match[2]}`;
    }
    return date;
  });

  // Join array with separator
  Handlebars.registerHelper('join', function(array: string[], separator: string) {
    if (!array || !Array.isArray(array)) return '';
    return array.filter(Boolean).join(separator);
  });

  // Check if array is not empty
  Handlebars.registerHelper('hasItems', function(array: unknown[]) {
    return array && Array.isArray(array) && array.length > 0;
  });

  // Conditional helper
  Handlebars.registerHelper('ifHas', function(this: unknown, context: unknown, options: Handlebars.HelperOptions) {
    if (context && (Array.isArray(context) ? context.length > 0 : true)) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  // Equality helper for language conditionals
  Handlebars.registerHelper('eq', function(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    if (a === b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });
}

// Register helpers once
registerHelpers();

/**
 * Load the master CV template from context directory.
 * Reads the plain LaTeX master CV and auto-derives a Handlebars template.
 */
export async function loadMasterTemplate(): Promise<string> {
  const templatePath = path.join(process.cwd(), 'context', 'master-cv.tex');
  try {
    const masterLatex = await fs.readFile(templatePath, 'utf-8');
    return deriveTemplate(masterLatex);
  } catch (error) {
    // Return a default template if none exists
    console.warn('[CV Template] No master template found, using default');
    return getDefaultTemplate();
  }
}

/**
 * Compile CV JSON data into LaTeX using Handlebars
 */
export function compileCVTemplate(template: string, cvData: Record<string, unknown>): string {
  const handlebars = Handlebars.compile(template, { noEscape: true });
  
  // Pre-process data to add formatting helpers
  const processedData = {
    ...cvData,
    // Add escape helper to all string values
    personal: cvData.personal ? {
      ...cvData.personal as object,
    } : {},
    // Process experience highlights
    experience: (cvData.experience as Array<Record<string, unknown>>)?.map(exp => ({
      ...exp,
    })) || [],
    // Process education
    education: (cvData.education as Array<Record<string, unknown>>)?.map(edu => ({
      ...edu,
    })) || [],
    // Process skills (pass through as-is, including groups)
    skills: cvData.skills || {},
    // Process certifications
    certifications: (cvData.certifications as Array<Record<string, unknown>>)?.map(cert => ({
      ...cert,
    })) || [],
    // Process projects
    projects: (cvData.projects as Array<Record<string, unknown>>)?.map(proj => ({
      ...proj,
    })) || [],
    // Pass metadata through for language conditionals
    metadata: cvData.metadata || {},
  };
  
  return handlebars(processedData);
}

/**
 * Get a default template structure if none exists
 */
function getDefaultTemplate(): string {
  return `% Default Master CV Template
% This template uses Handlebars placeholders

\\documentclass[11pt,a4paper]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\geometry{margin=2cm}
\\usepackage{paracol}
\\usepackage{ifthen}
\\usepackage{xcolor}
\\usepackage{hyperref}

% Colors
\\definecolor{primary}{RGB}{0,51,102}
\\definecolor{secondary}{RGB}{100,100,100}

% Header
\\begin{document}
\\pagestyle{empty}

% Personal Information Header
\\textbf{\\Large {{personal.name}}}

\\smallskip

{{#if personal.email}}{{{personal.email}}} \\\\
{{/if}}
{{#if personal.phone}}{{{personal.phone}}} \\\\
{{/if}}
{{#if personal.location}}{{{personal.location}}}
{{/if}}

\\smallskip
\\hrule
\\smallskip

{{#ifHas experience}}
\\textbf{Experience}

{{#each experience}}
\\textbf{{{position}}} \\\\
\\textit{{{company}}}, {{startDate}} - {{endDate}} \\\\
{{#if location}}{{{location}}}\\\\
{{/if}}
\\begin{itemize}
{{#each highlights}}
\\item {{{.}}}
{{/each}}
\\end{itemize}
\\smallskip
{{/each}}
{{/ifHas}}

{{#ifHas education}}
\\textbf{Education}

{{#each education}}
\\textbf{{{degree}}}{{#if field}} in {{{field}}}{{/if}} \\\\
{{{institution}}}, {{startDate}} - {{endDate}}
{{#if grade}}\\\\ Grade: {{{grade}}}{{/if}}
\\smallskip
{{/each}}
{{/ifHas}}

{{#if skills.technical}}
\\textbf{Technical Skills}

{{{join skills.technologies ", "}}}
{{/if}}

\\end{document}
`;
}
