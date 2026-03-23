import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { useDialog } from '../context/DialogContext';
import { useJobStatus, JobPhase } from '../hooks/useJobStatus';
import { persistJobId, clearPersistedJobId, getPersistedJobId } from '../hooks/useActiveJobChecker';

type GenerationPhase = 'preparing' | 'ai-working' | 'finalizing';

function ElapsedTimer({ startTime }: { startTime: Date }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setSeconds(elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return <span className="font-mono text-xs text-text-muted tabular-nums">{m}:{s.toString().padStart(2, '0')}</span>;
}

// Extracted status icon component for clarity and reusability
function StatusIcon({ status }: { status: 'idle' | 'started' | 'polling' | 'complete' | 'error' }) {
  const isProcessing = status === 'started' || status === 'polling';
  
  if (isProcessing) {
    return <Loader2 className="animate-spin text-accent" size={20} />;
  }
  
  // Handle unexpected states gracefully - default to spinner for safety
  return <Loader2 className="animate-spin text-accent" size={20} />;
}

interface DuplicateMatch {
  id: string;
  companyName: string;
  jobTitle: string;
  similarity: number;
}

interface DuplicateWarning {
  hasDuplicate: boolean;
  matches: DuplicateMatch[];
}

export function NewApplication() {
  const navigate = useNavigate();
  const { toast } = useDialog();
  const [loadingLast, setLoadingLast] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    targetLanguage: 'EN',
    additionalContext: '',
  });

  // Generation state managed by the hook
  const [generationState, setGenerationState] = useState<{
    status: 'idle' | 'started' | 'polling' | 'complete' | 'error';
    jobId: string | null;
    phase: GenerationPhase;
    aiChars: number;
    error: string | null;
    applicationId: string | null;
    startTime: Date | null;
  }>({
    status: 'idle',
    jobId: null,
    phase: 'preparing',
    aiChars: 0,
    error: null,
    applicationId: null,
    startTime: null,
  });

  const handleJobComplete = useCallback((applicationId: string, companyName?: string, _jobTitle?: string) => {
    clearPersistedJobId(); // Clear persisted job ID on completion
    const company = companyName || formData.companyName;
    toast(`CV for ${company} is ready!`, 'success');
    setGenerationState(prev => ({
      ...prev,
      status: 'complete',
      applicationId,
    }));
    // Navigate after a short delay so user sees the completion state
    setTimeout(() => {
      navigate(`/?highlighted=${applicationId}`);
    }, 1500);
  }, [navigate, toast, formData.companyName]);

  const handleJobError = useCallback((error: string) => {
    toast(`Generation failed: ${error}`, 'error');
    setGenerationState(prev => ({
      ...prev,
      status: 'error',
      error,
    }));
  }, [toast]);

  const handleJobProgress = useCallback((phase: JobPhase, aiChars: number) => {
    setGenerationState(prev => ({
      ...prev,
      phase: (phase || 'preparing') as GenerationPhase,
      aiChars,
    }));
  }, []);

  const { startPolling, stopPolling } = useJobStatus({
    onComplete: handleJobComplete,
    onError: handleJobError,
    onProgress: handleJobProgress,
  });

  // Check for persisted job ID on mount - resume polling if found
  useEffect(() => {
    const persistedJobId = getPersistedJobId();
    if (persistedJobId && generationState.status === 'idle') {
      setGenerationState(prev => ({
        ...prev,
        status: 'polling',
        jobId: persistedJobId,
        startTime: new Date(),
      }));
      startPolling(persistedJobId);
    }
  }, [generationState.status, startPolling]);

  // Helper function to start generation with current formData
  const startGeneration = useCallback(async (data: typeof formData) => {
    setGenerationState({
      status: 'started',
      jobId: null,
      phase: 'preparing',
      aiChars: 0,
      error: null,
      applicationId: null,
      startTime: new Date(),
    });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to start generation');
      }

      const responseData = await response.json();
      const jobId = responseData.jobId;

      setGenerationState(prev => ({
        ...prev,
        status: 'polling',
        jobId,
      }));

      persistJobId(jobId);

      // Start polling for job status
      startPolling(jobId);

    } catch (err: any) {
      handleJobError(err.message);
    }
  }, [startPolling, handleJobError]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates first
    if (formData.jobDescription.trim().length > 20) {
      setIsCheckingDuplicate(true);
      try {
        const res = await fetch('/api/applications/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: formData.jobDescription,
            companyName: formData.companyName,
            jobTitle: formData.jobTitle,
          }),
        });
        const data = await res.json();
        
        if (data.hasDuplicate) {
          setDuplicateWarning(data);
          setShowDuplicateDialog(true);
          setIsCheckingDuplicate(false);
          return; // Don't proceed - wait for user confirmation
        }
      } catch {
        // Silently fail - duplicate check is non-critical, proceed with generation
      }
      setIsCheckingDuplicate(false);
    }
    
    // No duplicates or check failed - proceed with generation
    startGeneration(formData);
  }, [formData, startGeneration]);

  const handleDuplicateConfirm = useCallback(() => {
    setShowDuplicateDialog(false);
    setDuplicateWarning(null);
    // Proceed with generation after user confirms
    startGeneration(formData);
  }, [formData, startGeneration]);

  const handleDuplicateCancel = useCallback(() => {
    setShowDuplicateDialog(false);
    setDuplicateWarning(null);
    // Don't proceed - user cancelled
  }, []);

  const handleCancel = useCallback(() => {
    stopPolling();
    clearPersistedJobId(); // Clear persisted job ID
    setGenerationState({
      status: 'idle',
      jobId: null,
      phase: 'preparing',
      aiChars: 0,
      error: null,
      applicationId: null,
      startTime: null,
    });
  }, [stopPolling]);

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

  const labelClass = "block font-mono text-[11px] uppercase tracking-wider text-text-secondary mb-2";
  const inputClass = "w-full bg-bg-base border border-border px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors inset-surface";

  const isGenerating = generationState.status === 'started' || generationState.status === 'polling';
  const isComplete = generationState.status === 'complete';
  const hasError = generationState.status === 'error';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="pb-6 border-b border-border">
        <h1 className="text-[2.5rem] font-serif text-text-primary tracking-tight leading-tight">New Application</h1>
        <p className="text-text-secondary mt-1">Generate a tailored CV for a specific job description</p>
      </div>

      {isGenerating && !isComplete && !hasError && (
        <div className="bg-bg-surface border border-border overflow-hidden surface-card">
          <div className="px-8 pt-8 pb-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <StatusIcon status={generationState.status} />
                <span className="font-serif text-xl text-text-primary">
                  {generationState.status === 'started' && 'Starting...'}
                  {generationState.status === 'polling' && generationState.phase === 'preparing' && 'Preparing...'}
                  {generationState.status === 'polling' && generationState.phase === 'ai-working' && 'Forging CV'}
                  {generationState.status === 'polling' && generationState.phase === 'finalizing' && 'Wrapping up...'}
                </span>
              </div>
              {generationState.startTime && <ElapsedTimer startTime={generationState.startTime} />}
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="font-mono text-xs bg-bg-elevated px-2 py-1 rounded">
                Job: {generationState.jobId?.slice(0, 8)}...
              </span>              
            </div>

            {generationState.status === 'started' && (
              <div className="py-4 animate-pulse">
                <p className="text-sm text-text-secondary">Creating generation job...</p>
              </div>
            )}

            {generationState.status === 'polling' && generationState.phase === 'preparing' && (
              <div className="py-4 animate-pulse">
                <p className="text-sm text-text-secondary">Assembling your profile and job context...</p>
              </div>
            )}

            {generationState.status === 'polling' && generationState.phase === 'ai-working' && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-text-secondary font-mono">
                    {generationState.aiChars === 0 ? 'Analyzing requirements' : 'Generating LaTeX'}<span className="animate-dots" />
                  </span>
                  <span className="text-xs text-text-muted font-mono tabular-nums">
                    {(generationState.aiChars / 1000).toFixed(1)}k chars
                  </span>
                </div>
                <div className="h-1 bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-700 ease-out"
                    style={{ width: `${Math.min((generationState.aiChars / 8000) * 100, 95)}%` }}
                  />
                </div>
              </div>
            )}

            {generationState.status === 'polling' && generationState.phase === 'finalizing' && (
              <div className="py-4">
                <p className="text-sm text-text-secondary">Compiling LaTeX and saving your application...</p>
                <div className="mt-3 h-1 bg-bg-elevated overflow-hidden max-w-sm">
                  <div className="h-full bg-accent animate-[grow_2s_ease-out_forwards]" />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-text-muted hover:text-text-secondary font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isComplete && !hasError && (
        <div className="bg-bg-surface border border-status-offer overflow-hidden surface-card">
          <div className="px-8 pt-8 pb-6 space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-status-offer" size={24} />
              <span className="font-serif text-xl text-text-primary">CV Generated Successfully!</span>
            </div>
            <p className="text-sm text-text-secondary">
              Your CV is ready. Redirecting to dashboard...
            </p>
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          </div>
        </div>
      )}

      {hasError && !isGenerating && (
        <div className="bg-bg-surface border border-destructive overflow-hidden surface-card">
          <div className="px-8 pt-8 pb-6 space-y-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-destructive" size={24} />
              <span className="font-serif text-xl text-text-primary">Generation Failed</span>
            </div>
            <p className="text-sm text-text-secondary">
              {generationState.error || 'An unexpected error occurred'}
            </p>
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-6 py-2.5 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {!isGenerating && !isComplete && (
        <form onSubmit={handleSubmit} className="space-y-6 bg-bg-surface border border-border p-8 surface-card">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Company Name</label>
              <input 
                required
                type="text" 
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Job Title</label>
              <input 
                required
                type="text" 
                value={formData.jobTitle}
                onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Job Description</label>
            <textarea 
              required
              rows={8}
              value={formData.jobDescription}
              onChange={e => setFormData({...formData, jobDescription: e.target.value})}
              className={`${inputClass} min-h-[200px] resize-y font-mono text-sm`}
              placeholder="Paste the full job description here..."
            />
          </div>

          <div>
            <label className={labelClass}>Target Language</label>
            <div className="flex gap-0">
              {['EN', 'DE'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setFormData({...formData, targetLanguage: lang})}
                  className={`px-4 py-2 font-mono text-sm border transition-colors ${
                    formData.targetLanguage === lang
                      ? 'bg-accent text-text-on-accent border-accent'
                      : 'bg-transparent text-text-secondary border-border hover:text-text-primary'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Additional Context (Optional)</label>
            <textarea 
              rows={3}
              value={formData.additionalContext}
              onChange={e => setFormData({...formData, additionalContext: e.target.value})}
              className={`${inputClass} resize-y`}
              placeholder="E.g., Emphasize my React experience, ignore my early PHP roles."
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={handleLoadLast}
              disabled={loadingLast}
              className="flex items-center gap-2 px-5 py-2.5 border border-border text-text-secondary font-mono text-xs uppercase tracking-wider hover:text-text-primary transition-colors disabled:opacity-40"
            >
              {loadingLast ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
              Load Last
            </button>
            <button 
              type="submit"
              disabled={isCheckingDuplicate}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-6 py-2.5 transition-colors disabled:opacity-60"
            >
              {isCheckingDuplicate ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Checking...
                </>
              ) : (
                <>
                  Generate CV
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Duplicate Confirmation Dialog */}
      {showDuplicateDialog && duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-bg-surface border border-border shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <span className="text-yellow-500 text-xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-text-primary mb-2">
                    Potential Duplicate Detected
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    This job description is similar to existing applications. Do you want to generate a new CV anyway?
                  </p>
                  
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                    <ul className="space-y-2">
                      {duplicateWarning.matches.slice(0, 3).map((match) => (
                        <li key={match.id} className="text-xs">
                          • <span className="font-medium text-text-primary">{match.companyName}</span> - {match.jobTitle}{' '}
                          <span className="text-text-muted">(~{Math.round(match.similarity * 100)}% match)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-bg-elevated/50 border-t border-border flex justify-end gap-3">
              <button
                onClick={handleDuplicateCancel}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateConfirm}
                className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-on-accent transition-colors"
              >
                Generate Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
