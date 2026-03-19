/**
 * Template Deriver
 * 
 * Parses a plain LaTeX master CV and auto-derives a Handlebars template
 * by replacing content with placeholders while preserving all layout/design.
 * 
 * The user maintains ONE file (the master CV in plain LaTeX).
 * This module converts it to a Handlebars template at generation time.
 */

// --- Section type classification ---

type SectionType = 'experience' | 'education' | 'skills' | 'languages' | 'certifications' | 'unknown';

const SECTION_KEYWORDS: Record<SectionType, string[]> = {
  experience: ['berufserfahrung', 'work experience', 'professional experience', 'erfahrung', 'experience'],
  education: ['ausbildung', 'education', 'studium', 'akademische'],
  skills: ['kernkompetenzen', 'core competencies', 'skills', 'kenntnisse', 'fähigkeiten', 'competencies'],
  languages: ['sprachen', 'languages'],
  certifications: ['zertifikate', 'certifications', 'certificates', 'weiterbildungen'],
  unknown: [],
};

function classifySection(title: string): SectionType {
  const lower = title.toLowerCase().trim();
  for (const [type, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (type === 'unknown') continue;
    if (keywords.some(kw => lower.includes(kw))) {
      return type as SectionType;
    }
  }
  return 'unknown';
}

// --- Preamble transformation ---

function transformPreamble(preamble: string): string {
  let result = preamble;

  // Replace \usepackage[LANG]{babel} with conditional
  result = result.replace(
    /\\usepackage\[(\w+)\]\{babel\}/,
    '{{#eq metadata.language "de"}}\\usepackage[german]{babel}{{else}}\\usepackage[english]{babel}{{/eq}}'
  );

  // Wrap \babelhyphenation[german]{...} in conditional
  // This is a multiline block — match from \babelhyphenation to its closing }
  result = result.replace(
    /(\\babelhyphenation\[german\]\{[^}]*\})/s,
    '{{#eq metadata.language "de"}}\n$1\n{{/eq}}'
  );

  return result;
}

// --- Header transformation ---

/**
 * Transform the header area (before first \section).
 * - Wraps photo minipage in format conditional
 * - Replaces name, subtitle, contact info with JSON placeholders
 */
function transformHeader(header: string): string {
  let result = header;

  // Step 1: Find and wrap the photo minipage in a conditional.
  // The photo minipage contains \includegraphics. We need to find the
  // \begin{minipage}...\end{minipage} that contains it.
  // Also need to make the text minipage full-width when no photo.
  const photoMinipageRegex = /([ \t]*\\begin\{minipage\}[^\n]*\n(?:[\s\S]*?\\includegraphics[\s\S]*?)\\end\{minipage\})/;
  const photoMatch = result.match(photoMinipageRegex);
  
  if (photoMatch) {
    const photoBlock = photoMatch[1];
    // Replace the photo filename with placeholder
    const photoBlockWithPlaceholder = photoBlock.replace(
      /\\includegraphics\[([^\]]*)\]\{[^}]+\}/,
      '\\includegraphics[$1]{ {{{personal.photo}}} }'
    );
    
    // Show photo whenever personal.photo is provided (both German and International)
    result = result.replace(
      photoBlock,
      `{{#if personal.photo}}\n${photoBlockWithPlaceholder}\n{{/if}}`
    );

    // Make the text minipage width conditional on whether a photo is present
    // When photo is shown: 0.74\textwidth
    // When no photo: full \textwidth
    // Match the line including its leading whitespace and trailing newline
    result = result.replace(
      /([ \t]*)\\begin\{minipage\}\[t\]\{0\.74\\textwidth\}/,
      '$1{{#if personal.photo}}\\begin{minipage}[t]{0.74\\textwidth}{{else}}\\begin{minipage}[t]{\\textwidth}{{/if}}'
    );
  }


  // Step 2: Replace the name (inside \textbf{...} after \huge)
  // Ensure \raggedright is present for left alignment
  // Add space before closing } to prevent Handlebars {{{ from colliding with LaTeX }
  result = result.replace(
    /(\\huge\s*\\headerfont\s*\\textbf\{)[^}]+(})/,
    '$1{{{personal.name}}} $2'
  );

  // Step 3: Replace the subtitle line (inside {\large \headerfont ...} after the name)
  result = result.replace(
    /(\{\\large\s*\\headerfont\s+)[^}]+(})/,
    '$1{{{personal.subtitle}}} $2'
  );

  // Step 4: Replace the contact block.
  // Find the \small block with contact details and replace with JSON placeholders.
  // The block starts with { \small and ends with }
  const contactBlockRegex = /(\{\s*\n?\s*\\small\s*\n)([\s\S]*?)(\n\s*\})/;
  const contactMatch = result.match(contactBlockRegex);
  
  if (contactMatch) {
    const contactPlaceholder = `$1\t\t\t{{{personal.location}}} \\\\[3pt]
\t\t\tTel.: {{{personal.phone}}} \\\\[3pt]
\t\t\t\\href{mailto:{{{personal.email}}}}{{{personal.email}}} \\\\[3pt]
{{#if personal.dateOfBirth}}
\t\t\t{{{personal.dateOfBirth}}} \\\\[3pt]
{{/if}}
{{#if personal.nationality}}
\t\t\t{{{personal.nationality}}}
{{/if}}
$3`;
    result = result.replace(contactBlockRegex, contactPlaceholder);
  }

  return result;
}

