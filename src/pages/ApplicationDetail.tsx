import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileText, Download, ArrowLeft, Save, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDialog } from '../context/DialogContext';

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, toast } = useDialog();
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

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Application',
      message: 'Are you sure you want to delete this application? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      severity: 'destructive',
    });
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast('Application deleted successfully', 'success');
        navigate('/');
      } else {
        toast('Failed to delete application', 'error');
      }
    } catch {
      toast('Failed to delete application', 'error');
    }
  };

  if (!app) return <div className="p-8 text-text-secondary font-mono text-sm">Loading...</div>;

  let rawLog: any = null;
  let logParseError = false;
  let isEmptyLog = false;
  try {
    rawLog = JSON.parse(app.generationLog || '{}');
    // Check if the log is empty (empty object or empty string)
    isEmptyLog = !app.generationLog || app.generationLog === '' || (typeof rawLog === 'object' && Object.keys(rawLog).length === 0);
  } catch {
    logParseError = true;
  }
  const isLegacy = Array.isArray(rawLog);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
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

      <div className="page-header">
        <div>
          <h1 className="page-title">{app.companyName}</h1>
          <p className="page-subtitle text-xl">{app.jobTitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section className="surface-card p-6 space-y-4">
            <h2 className="form-label">Job Description</h2>
            <div className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
              {app.jobDescription}
            </div>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="form-label">Generation Log</h2>
            {logParseError ? (
              <p className="text-sm text-text-muted italic">Log unavailable</p>
            ) : isLegacy ? (
              <div className="space-y-4">
                <span className="inline-block font-mono text-[10px] uppercase tracking-wider bg-bg-elevated text-text-secondary px-2 py-0.5 rounded">Legacy</span>
                {(rawLog as any[]).map((entry: any, i: number) => (
                  <details key={i} className="group border border-border overflow-hidden rounded-lg">
                    <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors rounded-lg">
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
                <details className="group border border-border overflow-hidden rounded-lg">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors rounded-lg">
                    <span>Phase 1: Analysis</span>
                    <span className="text-xs text-text-muted">expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {rawLog.phase1 || 'No analysis content'}
                  </div>
                </details>
                <details className="group border border-border overflow-hidden rounded-lg">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors rounded-lg">
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
                <details className="group border border-border overflow-hidden rounded-lg">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors rounded-lg">
                    <span>CV Data</span>
                    <span className="text-xs text-text-muted">expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(rawLog.cvData, null, 2)}
                  </div>
                </details>
              </div>
            ) : isEmptyLog ? (
              <p className="text-sm text-text-muted italic">No generation log available</p>
            ) : (
              <p className="text-sm text-text-muted italic">Log format not recognized</p>
            )}
          </section>

          <section className="surface-card overflow-hidden">
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
                      className="input-refined min-h-[400px] font-mono text-sm leading-relaxed resize-y"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLatexSave}
                        disabled={!isDirty || saveStatus === 'saving'}
                        className="btn-refined btn-refined-primary"
                      >
                        <Save size={14} />
                        {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                      </button>
                      {saveStatus === 'success' && (
                        <span className="text-sm text-success flex items-center gap-1">
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
          <section className="surface-card p-6 space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Actions</h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <a
                  href={`/api/applications/${app.id}/download/tex`}
                  className="btn-refined btn-refined-secondary flex-1"
                >
                  <FileText size={16} />
                  .tex
                </a>
                <a
                  href={`/api/applications/${app.id}/download/pdf`}
                  className="btn-refined btn-refined-secondary flex-1"
                >
                  <Download size={16} />
                  PDF
                </a>
              </div>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="btn-refined btn-refined-primary w-full"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleDelete}
                className="btn-refined btn-refined-secondary hover:text-destructive w-full"
                title="Delete"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Status</h2>
            
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="input-refined"
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
                className="input-refined resize-y"
                placeholder="Interview dates, salary expectations..."
              />
            </div>
          </section>

          <section className="surface-card p-6 space-y-4">
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
        <div className="dialog-backdrop">
          <div className="dialog-content border-l-4 border-l-warning" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="font-serif text-lg text-text-primary mb-2">Unsaved Changes</h3>
              <p className="text-sm text-text-secondary mb-4">
                You have unsaved changes. Are you sure you want to leave?
              </p>
            </div>
            <div className="px-6 py-4 bg-bg-elevated border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="btn-refined btn-refined-secondary"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false);
                  navigate(-1);
                }}
                className="btn-refined bg-destructive text-text-on-accent hover:bg-destructive/90"
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
