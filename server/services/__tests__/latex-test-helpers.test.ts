import { describe, it, expect } from 'vitest';
import {
  extractSection,
  extractJobPositions,
  extractSkillGroups,
  countItems,
  extractSectionOrder,
  extractStructuralElements,
} from './latex-test-helpers';

// ── Realistic LaTeX fixtures mirroring master CV structure ──────

const SAMPLE_LATEX = `
\\columnratio{0.69}
\\begin{paracol}{2}

\\section{Berufserfahrung}

\\noindent{\\headerfont \\large \\textbf{Gründer \\& Entwickler}} -- {\\large \\headerfont GDTLens.com (Eigenprojekt)} \\vspace{2pt} \\\\
{\\small \\textit{Mannheim | KI-gestützte Analyse technischer Zeichnungen}} \\\\ \\vspace{2pt}
{\\color{cvgray} Juli 2025 -- Heute}
\\begin{itemize}
	\\item Konzeption und Entwicklung einer End-to-End ML-Pipeline zur automatisierten Erkennung.
	\\item Full-Stack-Webanwendung entwickelt (TypeScript, React, Node.js).
	\\item Skalierbare Serverinfrastruktur mit FastAPI (Python) und Docker aufgebaut.
\\end{itemize}

\\vspace{0.4cm}

\\noindent{\\headerfont \\large \\textbf{Technical Solutions Expert}} -- {\\large \\headerfont Volume Graphics GmbH (Hexagon)} \\vspace{2pt} \\\\
{\\small \\textit{Heidelberg | Software für industrielle Computertomographie (CT)}} \\\\ \\vspace{2pt}
{\\color{cvgray} März 2020 -- Dezember 2024}
\\begin{itemize}
	\\item First- und Second-Level-Support für internationale Kundenanfragen.
	\\item Entwicklung komplexer Analyse-Workflows in der VG-Software.
\\end{itemize}

\\section{Ausbildung}

\\noindent{\\headerfont \\large \\textbf{M.Sc. Energy Systems}} -- {\\large \\headerfont FH Aachen} {\\color{cvgray} | 2007} \\\\
Masterthesis: \\textit{Limit Load Analysis} -- Note: 1,0.

\\switchcolumn

\\section{Kernkompetenzen}
\\begin{flushleft}

\\textbf{KI, ML \\& LLM-Workflows} \\\\
\\begin{itemize}
	\\item RAG \\& Agentic Workflows
	\\item Vision Language Models (VLMs)
	\\item YOLOv11 / Object Detection
	\\item Prompt Engineering
\\end{itemize}

\\vspace{0.2cm}

\\textbf{Softwareentwicklung} \\\\
\\begin{itemize}
	\\item Python (FastAPI, PyTorch, NumPy)
	\\item TypeScript / JavaScript
	\\item React \\& Node.js
	\\item SQL (PostgreSQL, Drizzle ORM)
	\\item RESTful API Design
\\end{itemize}

\\vspace{0.2cm}

\\textbf{DevOps \\& Infrastruktur} \\\\
\\begin{itemize}
	\\item Docker \\& Container-Orchestrierung
	\\item Redis (Jobqueue, Caching)
	\\item Cloud-Deployment (Linux-Server)
	\\item GitHub Actions (CI/CD-Pipelines)
\\end{itemize}

\\end{flushleft}

\\section{Sprachen}
\\begin{flushleft}
\\textbf{Arabisch} Muttersprache
\\textbf{Deutsch} Verhandlungssicher
\\end{flushleft}

\\section{Zertifikate \\& Weiterbildung}
\\begin{itemize}
	\\item GPS -- Geometrische Produktspezifikation (2021)
	\\item 3DCS Variation Analyst CAA V5 (2019)
	\\item AGG-Grundsätze (2020)
\\end{itemize}

\\section{Programmierung}
\\begin{flushleft}
\\textbf{Fortgeschritten:} Python, TypeScript
\\end{flushleft}

\\end{paracol}
`;