// --- Experience section transformation ---

/**
 * Extract the formatting pattern from the first experience entry
 * and create a Handlebars {{#each}} loop.
 */
function transformExperienceSection(content: string): string {
  // Find the first entry to extract its formatting pattern.
  // An entry starts with \noindent and ends before the next \vspace{0.4cm}\n\n\noindent
  // or before end of section.
  
  // Extract the first entry to understand the formatting
  const firstEntryMatch = content.match(
    /\\noindent\{([\s\S]*?)\\end\{itemize\}/
  );
  
  if (!firstEntryMatch) {
    // No recognizable experience entry pattern — return as-is with title replaced
    return `\t\t\\section{ {{{metadata.sectionTitles.experience}}} }\n${content}`;
  }

  // Extract the formatting skeleton from the first entry.
  // We need to identify the LaTeX commands used for each field.
  const entry = firstEntryMatch[0];
  
  // Build the templatized entry by extracting the formatting commands
  // and replacing content with placeholders.
  
  // Line 1: position -- company
  // Pattern: \noindent{FORMAT \textbf{POSITION}} -- {FORMAT COMPANY} ...
  let template = entry;
  
  // Replace position (first \textbf{...} content after \noindent)
  // Note: space after { prevents LaTeX brace from colliding with Handlebars {{{
  template = template.replace(
    /(\\noindent\{[^}]*\\textbf\{)[^}]+(})/,
    '$1 {{{position}}} $2'
  );
  
  // Replace company (content after -- in the same structural block)
  // Pattern: -- {\large \headerfont COMPANY} or -- {\headerfont COMPANY}
  template = template.replace(
    /(--\s*\{[^}]*\\headerfont\s+)[^}]+(})/,
    '$1{{{company}}} $2'
  );
  
  // Replace location (\textit{...})
  // Add space before closing } to prevent brace collision
  template = template.replace(
    /(\\textit\{)\s*[^}]+(})/,
    '$1{{{location}}} $2'
  );
  
  // Replace date range (\color{cvgray} ...)
  // The date content is between \color{cvgray} and the closing }
  template = template.replace(
    /(\\color\{cvgray\}\s*)[^}]+(})/,
    '$1{{{startDate}}} -- {{{endDate}}} $2'
  );
  
  // Replace itemize content with highlights loop
  template = template.replace(
    /\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/,
    `\\begin{itemize}\n{{#each highlights}}\n\t\t\t\\item {{{this}}}\n{{/each}}\n\t\t\\end{itemize}`
  );

  // Ensure the entry starts with proper indentation (two tabs + \noindent)
  template = template.replace(/^(\s*)\\noindent/, '\t\t\\noindent');

  // Build the full section with {{#each}} loop
  return `\t\t\\section{ {{{metadata.sectionTitles.experience}}} }
\t\t
{{#each experience}}
${template}
{{#unless @last}}
\t\t\\vspace{0.4cm}
\t\t
{{/unless}}
{{/each}}`;
}

// --- Education section transformation ---

