import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'context', 'prompts');

export const PROMPT_KEYS = ['generator', 'critique', 'validation'] as const;
export type PromptKey = typeof PROMPT_KEYS[number];

const PROMPT_LABELS: Record<PromptKey, string> = {
  'generator': 'Generator',
  'critique': 'Critique',
  'validation': 'Validation',
};

export function getPromptLabel(key: PromptKey): string {
  return PROMPT_LABELS[key];
}

const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  'generator': '',
  'critique': '',
  'validation': '',
};

export function setDefaults(defaults: Record<PromptKey, string>) {
  for (const key of PROMPT_KEYS) {
    if (defaults[key]) DEFAULT_PROMPTS[key] = defaults[key];
  }
}

function filePath(key: PromptKey): string {
  return path.join(PROMPTS_DIR, `${key}.md`);
}

export async function loadPrompt(key: PromptKey): Promise<string> {
  try {
    return await fs.readFile(filePath(key), 'utf-8');
  } catch {
    return DEFAULT_PROMPTS[key];
  }
}

export async function loadAllPrompts(): Promise<Record<PromptKey, string>> {
  const entries = await Promise.all(
    PROMPT_KEYS.map(async (key) => [key, await loadPrompt(key)] as const)
  );
  return Object.fromEntries(entries) as Record<PromptKey, string>;
}

export async function savePrompt(key: PromptKey, content: string): Promise<void> {
  await fs.mkdir(PROMPTS_DIR, { recursive: true });
  await fs.writeFile(filePath(key), content);
}

export async function saveAllPrompts(prompts: Partial<Record<PromptKey, string>>): Promise<void> {
  await fs.mkdir(PROMPTS_DIR, { recursive: true });
  for (const key of PROMPT_KEYS) {
    if (prompts[key] !== undefined) {
      await fs.writeFile(filePath(key), prompts[key]!);
    }
  }
}

export function getDefaults(): Record<PromptKey, string> {
  return { ...DEFAULT_PROMPTS };
}
