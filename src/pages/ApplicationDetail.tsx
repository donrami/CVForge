import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileText, Download, ArrowLeft, Save, Check } from 'lucide-react';
import { format } from 'date-fns';

interface Application {
  id: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  status: string;
  targetLanguage: string;
  createdAt: string;
  pdfGenerated: boolean;
  notes: string | null;
  generationLog: string;
  latexOutput: string;
  parentId: string | null;
  parent: Application | null;
  regenerations: Application[];
}

const STATUSES = ['GENERATED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'];

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [originalStatus, setOriginalStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [latexSource, setLatexSource] = useState('');
  const [savedLatexSource, setSavedLatexSource] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const isDirty = notes !== originalNotes || status !== originalStatus || latexSource !== savedLatexSource;

  useEffect(() => {
    fetch(`/api/applications/${id}`)
      .then(res => res.json())
      .then(data => {
        setApp(data);
        setNotes(data.notes || '');
        setOriginalNotes(data.notes || '');
        setStatus(data.status);
        setOriginalStatus(data.status);
        setLatexSource(data.latexOutput || '');
        setSavedLatexSource(data.latexOutput || '');
      });
  }, [id]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    
    const handleBeforeNavigate = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeNavigate);
    return () => window.removeEventListener('beforeunload', handleBeforeNavigate);
  }, [isDirty]);

  // Custom navigation with warning
  const handleNavigate = useCallback((to: string) => {
    if (isDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    navigate(to);
  }, [isDirty, navigate]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, status }),
    });
    setTimeout(() => setSaving(false), 1000);
  };

  const handleLatexSave = async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latexOutput: latexSource }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveStatus('error');
        setSaveError(data.error || 'Failed to save');
        return;
      }
      setSavedLatexSource(latexSource);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setSaveError('Network error — could not reach server');
    }
  };

  if (!app) return <div className="p-8 text-text-secondary font-mono text-sm">Loading...</div>;

  let rawLog: any = null;
  let logParseError = false;
  try {
    rawLog = JSON.parse(app.generationLog || '{}');
  } catch {
    logParseError = true;
  }
  const isLegacy = Array.isArray(rawLog);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 text-text-secondary mb-4">
        <Link to="/" className="hover:text-accent transition-colors flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        {app.parentId && (
          <>
            <span className="text-text-muted">·</span>
            <Link to={`/applications/${app.parentId}`} className="hover:text-accent transition-colors text-sm">
              View Parent
            </Link>
          </>
        )}
      </div>

      <div className="flex justify-between items-start border-b border-border pb-4">
        <div>
          <h1 className="text-[2.5rem] font-serif text-text-primary tracking-tight leading-tight">{app.companyName}</h1>
          <p className="text-xl text-text-secondary mt-1">{app.jobTitle}</p>
        </div>
        <div className="flex gap-3 items-center">
          <a
            href={`/api/applications/${app.id}/download/tex`}
            className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary font-mono text-xs uppercase tracking-wider hover:text-text-primary transition-colors"
          >
            <FileText size={16} />
            .tex
          </a>
          <a
            href={`/api/applications/${app.id}/download/pdf`}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-mono text-xs uppercase tracking-wider px-4 py-2 transition-colors"
          >
            <Download size={16} />
            PDF
          </a>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-6 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section className="bg-bg-surface border border-border p-6 space-y-4 surface-card">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Job Description</h2>
            <div className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
              {app.jobDescription}
            </div>
          </section>

          <section className="bg-bg-surface border border-border p-6 space-y-4 surface-card">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Generation Log</h2>
            {logParseError ? (
              <p className="text-sm text-text-muted italic">Log unavailable</p>
            ) : isLegacy ? (
              <div className="space-y-4">
                <span className="inline-block font-mono text-[10px] uppercase tracking-wider bg-bg-elevated text-text-secondary border border-border px-2 py-0.5">Legacy</span>
                {(rawLog as any[]).map((entry: any, i: number) => (
                  <details key={i} className="group border border-border overflow-hidden">
                    <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                      <span>Pass {entry.pass}: {entry.critique?.split('\n')[0]?.substring(0, 60)}...</span>
                      <span className="text-xs text-text-muted">expand</span>
                    </summary>
                    <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                      {entry.critique}
                    </div>
                  </details>
                ))}
              </div>
            ) : rawLog && rawLog.phase1 !== undefined ? (
              <div className="space-y-4">
                {rawLog.model && (
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>Model: <span className="font-mono text-text-secondary">{rawLog.model}</span></span>
                    {rawLog.timestamp && (
                      <span>Generated: <span className="font-mono text-text-secondary">{format(new Date(rawLog.timestamp), 'MMM dd, yyyy HH:mm')}</span></span>
                    )}
                  </div>
                )}
                <details className="group border border-border overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>Phase 1: Analysis</span>
                    <span className="text-xs text-text-muted">expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {rawLog.phase1 || 'No analysis content'}
                  </div>
                </details>
                <details className="group border border-border overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>Phase 2: Review</span>
                    <span className="text-xs text-text-muted">expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {rawLog.phase2 || 'No review content'}
                  </div>
                </details>
              </div>
            ) : rawLog && rawLog.cvData !== undefined ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>Model: <span className="font-mono text-text-secondary">{rawLog.model || 'Unknown'}</span></span>
                  {rawLog.timestamp && (
                    <span>Generated: <span className="font-mono text-text-secondary">{format(new Date(rawLog.timestamp), 'MMM dd, yyyy HH:mm')}</span></span>
                  )}
                  {rawLog.targetLanguage && (
                    <span>Target: <span className="font-mono text-text-secondary">{rawLog.targetLanguage}</span></span>
                  )}
                  {rawLog.detectedLanguage && (
                    <span>Detected: <span className="font-mono text-text-secondary">{rawLog.detectedLanguage}</span></span>
                  )}
                </div>
                <details className="group border border-border overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>CV Data</span>
                    <span className="text-xs text-text-muted">expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(rawLog.cvData, null, 2)}
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-text-muted italic">Log unavailable</p>
            )}
          </section>

          <section className="bg-bg-surface border border-border overflow-hidden surface-card">
            <details className="group">
              <summary className="p-6 cursor-pointer flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                <span className="flex items-center gap-2">
                  <h2 className="font-mono text-[11px] uppercase tracking-wider">LaTeX Source</h2>
                  {isDirty && (
                    <span className="inline-block w-2 h-2 rounded-full bg-accent" title="Unsaved changes" />
                  )}
                </span>
                <span className="text-xs text-text-muted">expand</span>
              </summary>
              <div className="border-t border-border p-6 space-y-4">
                {latexSource ? (
                  <>
                    <textarea
                      value={latexSource}
                      onChange={e => setLatexSource(e.target.value)}
                      rows={20}
                      spellCheck={false}
                      wrap="off"
                      className="w-full bg-bg-base border border-border px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors resize-y font-mono text-sm leading-relaxed inset-surface"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLatexSave}
                        disabled={!isDirty || saveStatus === 'saving'}
                        className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-mono text-xs uppercase tracking-wider px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Save size={14} />
                        {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                      </button>
                      {saveStatus === 'success' && (
                        <span className="text-sm text-success flex items-center gap-1 font-mono">
                          <Check size={14} /> Saved
                        </span>
                      )}
                    </div>
                    {saveStatus === 'error' && saveError && (
                      <p className="text-sm text-destructive">{saveError}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-muted italic">No LaTeX source available</p>
                )}
              </div>
            </details>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-bg-surface border border-border p-6 space-y-4 surface-card">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Status</h2>
            
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-bg-base border border-border px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="space-y-2">
              <label className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">Notes</label>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-bg-base border border-border px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors resize-y text-sm inset-surface"
                placeholder="Interview dates, salary expectations..."
              />
            </div>
          </section>

          <section className="bg-bg-surface border border-border p-6 space-y-4 surface-card">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-secondary">Created</dt>
                <dd className="font-mono text-text-primary">{format(new Date(app.createdAt), 'MMM dd, yyyy')}</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-secondary">Language</dt>
                <dd className="font-mono text-text-primary">{app.targetLanguage}</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-secondary">PDF Generated</dt>
                <dd className="font-mono text-text-primary">{app.pdfGenerated ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {/* Unsaved changes warning dialog */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border p-6 max-w-md w-full">
            <h3 className="text-lg font-serif text-text-primary mb-2">Unsaved Changes</h3>
            <p className="text-sm text-text-secondary mb-4">
              You have unsaved changes. Are you sure you want to leave?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="px-4 py-2 border border-border text-text-secondary font-mono text-xs uppercase tracking-wider hover:bg-bg-elevated transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false);
                  navigate(-1);
                }}
                className="px-4 py-2 bg-destructive text-text-on-accent font-mono text-xs uppercase tracking-wider hover:bg-destructive/90 transition-colors"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
