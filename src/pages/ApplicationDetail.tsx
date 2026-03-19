import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  parentId: string | null;
  parent: Application | null;
  regenerations: Application[];
}

export function ApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/applications/${id}`)
      .then(res => res.json())
      .then(data => {
        setApp(data);
        setNotes(data.notes || '');
        setStatus(data.status);
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, status }),
    });
    setTimeout(() => setSaving(false), 1000);
  };

  if (!app) return <div className="p-8 text-text-secondary">Loading...</div>;

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
        <Link to="/" className="hover:text-accent transition-colors flex items-center gap-1">
          <ArrowLeft size={16} /> Back to Applications
        </Link>
        {app.parentId && (
          <>
            <span>•</span>
            <Link to={`/applications/${app.parentId}`} className="hover:text-accent transition-colors">
              View Parent
            </Link>
          </>
        )}
      </div>

      <div className="flex justify-between items-start border-b border-border pb-4">
        <div>
          <h1 className="text-4xl font-serif text-text-primary tracking-tight mb-2">{app.companyName}</h1>
          <p className="text-xl text-text-secondary">{app.jobTitle}</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/applications/${app.id}/download/tex`}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-text-secondary hover:bg-bg-elevated transition-colors"
          >
            <FileText size={18} />
            Download .tex
          </a>
          <a
            href={`/api/applications/${app.id}/download/pdf`}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium px-4 py-2 rounded-sm transition-colors"
          >
            <Download size={18} />
            Download PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section className="bg-bg-surface border border-border rounded p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Job Description</h2>
            <div className="prose prose-invert max-w-none text-text-primary text-sm whitespace-pre-wrap">
              {app.jobDescription}
            </div>
          </section>

           <section className="bg-bg-surface border border-border rounded p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Generation Log</h2>
            {logParseError ? (
              <p className="text-sm text-text-muted italic">Log unavailable</p>
            ) : isLegacy ? (
              <div className="space-y-4">
                <span className="inline-block text-xs font-medium bg-bg-elevated text-text-secondary border border-border rounded px-2 py-0.5 uppercase tracking-wider">Legacy</span>
                {(rawLog as any[]).map((entry: any, i: number) => (
                  <details key={i} className="group border border-border rounded-sm overflow-hidden">
                    <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                      <span>Pass {entry.pass}: {entry.critique?.split('\n')[0]?.substring(0, 60)}...</span>
                      <span className="text-xs opacity-50">Click to expand</span>
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
                <details className="group border border-border rounded-sm overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>Phase 1: Analysis</span>
                    <span className="text-xs opacity-50">Click to expand</span>
                  </summary>
                  <div className="p-4 bg-bg-base border-t border-border font-mono text-xs text-text-muted whitespace-pre-wrap overflow-x-auto">
                    {rawLog.phase1 || 'No analysis content'}
                  </div>
                </details>
                <details className="group border border-border rounded-sm overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>Phase 2: Review</span>
                    <span className="text-xs opacity-50">Click to expand</span>
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
                <details className="group border border-border rounded-sm overflow-hidden">
                  <summary className="bg-bg-elevated p-4 cursor-pointer font-mono text-sm flex justify-between items-center text-text-secondary group-hover:text-accent transition-colors">
                    <span>CV Data</span>
                    <span className="text-xs opacity-50">Click to expand</span>
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
        </div>

        <div className="space-y-6">
          <section className="bg-bg-surface border border-border rounded p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Status</h2>
              {saving && <Check size={16} className="text-status-offer" />}
            </div>
            
            <div className="space-y-4">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-sm px-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="GENERATED">Generated</option>
                <option value="APPLIED">Applied</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-bg-base border border-border rounded-sm px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors resize-y font-sans text-sm"
                  placeholder="Interview dates, salary expectations..."
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full flex justify-center items-center gap-2 bg-bg-elevated hover:bg-border text-text-primary font-medium px-4 py-2 rounded-sm transition-colors border border-border"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </section>

          <section className="bg-bg-surface border border-border rounded p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Details</h2>
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
    </div>
  );
}
