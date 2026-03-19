import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock the server.ts exports before importing routes
vi.mock('../../server.js', () => ({
  prisma: {},
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('../services/prompts.js', () => ({
  loadAllPrompts: vi.fn(),
  saveAllPrompts: vi.fn(),
  getDefaults: vi.fn(() => ({ generator: '', critique: '', validation: '' })),
  PROMPT_KEYS: ['generator', 'critique', 'validation'],
}));

// Minimal mock for modules used by routes.ts but not relevant to chat tests
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

import { ai } from '../../server.js';
import { loadAllPrompts } from '../services/prompts.js';

// Helper: build a mock Express req/res pair
function mockReqRes(body: any) {
  const req = { body, params: {}, query: {} } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

// We need to get the route handler directly. Import the router and find the handler.
import { apiRouter } from '../routes.js';

// Extract the POST /prompts/chat handler from the router stack
function findHandler(method: string, routePath: string) {
  for (const layer of (apiRouter as any).stack) {
    if (
      layer.route &&
      layer.route.path === routePath &&
      layer.route.methods[method]
    ) {
      // The handlers include the requireAuth middleware + the actual handler
      const handlers = layer.route.stack.map((s: any) => s.handle);
      return handlers;
    }
  }
  return null;
}

const chatHandlers = findHandler('post', '/prompts/chat');
if (!chatHandlers) throw new Error('POST /prompts/chat route not found');

// Run through all middleware (requireAuth is a no-op) then the handler
async function callChatEndpoint(body: any) {
  const { req, res } = mockReqRes(body);
  for (const handler of chatHandlers) {
    await handler(req, res, () => {});
  }
  return res;
}

describe('Feature: prompt-chat-assistant — Backend', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Property 3: Context assembly includes full prompt when explicitly requested ───
  describe('Property 3: Context assembly includes full prompt when explicitly requested', () => {
    it('system instruction contains full prompt when includeFullContext is true', async () => {
      /** Validates: Requirements 3.1 - explicit context injection */
      const gen = 'generator prompt content';

      (loadAllPrompts as any).mockResolvedValue({
        generator: gen,
      });

      let capturedArgs: any = null;
      (ai.models.generateContent as any).mockImplementation((args: any) => {
        capturedArgs = args;
        return { text: 'ok' };
      });

      await callChatEndpoint({
        messages: [{ role: 'user', content: 'hello' }],
        includeFullContext: true,
      });

      // System instruction should contain the generator prompt when full context requested
      const sysInstr: string = capturedArgs.config.systemInstruction;
      expect(sysInstr).toContain(gen);
    });

    it('system instruction contains brief prompt when includeFullContext is false or not provided', async () => {
      /** Validates: Requirements 3.1 - brief prompt by default */
      const briefPrompt = 'CVForge Assistant, a helpful AI that helps users';

      (loadAllPrompts as any).mockResolvedValue({
        generator: 'generator prompt',
        critique: 'critique prompt',
        validation: 'validation prompt',
      });

      let capturedArgs: any = null;
      (ai.models.generateContent as any).mockImplementation((args: any) => {
        capturedArgs = args;
        return { text: 'ok' };
      });

      await callChatEndpoint({
        messages: [{ role: 'user', content: 'hello' }],
      });

      // Should have brief system prompt (not full prompts)
      const sysInstr: string = capturedArgs.config.systemInstruction;
      expect(sysInstr).toContain('CVForge Assistant');
      expect(sysInstr).not.toContain('generator prompt');
    });
  });

  // ─── Property 4: Valid chat request returns a response object ───
  describe('Property 4: Valid chat request returns a response object', () => {
    it('returns 200 with { response: string } for any valid non-empty messages', () => {
      /** Validates: Requirements 5.2 */
      return fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant'),
              content: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          fc.string({ minLength: 0, maxLength: 200 }),
          async (messages, responseText) => {
            (loadAllPrompts as any).mockResolvedValue({
              generator: 'g',
              critique: 'c',
              validation: 'v',
            });
            (ai.models.generateContent as any).mockResolvedValue({
              text: responseText,
            });

            const res = await callChatEndpoint({ messages });

            expect(res.json).toHaveBeenCalledWith({
              response: responseText,
            });
            // Should NOT have called status (200 is default)
            expect(res.status).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 5: Invalid request body returns 400 ───
  describe('Property 5: Invalid request body returns 400', () => {
    it('returns 400 for any request body missing messages or with empty messages array', () => {
      /** Validates: Requirements 5.4 */
      return fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // missing messages entirely
            fc.record({ foo: fc.string() }),
            // messages is not an array
            fc.record({ messages: fc.string() }),
            fc.record({ messages: fc.integer() }),
            fc.record({ messages: fc.boolean() }),
            fc.record({ messages: fc.constant(null) }),
            // empty messages array
            fc.constant({ messages: [] }),
          ),
          async (body) => {
            const res = await callChatEndpoint(body);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ error: expect.any(String) }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Unit Tests ───
  describe('Unit tests', () => {
    it('endpoint exists at POST /api/prompts/chat', () => {
      expect(chatHandlers).not.toBeNull();
      expect(chatHandlers!.length).toBeGreaterThan(0);
    });

    it('uses gemini-3-flash-preview model string', async () => {
      (loadAllPrompts as any).mockResolvedValue({
        generator: 'g',
        critique: 'c',
        validation: 'v',
      });

      let capturedModel = '';
      (ai.models.generateContent as any).mockImplementation((args: any) => {
        capturedModel = args.model;
        return { text: 'ok' };
      });

      await callChatEndpoint({
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(capturedModel).toBe('gemini-3-flash-preview');
    });
  });
});
