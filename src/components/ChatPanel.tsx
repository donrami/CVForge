import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, MessageSquare, Loader2, AlertCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ErrorEntry {
  type: 'error';
  content: string;
}

type DisplayEntry = ChatMessage | ErrorEntry;

export function ChatPanel() {
  // 2.1: Local state for messages, input, loading, and error
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayEntries, setDisplayEntries] = useState<DisplayEntry[]>([]);

  // 2.8: Ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 2.8: Auto-scroll when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayEntries, loading]);

  const isInputEmpty = input.trim().length === 0;

  const handleSend = async () => {
    if (isInputEmpty || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];

    // 2.4: Append user message to state
    setMessages(updatedMessages);
    setDisplayEntries(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/prompts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, includeFullContext: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 2.6: Display error inline on API failure
        const errorMsg = data.error || `Request failed with status ${res.status}`;
        setDisplayEntries(prev => [...prev, { type: 'error', content: errorMsg }]);
      } else {
        // 2.4: Append assistant response
        const assistantMessage: ChatMessage = { role: 'assistant', content: data.response };
        setMessages(prev => [...prev, assistantMessage]);
        setDisplayEntries(prev => [...prev, assistantMessage]);
      }
    } catch {
      // 2.6: Display network error inline
      setDisplayEntries(prev => [
        ...prev,
        { type: 'error', content: 'Connection error. Please try again.' },
      ]);
    } finally {
      // 2.6: Re-enable input and send button
      setLoading(false);
    }
  };

  // 2.4: Send on Enter (without Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 2.7: Clear chat resets message history
  const handleClear = () => {
    setMessages([]);
    setDisplayEntries([]);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="border border-border bg-bg-surface surface-card">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm text-text-primary">
          <MessageSquare size={16} className="text-accent" />
          Prompt Assistant
        </div>
        {displayEntries.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            <Trash2 size={12} />
            Clear chat
          </button>
        )}
      </div>

      {/* 2.2: Scrollable message area */}
      <div className="overflow-y-auto max-h-96 p-4 space-y-3">
        {displayEntries.length === 0 && !loading ? (
          // 2.2: Placeholder when history is empty
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-text-muted mb-3" />
            <p className="text-sm text-text-secondary">
              Ask questions about your prompts or request modifications
            </p>
          </div>
        ) : (
          <>
            {displayEntries.map((entry, i) => {
              if ('type' in entry && entry.type === 'error') {
                // 2.6: Error messages styled inline
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 text-sm"
                  >
                    <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                    <span className="text-destructive">{entry.content}</span>
                  </div>
                );
              }

              const msg = entry as ChatMessage;
              const isUser = msg.role === 'user';

              return (
                <div
                  key={i}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm whitespace-pre-wrap ${
                      isUser
                        ? 'bg-accent/15 text-text-primary'
                        : 'bg-bg-base border border-border text-text-primary'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* 2.5: Loading indicator in message area */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-base border border-border px-3 py-2 flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </>
        )}
        {/* 2.8: Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* 2.3: Input area with send button */}
      <div className="border-t border-border p-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your prompts..."
          rows={1}
          className="flex-1 bg-bg-base border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none inset-surface"
        />
        <button
          onClick={handleSend}
          disabled={isInputEmpty || loading}
          className="flex items-center justify-center w-9 h-9 bg-accent hover:bg-accent-hover text-text-on-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
