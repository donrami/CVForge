import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'context', 'prompts');

export const PROMPT_KEYS = ['generator'] as const;
export type PromptKey = 'generator';

const PROMPT_LABELS: Record<PromptKey, string> = {
  'generator': 'Generator',
};

export function getPromptLabel(key: PromptKey): string {
  return PROMPT_LABELS[key];
}

const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  'generator': '',
};

export function setDefaults(defaults: { generator: string }) {
  if (defaults.generator) DEFAULT_PROMPTS['generator'] = defaults.generator;
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

export async function loadAllPrompts(): Promise<{ generator: string }> {
  const generator = await loadPrompt('generator');
  return { generator };
}

export async function savePrompt(key: PromptKey, content: string): Promise<void> {
  await fs.mkdir(PROMPTS_DIR, { recursive: true });
  await fs.writeFile(filePath(key), content);
}

export async function saveAllPrompts(prompts: Partial<{ generator: string }>): Promise<void> {
  await fs.mkdir(PROMPTS_DIR, { recursive: true });
  if (prompts.generator !== undefined) {
    await fs.writeFile(filePath('generator'), prompts.generator);
  }
}

export function getDefaults(): { generator: string } {
  return { generator: DEFAULT_PROMPTS['generator'] };
}
