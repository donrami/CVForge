import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the server.ts exports before importing routes
vi.mock('../../server.js', () => ({
  prisma: {},
  ai: { models: { generateContent: vi.fn() } },
}));

vi.mock('../services/prompts.js', () => ({
  loadAllPrompts: vi.fn(),
  saveAllPrompts: vi.fn(),
  getDefaults: vi.fn(() => ({ generator: 'default-generator-prompt' })),
  PROMPT_KEYS: ['generator'],
}));

vi.mock('../services/latex-sanitizer.js', () => ({
  assertSafeLatex: vi.fn(),
  escapeLatexSpecialChars: vi.fn((s: string) => s),
}));
vi.mock('../services/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../services/profile-image.js', () => ({
  prepareProfileImage: vi.fn((s: string) => s),
}));
vi.mock('multer', () => {
  const m = () => ({ single: () => (_req: any, _res: any, next: any) => next() });
  m.diskStorage = () => ({});
  return { default: m };
});

import { loadAllPrompts, saveAllPrompts, getDefaults } from '../services/prompts.js';
import { apiRouter } from '../routes.js';

function mockReqRes(body: any = {}, params: any = {}, query: any = {}) {
  const req = { body, params, query } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

function findHandler(method: string, routePath: string) {
  for (const layer of (apiRouter as any).stack) {
    if (layer.route?.path === routePath && layer.route.methods[method]) {
      return layer.route.stack.map((s: any) => s.handle);
    }
  }
  return null;
}

async function callEndpoint(handlers: any[], body: any = {}) {
  const { req, res } = mockReqRes(body);
  for (const handler of handlers) {
    await handler(req, res, () => {});
  }
  return res;
}

const getPromptsHandlers = findHandler('get', '/settings/prompts');
const postPromptsHandlers = findHandler('post', '/settings/prompts');
const getDefaultsHandlers = findHandler('get', '/settings/prompts/defaults');

describe('Prompt API routes — Requirements 3.1, 3.2, 3.3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings/prompts', () => {
    it('returns { generator: string } only', async () => {
      (loadAllPrompts as any).mockResolvedValue({ generator: 'my prompt' });

      const res = await callEndpoint(getPromptsHandlers!, {});

      expect(res.json).toHaveBeenCalledWith({ generator: 'my prompt' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('does not include critique or validation keys', async () => {
      (loadAllPrompts as any).mockResolvedValue({ generator: 'test' });

      const res = await callEndpoint(getPromptsHandlers!, {});

      const result = (res.json as any).mock.calls[0][0];
      expect(Object.keys(result)).toEqual(['generator']);
      expect(result).not.toHaveProperty('critique');
      expect(result).not.toHaveProperty('validation');
    });
  });

  describe('POST /api/settings/prompts', () => {
    it('saves only the generator key', async () => {
      (saveAllPrompts as any).mockResolvedValue(undefined);

      const res = await callEndpoint(postPromptsHandlers!, {
        generator: 'updated prompt',
      });

      expect(saveAllPrompts).toHaveBeenCalledWith({ generator: 'updated prompt' });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('silently ignores critique and validation keys (backward compat)', async () => {
      (saveAllPrompts as any).mockResolvedValue(undefined);

      const res = await callEndpoint(postPromptsHandlers!, {
        generator: 'new prompt',
        critique: 'should be ignored',
        validation: 'should be ignored too',
      });

      // saveAllPrompts should only receive the generator key
      expect(saveAllPrompts).toHaveBeenCalledWith({ generator: 'new prompt' });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('handles payload with only old keys (no generator)', async () => {
      (saveAllPrompts as any).mockResolvedValue(undefined);

      const res = await callEndpoint(postPromptsHandlers!, {
        critique: 'old critique',
        validation: 'old validation',
      });

      // No recognized keys → empty data object saved
      expect(saveAllPrompts).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /api/settings/prompts/defaults', () => {
    it('returns { generator: string }', async () => {
      const res = await callEndpoint(getDefaultsHandlers!, {});

      expect(getDefaults).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ generator: 'default-generator-prompt' });
    });

    it('does not include critique or validation keys', async () => {
      const res = await callEndpoint(getDefaultsHandlers!, {});

      const result = (res.json as any).mock.calls[0][0];
      expect(Object.keys(result)).toEqual(['generator']);
    });
  });
});
