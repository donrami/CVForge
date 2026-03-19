import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { useDialog } from '../context/DialogContext';

type Phase = 'preparing' | 'ai-working' | 'finalizing';

function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return <span className="font-mono text-xs text-text-muted tabular-nums">{m}:{s.toString().padStart(2, '0')}</span>;
}

export function NewApplication() {
  const navigate = useNavigate();
  const { toast } = useDialog();
  const [loading, setLoading] = useState(false);
  const [loadingLast, setLoadingLast] = useState(false);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [aiChars, setAiChars] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    targetLanguage: 'EN',
    additionalContext: '',
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPhase('preparing');
    setAiChars(0);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'step') {
              if (data.message.includes('Analyzing') || data.message.includes('crafting')) {
                setPhase('ai-working');
              } else if (data.message.includes('Compiling') || data.message.includes('saving')) {
                setPhase('finalizing');
              }
            } else if (data.type === 'ai-progress') {
              setAiChars(data.chars);
            } else if (data.type === 'warning') {
              toast(data.message, 'error');
            } else if (data.type === 'complete') {
              toast('CV generated successfully!', 'success');
              navigate(`/?highlighted=${data.applicationId}`);
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [formData, navigate, toast]);

  const handleLoadLast = async () => {
    setLoadingLast(true);
    try {
      const res = await fetch('/api/applications?take=1');
      const data = await res.json();
      const last = data.applications?.[0];
      if (!last) {
        toast('No previous applications found.', 'error');
        return;
      }
      setFormData({
        companyName: last.companyName || '',
        jobTitle: last.jobTitle || '',
        jobDescription: last.jobDescription || '',
        targetLanguage: last.targetLanguage || 'EN',
        additionalContext: last.additionalContext || '',
      });
      toast('Loaded inputs from last application.', 'success');
    } catch {
      toast('Failed to load last application.', 'error');
    } finally {
      setLoadingLast(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-text-primary tracking-tight mb-2">New Application</h1>
        <p className="text-text-secondary">Generate a tailored CV for a specific job description.</p>
      </div>

      {loading ? (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-accent" size={20} />
                <span className="font-serif text-xl text-text-primary">
                  {phase === 'preparing' && 'Preparing...'}
                  {phase === 'ai-working' && 'AI is crafting your CV'}
                  {phase === 'finalizing' && 'Wrapping up...'}
                </span>
              </div>
              <ElapsedTimer />
            </div>

            {/* Preparing phase */}
            {phase === 'preparing' && (
              <div className="py-4 animate-pulse">
                <p className="text-sm text-text-secondary">Assembling your profile and job context...</p>
              </div>
            )}

            {/* AI working phase — the main event */}
            {phase === 'ai-working' && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-text-secondary font-mono">Generating LaTeX...</span>
                  <span className="text-xs text-text-muted font-mono tabular-nums">
                    {(aiChars / 1000).toFixed(1)}k chars
                  </span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min((aiChars / 8000) * 100, 95)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Finalizing phase */}
            {phase === 'finalizing' && (
              <div className="py-4">
                <p className="text-sm text-text-secondary">Compiling LaTeX and saving your application...</p>
                <div className="mt-3 h-1.5 bg-bg-elevated rounded-full overflow-hidden max-w-sm">
                  <div className="h-full bg-accent rounded-full animate-[grow_2s_ease-out_forwards]" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 bg-bg-surface border border-border rounded p-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider">Company Name</label>
              <input 
                required
                type="text" 
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                className="w-full bg-bg-base border border-border rounded-sm px-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider">Job Title</label>
              <input 
                required
                type="text" 
                value={formData.jobTitle}
                onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                className="w-full bg-bg-base border border-border rounded-sm px-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider">Job Description</label>
            <textarea 
              required
              rows={8}
              value={formData.jobDescription}
              onChange={e => setFormData({...formData, jobDescription: e.target.value})}
              className="w-full bg-bg-base border border-border rounded-sm px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors resize-y font-sans"
              placeholder="Paste the full job description here..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider">Target Language</label>
            <select
              value={formData.targetLanguage}
              onChange={e => setFormData({...formData, targetLanguage: e.target.value})}
              className="w-full h-[42px] bg-bg-base border border-border rounded-sm px-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="EN">English (EN)</option>
              <option value="DE">German (DE)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider">Additional Context (Optional)</label>
            <textarea 
              rows={3}
              value={formData.additionalContext}
              onChange={e => setFormData({...formData, additionalContext: e.target.value})}
              className="w-full bg-bg-base border border-border rounded-sm px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors resize-y font-sans"
              placeholder="E.g., Emphasize my React experience, ignore my early PHP roles."
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={handleLoadLast}
              disabled={loadingLast}
              className="flex items-center gap-2 bg-[#6a8a9a] hover:bg-[#7a9aaa] text-bg-base font-medium px-5 py-2.5 rounded transition-colors disabled:opacity-50"
            >
              {loadingLast ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
              Load Last
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium px-6 py-2.5 rounded transition-colors"
            >
              Generate CV
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