function transformEducationSection(content: string): string {
  // Education entries: \noindent{\headerfont \large \textbf{DEGREE}} -- {\large \headerfont INSTITUTION} {\color{cvgray} | YEAR}
  // Followed by detail text
  
  const firstEntryMatch = content.match(
    /\\noindent\{[\s\S]*?(?=\\noindent|$)/
  );
  
  if (!firstEntryMatch) {
    return `\t\t\\section{ {{{metadata.sectionTitles.education}}} }\n${content}`;
  }

  let template = firstEntryMatch[0].trim();
  
  // Replace degree (\textbf{...})
  // Note: space after \textbf{ prevents LaTeX brace from colliding with Handlebars {{{
  template = template.replace(
    /(\\textbf\{)[^}]+(})/,
    '$1 {{{degree}}}{{#if field}} -- {{{field}}}{{/if}} $2'
  );
  
  // Replace institution (after -- with \headerfont)
  template = template.replace(
    /(--\s*\{[^}]*\\headerfont\s+)[^}]+(})/,
    '$1{{{institution}}} $2'
  );
  
  // Replace year/date (\color{cvgray} | YEAR or \color{cvgray} DATES)
  template = template.replace(
    /(\\color\{cvgray\}\s*\|?\s*)[^}]+(})/,
    '$1| {{{endDate}}} $2'
  );
  
  // Replace the detail text (everything after the \\ on the first line until end)
  // This is the free-text description line
  const detailLineRegex = /\}\s*\\\\\n([\s\S]*?)(?=\\vspace|$)/;
  const detailMatch = template.match(detailLineRegex);
  if (detailMatch) {
    template = template.replace(
      detailLineRegex,
      '} \\\\\n{{#each details}}{{{this}}}{{/each}}\n'
    );
  }

  return `\t\t\\section{ {{{metadata.sectionTitles.education}}} }
\t\t
{{#each education}}
\t\t${template}
{{#unless @last}}
\t\t\\vspace{0.3cm}
\t\t
{{/unless}}
{{/each}}`;
}

// --- Skills section transformation ---

function transformSkillsSection(content: string): string {
  // Skills section has grouped structure:
  // \begin{flushleft} ... \textbf{GROUP} \\ \begin{itemize} \item ... \end{itemize} ... \end{flushleft}
  
  // Extract the flushleft wrapper and its preamble commands
  const flushMatch = content.match(
    /(\\begin\{flushleft\}\s*\n(?:\s*\\fontsize[^\n]*\n)?(?:\s*\\setlength[^\n]*\n)?(?:\s*\\selectfont\s*\n)?)/
  );
  
  const flushPreamble = flushMatch ? flushMatch[1] : '\t\t\\begin{flushleft}\n';

  // Extract the formatting of a single skill group to use as template
  const groupMatch = content.match(
    /\\textbf\{[^}]+\}\s*\\\\\s*\n\s*\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/
  );

  if (!groupMatch) {
    return `\t\t\\section{ {{{metadata.sectionTitles.skills}}} }\n${content}`;
  }

  // Extract the indentation used
  const indentMatch = content.match(/^(\s*)\\textbf/m);
  const indent = indentMatch ? indentMatch[1] : '\t\t\t';

  return `\t\t\\section{ {{{metadata.sectionTitles.skills}}} }
${flushPreamble}${indent}
{{#each skills.groups}}
${indent}\\textbf{ {{{label}}} } \\\\
${indent}\\begin{itemize}
{{#each items}}
${indent}\t\\item {{{this}}}
{{/each}}
${indent}\\end{itemize}
${indent}
{{#unless @last}}
${indent}\\vspace{0.2cm}
${indent}
{{/unless}}
{{/each}}
\t\t\\end{flushleft}`;
}

// --- Languages section transformation ---

function transformLanguagesSection(content: string): string {
  // Languages: \textbf{LANG} PROFICIENCY \\ pattern inside flushleft
  
  const flushMatch = content.match(
    /(\\begin\{flushleft\}\s*\n(?:\s*\\fontsize[^\n]*\n)?(?:\s*\\setlength[^\n]*\n)?(?:\s*\\selectfont\s*\n)?)/
  );
  
  const flushPreamble = flushMatch ? flushMatch[1] : '\t\t\\begin{flushleft}\n';

  const indentMatch = content.match(/^(\s*)\\textbf/m);
  const indent = indentMatch ? indentMatch[1] : '\t\t\t';

  return `\t\t\\section{ {{{metadata.sectionTitles.languages}}} }
${flushPreamble}{{#each skills.languages}}
${indent}\\textbf{ {{{language}}} } {{{proficiency}}} \\\\
{{/each}}
\t\t\\end{flushleft}`;
}

