/**
 * LaTeX parsing test helpers for master CV tailoring tests.
 *
 * These utilities parse generated LaTeX CV output to verify correctness
 * properties. They understand the paracol two-column layout, \section{}
 * commands, \begin{itemize}...\end{itemize} blocks, and \textbf{} skill
 * group names used in the CV template.
 */

export interface JobPosition {
  header: string;
  items: string[];
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export interface StructuralElements {
  columnratio: string | null;
  switchcolumns: number;
  babelhyphenation: string | null;
}

/**
 * Extract the content of a named section from LaTeX source.
 * Returns everything between `\section{sectionName}` and the next
 * `\section{...}` or `\switchcolumn` command (whichever comes first).
 * Returns an empty string if the section is not found.
 */
export function extractSection(latex: string, sectionName: string): string {
  // Escape special regex chars in section name
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionStart = new RegExp(`\\\\section\\{${escaped}\\}`, 'i');
  const match = sectionStart.exec(latex);
  if (!match) return '';

  const startIdx = match.index + match[0].length;
  const rest = latex.slice(startIdx);

  // Find the next \section{...} or \switchcolumn
  const endMatch = /\\section\{|\\switchcolumn/.exec(rest);
  const content = endMatch ? rest.slice(0, endMatch.index) : rest;
  return content.trim();
}

/**
 * Extract all job positions from the Berufserfahrung section.
 * Each position has a header block (title, company, location, dates)
 * and an array of bullet items from its itemize environment.
 */
export function extractJobPositions(latex: string): JobPosition[] {
  const section = extractSection(latex, 'Berufserfahrung');
  if (!section) return [];

  const positions: JobPosition[] = [];

  // Split on \noindent to find each job block (first split element is empty/preamble)
  const blocks = section.split(/\\noindent/);

  for (const block of blocks) {
    // A valid job block must contain an itemize environment
    const itemizeStart = block.indexOf('\\begin{itemize}');
    const itemizeEnd = block.indexOf('\\end{itemize}');
    if (itemizeStart === -1 || itemizeEnd === -1) continue;

    // Header is everything before \begin{itemize}
    const header = block.slice(0, itemizeStart).trim();

    // Items are inside the itemize environment
    const itemizeContent = block.slice(
      itemizeStart + '\\begin{itemize}'.length,
      itemizeEnd,
    );
    const items = extractItemsFromBlock(itemizeContent);

    if (header || items.length > 0) {
      positions.push({ header, items });
    }
  }

  return positions;
}


/**
 * Extract skill groups from the Kernkompetenzen section.
 * Each group is a `\textbf{group name}` followed by a
 * `\begin{itemize}...\end{itemize}` block.
 */
export function extractSkillGroups(latex: string): SkillGroup[] {
  const section = extractSection(latex, 'Kernkompetenzen');
  if (!section) return [];

  const groups: SkillGroup[] = [];

  // Match \textbf{group name} followed (possibly with whitespace/newlines/\\)
  // by \begin{itemize}...\end{itemize}
  const groupPattern =
    /\\textbf\{([^}]+)\}[\s\\]*\n?\s*\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g;

  let match: RegExpExecArray | null;
  while ((match = groupPattern.exec(section)) !== null) {
    const name = match[1].trim();
    const items = extractItemsFromBlock(match[2]);
    groups.push({ name, items });
  }

  return groups;
}

/**
 * Count the number of `\item` entries within a named section.
 */
export function countItems(latex: string, sectionName: string): number {
  const section = extractSection(latex, sectionName);
  if (!section) return 0;

  const itemMatches = section.match(/\\item\b/g);
  return itemMatches ? itemMatches.length : 0;
}

/**
 * Extract the ordered list of section names from the LaTeX source.
 * Returns section names in the order they appear.
 */
export function extractSectionOrder(latex: string): string[] {
  const sectionPattern = /\\section\{([^}]+)\}/g;
  const names: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = sectionPattern.exec(latex)) !== null) {
    names.push(match[1]);
  }

  return names;
}

/**
 * Extract structural LaTeX elements that must be preserved during tailoring:
 * - columnratio: the value inside `\columnratio{...}`
 * - switchcolumns: count of `\switchcolumn` commands
 * - babelhyphenation: the full content of the `\babelhyphenation[...]{...}` block
 */
export function extractStructuralElements(latex: string): StructuralElements {
  // Extract \columnratio{value}
  const columnratioMatch = /\\columnratio\{([^}]+)\}/.exec(latex);
  const columnratio = columnratioMatch ? columnratioMatch[1] : null;

  // Count \switchcolumn occurrences (not \switchcolumn*)
  const switchcolumnMatches = latex.match(/\\switchcolumn(?!\*)/g);
  const switchcolumns = switchcolumnMatches ? switchcolumnMatches.length : 0;

  // Extract \babelhyphenation block — handles multi-line content with nested braces
  const babelhyphenation = extractBabelHyphenation(latex);

  return { columnratio, switchcolumns, babelhyphenation };
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Extract individual \item text entries from the inside of an itemize block.
 */
function extractItemsFromBlock(itemizeContent: string): string[] {
  const items: string[] = [];
  // Split on \item and take everything after each one
  const parts = itemizeContent.split(/\\item\b/);

  for (let i = 1; i < parts.length; i++) {
    // Each part is the text of one item, up to the next \item or end
    const text = parts[i]
      .replace(/\\begin\{itemize\}[\s\S]*$/, '') // remove nested itemize starts
      .replace(/\\end\{itemize\}[\s\S]*$/, '')   // remove itemize ends
      .trim();
    if (text) {
      items.push(text);
    }
  }

  return items;
}

/**
 * Extract the babelhyphenation block content, handling nested braces.
 */
function extractBabelHyphenation(latex: string): string | null {
  const startPattern = /\\babelhyphenation\s*(\[[^\]]*\])?\s*\{/;
  const match = startPattern.exec(latex);
  if (!match) return null;

  // Find the matching closing brace by counting brace depth
  const openIdx = match.index + match[0].length;
  let depth = 1;
  let i = openIdx;
  while (i < latex.length && depth > 0) {
    if (latex[i] === '{') depth++;
    else if (latex[i] === '}') depth--;
    i++;
  }

  if (depth !== 0) return null;

  // Return the content between the braces (excluding the braces themselves)
  return latex.slice(openIdx, i - 1).trim();
}