const BABELHYPHENATION_LATEX = `
\\babelhyphenation[german]{
	Qua-li-täts-si-che-rung,
	Soft-ware-ent-wick-lung,
	Feh-ler-mel-dun-gen
}

\\columnratio{0.69}
\\begin{paracol}{2}

\\section{Berufserfahrung}
Some content here.

\\switchcolumn

\\section{Kernkompetenzen}
More content.

\\switchcolumn

\\section{Sprachen}
Languages here.

\\end{paracol}
`;

// ── extractSection ──────────────────────────────────────────────

describe('extractSection', () => {
  it('extracts content between section and next section', () => {
    const content = extractSection(SAMPLE_LATEX, 'Ausbildung');
    expect(content).toContain('M.Sc. Energy Systems');
    expect(content).toContain('Note: 1,0');
  });

  it('extracts content between section and switchcolumn', () => {
    const content = extractSection(SAMPLE_LATEX, 'Ausbildung');
    // Should stop before \switchcolumn
    expect(content).not.toContain('Kernkompetenzen');
  });

  it('extracts Berufserfahrung section with job blocks', () => {
    const content = extractSection(SAMPLE_LATEX, 'Berufserfahrung');
    expect(content).toContain('Gründer');
    expect(content).toContain('Technical Solutions Expert');
    expect(content).toContain('\\begin{itemize}');
  });

  it('extracts Kernkompetenzen section with skill groups', () => {
    const content = extractSection(SAMPLE_LATEX, 'Kernkompetenzen');
    expect(content).toContain('\\textbf{KI, ML');
    expect(content).toContain('\\textbf{Softwareentwicklung}');
  });

  it('returns empty string for missing section', () => {
    expect(extractSection(SAMPLE_LATEX, 'Nonexistent')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(extractSection('', 'Berufserfahrung')).toBe('');
  });

  it('is case-insensitive for section name matching', () => {
    const content = extractSection(SAMPLE_LATEX, 'berufserfahrung');
    expect(content).toContain('Gründer');
  });

  it('extracts last section in document (no following section)', () => {
    const content = extractSection(SAMPLE_LATEX, 'Programmierung');
    expect(content).toContain('Fortgeschritten');
    expect(content).toContain('Python, TypeScript');
  });
});


// ── extractJobPositions ─────────────────────────────────────────

describe('extractJobPositions', () => {
  it('extracts all job positions from Berufserfahrung', () => {
    const positions = extractJobPositions(SAMPLE_LATEX);
    expect(positions).toHaveLength(2);
  });

  it('extracts job headers correctly', () => {
    const positions = extractJobPositions(SAMPLE_LATEX);
    expect(positions[0].header).toContain('Gründer');
    expect(positions[0].header).toContain('GDTLens.com');
    expect(positions[1].header).toContain('Technical Solutions Expert');
    expect(positions[1].header).toContain('Volume Graphics');
  });

  it('extracts bullet items for each position', () => {
    const positions = extractJobPositions(SAMPLE_LATEX);
    expect(positions[0].items).toHaveLength(3);
    expect(positions[1].items).toHaveLength(2);
  });

  it('preserves bullet text content', () => {
    const positions = extractJobPositions(SAMPLE_LATEX);
    expect(positions[0].items[0]).toContain('ML-Pipeline');
    expect(positions[0].items[1]).toContain('TypeScript, React, Node.js');
    expect(positions[0].items[2]).toContain('FastAPI');
  });

  it('returns empty array when Berufserfahrung section is missing', () => {
    const latex = `\\section{Ausbildung}\nSome education content.`;
    expect(extractJobPositions(latex)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(extractJobPositions('')).toEqual([]);
  });

  it('handles a single job position', () => {
    const singleJob = `
\\section{Berufserfahrung}
\\noindent{\\headerfont \\large \\textbf{Developer}} -- {\\large \\headerfont Company} \\\\
{\\color{cvgray} 2020 -- Heute}
\\begin{itemize}
  \\item Built things.
  \\item Fixed things.
\\end{itemize}
\\section{Ausbildung}
`;
    const positions = extractJobPositions(singleJob);
    expect(positions).toHaveLength(1);
    expect(positions[0].items).toHaveLength(2);
  });
});

// ── extractSkillGroups ──────────────────────────────────────────

describe('extractSkillGroups', () => {
  it('extracts all skill groups from Kernkompetenzen', () => {
    const groups = extractSkillGroups(SAMPLE_LATEX);
    expect(groups).toHaveLength(3);
  });

  it('extracts group names correctly', () => {
    const groups = extractSkillGroups(SAMPLE_LATEX);
    expect(groups[0].name).toBe('KI, ML \\& LLM-Workflows');
    expect(groups[1].name).toBe('Softwareentwicklung');
    expect(groups[2].name).toBe('DevOps \\& Infrastruktur');
  });

  it('extracts correct item counts per group', () => {
    const groups = extractSkillGroups(SAMPLE_LATEX);
    expect(groups[0].items).toHaveLength(4);
    expect(groups[1].items).toHaveLength(5);
    expect(groups[2].items).toHaveLength(4);
  });

  it('preserves skill item text', () => {
    const groups = extractSkillGroups(SAMPLE_LATEX);
    expect(groups[0].items).toContain('RAG \\& Agentic Workflows');
    expect(groups[1].items).toContain('TypeScript / JavaScript');
    expect(groups[2].items).toContain('Docker \\& Container-Orchestrierung');
  });

  it('returns empty array when Kernkompetenzen is missing', () => {
    const latex = `\\section{Berufserfahrung}\nSome content.`;
    expect(extractSkillGroups(latex)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(extractSkillGroups('')).toEqual([]);
  });
});

// ── countItems ──────────────────────────────────────────────────

describe('countItems', () => {
  it('counts items in Berufserfahrung section', () => {
    const count = countItems(SAMPLE_LATEX, 'Berufserfahrung');
    // 3 items in first job + 2 items in second job = 5
    expect(count).toBe(5);
  });

  it('counts items in Zertifikate section', () => {
    const count = countItems(SAMPLE_LATEX, 'Zertifikate \\& Weiterbildung');
    expect(count).toBe(3);
  });

  it('counts items in Kernkompetenzen section', () => {
    const count = countItems(SAMPLE_LATEX, 'Kernkompetenzen');
    // 4 + 5 + 4 = 13
    expect(count).toBe(13);
  });

  it('returns 0 for missing section', () => {
    expect(countItems(SAMPLE_LATEX, 'Nonexistent')).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(countItems('', 'Berufserfahrung')).toBe(0);
  });

  it('returns 0 for section with no items', () => {
    expect(countItems(SAMPLE_LATEX, 'Sprachen')).toBe(0);
  });
});


// ── extractSectionOrder ─────────────────────────────────────────

describe('extractSectionOrder', () => {
  it('returns sections in document order', () => {
    const order = extractSectionOrder(SAMPLE_LATEX);
    expect(order).toEqual([
      'Berufserfahrung',
      'Ausbildung',
      'Kernkompetenzen',
      'Sprachen',
      'Zertifikate \\& Weiterbildung',
      'Programmierung',
    ]);
  });

  it('returns empty array for input with no sections', () => {
    expect(extractSectionOrder('Just some text without sections.')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(extractSectionOrder('')).toEqual([]);
  });

  it('handles single section', () => {
    const latex = `\\section{OnlySection}\nContent here.`;
    expect(extractSectionOrder(latex)).toEqual(['OnlySection']);
  });
});

// ── extractStructuralElements ───────────────────────────────────

describe('extractStructuralElements', () => {
  it('extracts columnratio value', () => {
    const elements = extractStructuralElements(SAMPLE_LATEX);
    expect(elements.columnratio).toBe('0.69');
  });

  it('counts switchcolumn commands', () => {
    const elements = extractStructuralElements(SAMPLE_LATEX);
    expect(elements.switchcolumns).toBe(1);
  });

  it('returns null columnratio when missing', () => {
    const latex = `\\section{Test}\nNo column ratio here.`;
    const elements = extractStructuralElements(latex);
    expect(elements.columnratio).toBeNull();
  });

  it('returns 0 switchcolumns when none present', () => {
    const latex = `\\section{Test}\nNo switchcolumn here.`;
    const elements = extractStructuralElements(latex);
    expect(elements.switchcolumns).toBe(0);
  });

  it('extracts babelhyphenation content', () => {
    const elements = extractStructuralElements(BABELHYPHENATION_LATEX);
    expect(elements.babelhyphenation).toContain('Qua-li-täts-si-che-rung');
    expect(elements.babelhyphenation).toContain('Soft-ware-ent-wick-lung');
    expect(elements.babelhyphenation).toContain('Feh-ler-mel-dun-gen');
  });

  it('returns null babelhyphenation when missing', () => {
    const elements = extractStructuralElements(SAMPLE_LATEX);
    expect(elements.babelhyphenation).toBeNull();
  });

  it('counts multiple switchcolumn commands', () => {
    const elements = extractStructuralElements(BABELHYPHENATION_LATEX);
    expect(elements.switchcolumns).toBe(2);
  });

  it('does not count switchcolumn* as switchcolumn', () => {
    const latex = `\\switchcolumn\n\\switchcolumn*\n\\switchcolumn`;
    const elements = extractStructuralElements(latex);
    expect(elements.switchcolumns).toBe(2);
  });
});

// ── Edge cases ──────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty section (section with no content before next section)', () => {
    const latex = `
\\section{Empty}
\\section{Next}
Some content.
`;
    expect(extractSection(latex, 'Empty')).toBe('');
    expect(extractSection(latex, 'Next')).toContain('Some content');
  });

  it('handles nested itemize environments', () => {
    const latex = `
\\section{Berufserfahrung}
\\noindent{\\textbf{Developer}} -- {Company}
\\begin{itemize}
  \\item Outer item one.
  \\item Outer item two with nested list:
  \\begin{itemize}
    \\item Nested item A.
    \\item Nested item B.
  \\end{itemize}
  \\item Outer item three.
\\end{itemize}
\\section{Ausbildung}
`;
    const positions = extractJobPositions(latex);
    expect(positions).toHaveLength(1);
    // The helper splits on \item at the outer level; nested items
    // may be counted or trimmed depending on implementation.
    // At minimum, outer items should be captured.
    expect(positions[0].items.length).toBeGreaterThanOrEqual(3);
  });

  it('handles section with only whitespace content', () => {
    const latex = `
\\section{Whitespace}
   
   
\\section{Next}
Content.
`;
    const content = extractSection(latex, 'Whitespace');
    expect(content).toBe('');
  });

  it('extractJobPositions handles job block without items gracefully', () => {
    const latex = `
\\section{Berufserfahrung}
\\noindent{\\textbf{Title}} -- {Company}
Some text but no itemize.

\\noindent{\\textbf{Other Title}} -- {Other Company}
\\begin{itemize}
  \\item One bullet.
\\end{itemize}
\\section{Ausbildung}
`;
    const positions = extractJobPositions(latex);
    // Only the block with itemize should be returned
    expect(positions).toHaveLength(1);
    expect(positions[0].header).toContain('Other Title');
  });

  it('extractSkillGroups handles textbf without following itemize', () => {
    const latex = `
\\section{Kernkompetenzen}
\\textbf{Orphan Group}
No itemize here.

\\textbf{Valid Group} \\\\
\\begin{itemize}
  \\item Skill A
  \\item Skill B
\\end{itemize}
\\section{Sprachen}
`;
    const groups = extractSkillGroups(latex);
    // Only the group with a proper itemize block should be extracted
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Valid Group');
    expect(groups[0].items).toHaveLength(2);
  });
});
