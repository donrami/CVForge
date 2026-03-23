import path from 'path';

/**
 * Sanitize a string for use in folder names.
 * Converts to lowercase and replaces non-alphanumeric chars with hyphens.
 */
function sanitize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Returns the canonical generated folder path for an application.
 * Uses application ID combined with company name and job title for human readability.
 * This pattern must match between generate.ts (folder creation) and routes.ts (folder access).
 */
export function getGenDir(app: { id: string; companyName: string; jobTitle: string }): string {
  return path.join(
    process.cwd(),
    'generated',
    `${app.id}-${sanitize(app.companyName)}-${sanitize(app.jobTitle)}`
  );
}