// --- Certifications section transformation ---

function transformCertificationsSection(_content: string): string {
  return `\t\t\\section{ {{{metadata.sectionTitles.certifications}}} }
\t\t\\begin{itemize}
{{#each certifications}}
\t\t\t\\item {{{name}}} {{#if date}}({{{date}}}){{/if}}
{{/each}}
\t\t\\end{itemize}`;
}

// --- Main parser ---

interface ParsedBlock {
  type: 'raw' | 'header' | 'section';
  content: string;
  sectionType?: SectionType;
  sectionTitle?: string;
}

/**
 * Parse the document body into ordered blocks.
 */
function parseBody(body: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  
  // Find all \section{...} positions
  const sectionRegex = /\\section\{([^}]+)\}/g;
  const sections: { index: number; title: string; fullMatch: string }[] = [];
  let match;
  
  while ((match = sectionRegex.exec(body)) !== null) {
    sections.push({ index: match.index, title: match[1], fullMatch: match[0] });
  }
  
  if (sections.length === 0) {
    return [{ type: 'raw', content: body }];
  }
  
  // Everything before the first section is the header
  const headerContent = body.slice(0, sections[0].index);
  if (headerContent.trim()) {
    blocks.push({ type: 'header', content: headerContent });
  }
  
  // Process each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];
    
    // Content starts after the \section{...} command
    const contentStart = section.index + section.fullMatch.length;
    
    // Content ends at the next section, or at structural markers, or at end
    let contentEnd: number;
    
    if (nextSection) {
      contentEnd = nextSection.index;
    } else {
      contentEnd = body.length;
    }
    
    let sectionContent = body.slice(contentStart, contentEnd);
    
    // Check if there's a structural marker (\switchcolumn, \end{paracol}) in this content
    // If so, split: section content before the marker, raw block for the marker
    const structuralRegex = /([ \t]*\\switchcolumn\s*\n|[ \t]*\\end\{paracol\}\s*\n)/;
    const structMatch = sectionContent.match(structuralRegex);
    
    if (structMatch && structMatch.index !== undefined) {
      const beforeStructural = sectionContent.slice(0, structMatch.index);
      const structuralAndAfter = sectionContent.slice(structMatch.index);
      
      blocks.push({
        type: 'section',
        content: beforeStructural,
        sectionType: classifySection(section.title),
        sectionTitle: section.title,
      });
      
      blocks.push({ type: 'raw', content: structuralAndAfter });
    } else {
      blocks.push({
        type: 'section',
        content: sectionContent,
        sectionType: classifySection(section.title),
        sectionTitle: section.title,
      });
    }
  }
  
  return blocks;
}

// --- Main export ---

/**
 * Derive a Handlebars template from a plain LaTeX master CV.
 * 
 * Preserves all layout/design (preamble, fonts, colors, column structure,
 * entry formatting) while replacing content with Handlebars placeholders.
 */
export function deriveTemplate(masterLatex: string): string {
  // Split at \begin{document}
  const docStartIdx = masterLatex.indexOf('\\begin{document}');
  if (docStartIdx === -1) {
    throw new Error('Master CV must contain \\begin{document}');
  }
  
  const preamble = masterLatex.slice(0, docStartIdx);
  const bodyWithDoc = masterLatex.slice(docStartIdx);
  
  // Transform preamble (babel, hyphenation)
  const transformedPreamble = transformPreamble(preamble);
  
  // Parse body into blocks
  const blocks = parseBody(bodyWithDoc);
  
  // Transform each block
  const transformedBlocks = blocks.map(block => {
    switch (block.type) {
      case 'header':
        return transformHeader(block.content);
      
      case 'section':
        switch (block.sectionType) {
          case 'experience':
            return transformExperienceSection(block.content);
          case 'education':
            return transformEducationSection(block.content);
          case 'skills':
            return transformSkillsSection(block.content);
          case 'languages':
            return transformLanguagesSection(block.content);
          case 'certifications':
            return transformCertificationsSection(block.content);
          default:
            // Unknown section — keep title but preserve content as-is
            return `\t\t\\section{${block.sectionTitle}}\n${block.content}`;
        }
      
      case 'raw':
        return block.content;
      
      default:
        return block.content;
    }
  });
  
  return transformedPreamble + transformedBlocks.join('\n');
}
