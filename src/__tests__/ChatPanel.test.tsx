import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { ChatPanel } from '../components/ChatPanel.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Suppress scrollIntoView (jsdom doesn't implement it)
Element.prototype.scrollIntoView = vi.fn();

function mockFetchSuccess(responseText = 'Assistant reply') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ response: responseText }),
  });
}

function mockFetchError(status = 500, error = 'Server error') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error }),
  });
}

function mockFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

function getSendButton() {
  // The send button contains an SVG icon; find the button by its role
  const buttons = screen.getAllByRole('button');
  // Send button is the one that is NOT "Clear chat"
  return buttons.find(
    (b) => !b.textContent?.includes('Clear'),
  )!;
}

function getTextarea() {
  return screen.getByPlaceholderText('Ask about your prompts...');
}

describe('Feature: prompt-chat-assistant — ChatPanel', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Property 1: Sending a message appends it to history ───
  describe('Property 1: Message append on send', () => {
    it('for any non-empty non-whitespace string, sending appends a user message to display', () => {
      /** Validates: Requirements 2.1 */
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (msg) => {
            mockFetchSuccess();
            const { unmount } = render(<ChatPanel />);

            const textarea = getTextarea();
            const sendBtn = getSendButton();

            // Type the message
            await act(async () => {
              fireEvent.change(textarea, { target: { value: msg } });
            });

            // Click send
            await act(async () => {
              fireEvent.click(sendBtn);
            });

            // The trimmed user message should appear in the document
            expect(screen.getByText(msg.trim())).toBeTruthy();

            unmount();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 2: Empty or whitespace input disables send ───
  describe('Property 2: Empty input disables send', () => {
    it('for any whitespace-only string, the send button is disabled', () => {
      /** Validates: Requirements 2.5 */
      return fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 }).map((arr) => arr.join('')),
          (whitespace) => {
            const { unmount } = render(<ChatPanel />);

            const textarea = getTextarea();
            const sendBtn = getSendButton();

            fireEvent.change(textarea, { target: { value: whitespace } });

            expect(sendBtn).toBeDisabled();

            unmount();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 6: Clear resets history ───
  describe('Property 6: Clear resets history', () => {
    it('after sending messages, clicking clear resets to placeholder', async () => {
      /** Validates: Requirements 7.3 */
      // Send a message first
      mockFetchSuccess('Reply 1');
      const { unmount } = render(<ChatPanel />);

      const textarea = getTextarea();
      const sendBtn = getSendButton();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Hello' } });
      });
      await act(async () => {
        fireEvent.click(sendBtn);
      });

      // Wait for assistant reply
      await waitFor(() => {
        expect(screen.getByText('Reply 1')).toBeTruthy();
      });

      // Click clear
      const clearBtn = screen.getByText('Clear chat');
      await act(async () => {
        fireEvent.click(clearBtn);
      });

      // Placeholder should reappear
      expect(
        screen.getByText('Ask questions about your prompts or request modifications'),
      ).toBeTruthy();

      unmount();
    });
  });

  // ─── Unit Tests ───
  describe('Unit tests', () => {
    it('placeholder text appears when message history is empty', () => {
      render(<ChatPanel />);
      expect(
        screen.getByText('Ask questions about your prompts or request modifications'),
      ).toBeTruthy();
    });

    it('Enter key (without Shift) triggers send', async () => {
      mockFetchSuccess();
      render(<ChatPanel />);

      const textarea = getTextarea();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test message' } });
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      });

      // fetch should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText('test message')).toBeTruthy();
    });

    it('loading state disables send button and shows indicator', async () => {
      // Make fetch hang
      let resolveFetch!: (value: any) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      render(<ChatPanel />);
      const textarea = getTextarea();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'hello' } });
      });

      await act(async () => {
        fireEvent.click(getSendButton());
      });

      // Send button should be disabled during loading
      expect(getSendButton()).toBeDisabled();

      // Loading indicator should be visible
      expect(screen.getByText('Thinking...')).toBeTruthy();

      // Resolve the fetch to clean up
      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({ response: 'done' }),
        });
      });
    });

    it('error messages display inline and re-enable controls', async () => {
      mockFetchError(500, 'Something went wrong');
      render(<ChatPanel />);

      const textarea = getTextarea();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'hello' } });
      });

      await act(async () => {
        fireEvent.click(getSendButton());
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
      });

      // Send button should be re-enabled (though input is now empty)
      // Input should be usable
      expect(getTextarea().hasAttribute('disabled')).toBe(false);
    });

    it('network error displays connection error message', async () => {
      mockFetchNetworkError();
      render(<ChatPanel />);

      await act(async () => {
        fireEvent.change(getTextarea(), { target: { value: 'hello' } });
      });

      await act(async () => {
        fireEvent.click(getSendButton());
      });

      await waitFor(() => {
        expect(
          screen.getByText('Connection error. Please try again.'),
        ).toBeTruthy();
      });
    });

    it('navigation reset — initial state has empty history with placeholder', () => {
      // Each fresh render simulates navigating to the page
      render(<ChatPanel />);
      expect(
        screen.getByText('Ask questions about your prompts or request modifications'),
      ).toBeTruthy();
      // No messages should be visible
      expect(screen.queryByText('Thinking...')).toBeNull();
    });
  });
});
