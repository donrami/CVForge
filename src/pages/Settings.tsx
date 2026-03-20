import { useEffect, useState, useRef } from 'react';
import { Save, Check, Loader2, Upload, FileText, Trash2, CheckCircle, X, RotateCcw } from 'lucide-react';
import { CertificateUpload, type ExtractionResult } from '../components/CertificateUpload';
import { CertificatePreview, type Certificate } from '../components/CertificatePreview';
import { ChatPanel } from '../components/ChatPanel';
import { useDialog } from '../context/DialogContext';

type SettingsTab = 'master-cv' | 'profile-picture' | 'certificates' | 'prompts';

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'master-cv', label: 'Master CV' },
  { key: 'profile-picture', label: 'Profile Picture' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'prompts', label: 'Prompts' },
];

export function Settings() {
  const { confirm, alert, toast } = useDialog();
  const [context, setContext] = useState({
    'master-cv.tex': '',
    'certificates.md': '',
  });
  const [activeSection, setActiveSection] = useState<SettingsTab>('master-cv');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [extractionResults, setExtractionResults] = useState<ExtractionResult[] | null>(null);
  const [savingCertificates, setSavingCertificates] = useState(false);
  const [savedCerts, setSavedCerts] = useState<Certificate[]>([]);
  const [, setLoadingCerts] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [profileImage, setProfileImage] = useState<{ exists: boolean; url?: string; filename?: string }>({ exists: false });
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PROMPT_LABELS: Record<string, string> = { 'generator': 'Generation Prompt' };
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [promptDefaults, setPromptDefaults] = useState<Record<string, string>>({});
  const [savingPrompts, setSavingPrompts] = useState(false);

  useEffect(() => {
    fetch('/api/settings/context')
      .then(res => res.json())
      .then(data => { setContext(data); setLoading(false); });
    loadCertificates();
    fetch('/api/settings/profile-image')
      .then(res => res.json())
      .then(data => setProfileImage(data))
      .catch(() => setProfileImage({ exists: false }));
    Promise.all([
      fetch('/api/settings/prompts').then(r => r.json()),
      fetch('/api/settings/prompts/defaults').then(r => r.json()),
    ]).then(([current, defaults]) => {
      setPrompts(current);
      setPromptDefaults(defaults);
    }).catch(() => {});
  }, []);

  const loadCertificates = async () => {
    try {
      setLoadingCerts(true);
      const res = await fetch('/api/certificates');
      if (res.ok) { const data = await res.json(); setSavedCerts(data.certificates || []); }
    } catch (e) { console.error('Failed to load certificates:', e); }
    finally { setLoadingCerts(false); }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    const formData = new FormData();
    formData.append('profileImage', file);
    try {
      const res = await fetch('/api/settings/profile-image', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setProfileImage({ exists: true, url: data.url, filename: data.filename });
        toast('Profile picture uploaded successfully', 'success');
      } else {
        const error = await res.json();
        toast(error.error || 'Failed to upload profile picture', 'error');
      }
    } catch (e) { console.error('Failed to upload profile picture:', e); toast('Failed to upload profile picture', 'error'); }
    finally { setUploadingProfile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleProfileImageDelete = async () => {
    const confirmed = await confirm({ title: 'Delete Profile Picture', message: 'Are you sure you want to delete your profile picture?', confirmText: 'Delete', cancelText: 'Cancel', severity: 'destructive' });
    if (!confirmed) return;
    try {
      const res = await fetch('/api/settings/profile-image', { method: 'DELETE' });
      if (res.ok) { setProfileImage({ exists: false }); toast('Profile picture deleted', 'success'); }
      else toast('Failed to delete profile picture', 'error');
    } catch (e) { console.error('Failed to delete profile picture:', e); toast('Failed to delete profile picture', 'error'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context) });
      if (response.ok) toast('Settings saved successfully', 'success');
      else toast('Failed to save settings', 'error');
    } catch { toast('Failed to save settings', 'error'); }
    setTimeout(() => setSaving(false), 1000);
  };

  const handleExtracted = (results: ExtractionResult[]) => setExtractionResults(results);

  const handleSaveCertificates = async (certificates: Certificate[]) => {
    setSavingCertificates(true);
    try {
      for (const cert of certificates) {
        const { confidence, id, ...payload } = cert as any;
        await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      await fetch('/api/certificates/sync-to-context', { method: 'POST' });
      const contextRes = await fetch('/api/settings/context');
      if (contextRes.ok) { const data = await contextRes.json(); setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] })); }
      await loadCertificates();
      setExtractionResults(null);
      setActiveTab('manual');
      toast(`${certificates.length} certificate(s) saved successfully`, 'success');
    } catch (e) { console.error('Failed to save certificates:', e); toast('Failed to save certificates', 'error'); }
    finally { setSavingCertificates(false); }
  };

  const handleCancelImport = () => setExtractionResults(null);

  const handleSyncToContext = async () => {
    setSaving(true); setSyncSuccess(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('/api/certificates/sync-to-context', { method: 'POST', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = await response.json();
        await alert({ title: 'Sync Failed', message: error.error || 'Failed to sync certificates.', severity: 'error' });
      } else {
        await response.json();
        const contextRes = await fetch('/api/settings/context');
        if (contextRes.ok) { const data = await contextRes.json(); setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] })); }
        toast('Certificates synced successfully', 'success');
        setSyncSuccess(true); setTimeout(() => setSyncSuccess(false), 3000);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') await alert({ title: 'Sync Timed Out', message: 'The server may be busy. Please try again later.', severity: 'warning' });
      else await alert({ title: 'Sync Failed', message: 'Failed to sync certificates. Check console for details.', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleSavePrompts = async () => {
    setSavingPrompts(true);
    try {
      const res = await fetch('/api/settings/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generator: prompts['generator'] || '' }) });
      if (res.ok) toast('Prompts saved successfully', 'success');
      else toast('Failed to save prompts', 'error');
    } catch { toast('Failed to save prompts', 'error'); }
    finally { setSavingPrompts(false); }
  };

  const handleResetPrompt = async () => {
    const confirmed = await confirm({ title: 'Reset Prompt', message: `Reset "${PROMPT_LABELS['generator']}" to its default? Your customizations will be lost.`, confirmText: 'Reset', cancelText: 'Cancel', severity: 'destructive' });
    if (!confirmed) return;
    setPrompts(prev => ({ ...prev, generator: promptDefaults['generator'] }));
  };

  const handleDeleteCertificate = async (certId: string) => {
    const confirmed = await confirm({ title: 'Delete Certificate', message: 'Are you sure you want to delete this certificate? This action cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', severity: 'destructive' });
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/certificates/${certId}`, { method: 'DELETE' });
      if (response.ok) {
        await loadCertificates();
        const contextRes = await fetch('/api/settings/context');
        if (contextRes.ok) { const data = await contextRes.json(); setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] })); }
        toast('Certificate deleted successfully', 'success');
      } else {
        const error = await response.json();
        await alert({ title: 'Delete Failed', message: error.error || 'Failed to delete certificate.', severity: 'error' });
      }
    } catch (e) { console.error('Failed to delete certificate:', e); await alert({ title: 'Delete Failed', message: 'Failed to delete certificate. Check console for details.', severity: 'error' }); }
  };

  if (loading) return <div className="p-8 text-text-secondary font-mono text-sm">Loading...</div>;

  const editorTextareaClass = "w-full bg-bg-base border border-border p-4 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono text-sm whitespace-pre-wrap resize-y leading-relaxed inset-surface";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end pb-6 border-b border-border">
        <div>
          <h1 className="text-[2.5rem] font-serif text-text-primary tracking-tight leading-tight">Context & Settings</h1>
          <p className="text-text-secondary mt-1">Manage your master CV and generation rules</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-6 py-2.5 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-4 border-b border-border">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`pb-2 text-sm transition-colors ${
              activeSection === tab.key
                ? 'text-text-primary border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {/* Master CV */}
        <section className={`bg-bg-surface border border-border p-8 space-y-4 surface-card${activeSection !== 'master-cv' ? ' hidden' : ''}`}>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Master CV (LaTeX)</h2>
          <p className="text-sm text-text-secondary">The base LaTeX template and content to draw from.</p>
          <textarea rows={15} value={context['master-cv.tex']} onChange={e => setContext({...context, 'master-cv.tex': e.target.value})} className={editorTextareaClass} spellCheck={false} />
        </section>

        {/* Profile Picture */}
        <section className={`bg-bg-surface border border-border p-8 space-y-4 surface-card${activeSection !== 'profile-picture' ? ' hidden' : ''}`}>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Profile Picture</h2>
          <p className="text-sm text-text-secondary">Upload your profile picture to use in your CV.</p>
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              {profileImage.exists && profileImage.url ? (
                <div className="relative">
                  <img src={profileImage.url} alt="Profile" className="w-32 h-32 object-cover border border-border" />
                  <button onClick={handleProfileImageDelete} className="absolute -top-2 -right-2 bg-bg-elevated border border-border text-text-secondary p-1 rounded-full hover:bg-destructive-subtle hover:text-destructive hover:border-destructive transition-colors" title="Delete profile picture">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors">
                  {uploadingProfile ? <Loader2 className="animate-spin text-text-secondary" size={24} /> : (
                    <><Upload className="text-text-secondary mb-2" size={24} /><span className="text-xs text-text-secondary">Upload</span></>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingProfile} className="flex items-center gap-2 text-sm border border-border text-text-primary px-4 py-2 hover:bg-bg-elevated transition-colors disabled:opacity-50">
                <Upload size={16} />
                {uploadingProfile ? 'Uploading...' : 'Choose Image'}
              </button>
              <p className="text-xs text-text-muted">Accepted formats: JPG, PNG, WebP. Maximum size: 5MB.</p>
              {!profileImage.exists && <p className="text-sm text-accent">No profile picture uploaded. A placeholder will be used.</p>}
            </div>
          </div>
        </section>

        {/* Certificates */}
        <section className={`bg-bg-surface border border-border p-8 space-y-4 surface-card${activeSection !== 'certificates' ? ' hidden' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Certificates & Qualifications</h2>
              <p className="text-sm text-text-secondary mt-1">Manage your certificates, courses, and qualifications.</p>
            </div>
            {savedCerts.length > 0 && (
              <button onClick={handleSyncToContext} disabled={saving}
                className={`flex items-center gap-2 text-sm px-4 py-2 border transition-colors disabled:opacity-50 font-mono uppercase tracking-wider ${
                  syncSuccess ? 'border-success text-success' : 'border-border text-text-secondary hover:text-text-primary'
                }`}>
                {syncSuccess ? (<><CheckCircle size={14} /> Synced</>) : saving ? (<><Loader2 size={14} className="animate-spin" /> Syncing</>) : (<><FileText size={14} /> Sync {savedCerts.length} to Context</>)}
              </button>
            )}
          </div>

          <div className="flex gap-4 border-b border-border">
            <button onClick={() => setActiveTab('manual')} className={`pb-2 text-sm transition-colors ${activeTab === 'manual' ? 'text-text-primary border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}>Manual Edit</button>
            <button onClick={() => setActiveTab('import')} className={`pb-2 text-sm transition-colors ${activeTab === 'import' ? 'text-text-primary border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}>Import from PDF</button>
          </div>

          {activeTab === 'manual' ? (
            <div className="space-y-4">
              <textarea rows={10} value={context['certificates.md']} onChange={e => setContext({...context, 'certificates.md': e.target.value})} className={editorTextareaClass} spellCheck={false} />
              {savedCerts.length > 0 && (
                <div className="bg-bg-base border border-border p-4">
                  <h3 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary mb-2">Saved Certificates ({savedCerts.length})</h3>
                  <ul className="space-y-2">
                    {savedCerts.map((cert, i) => (
                      <li key={cert.id || i} className="text-sm text-text-secondary flex items-center justify-between gap-2 group">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check size={14} className="text-success shrink-0" />
                          <span className="truncate">{cert.name} — {cert.issuer}</span>
                        </div>
                        <button onClick={() => cert.id && handleDeleteCertificate(cert.id)} className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-destructive transition-all p-1" title="Delete certificate">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {extractionResults === null ? (
                <div className="space-y-4">
                  <div className="bg-bg-base border border-border p-4">
                    <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-2"><Upload size={16} /> Upload Certificate PDFs</h3>
                    <p className="text-sm text-text-secondary mb-4">Upload PDF files of your certificates. The app will extract the certificate name, issuer, dates, credential ID, and skills using OCR.</p>
                    <CertificateUpload onExtracted={handleExtracted} />
                  </div>
                  {savedCerts.length > 0 && <p className="text-sm text-text-muted text-center">You have {savedCerts.length} certificate{savedCerts.length !== 1 ? 's' : ''} saved.</p>}
                </div>
              ) : (
                <CertificatePreview results={extractionResults} onSave={handleSaveCertificates} onCancel={handleCancelImport} saving={savingCertificates} />
              )}
            </div>
          )}
        </section>

        {/* Prompts */}
        <section className={`bg-bg-surface border border-border p-8 space-y-4 surface-card${activeSection !== 'prompts' ? ' hidden' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Generation Prompt</h2>
              <p className="text-sm text-text-secondary mt-1">Customize the prompt used for CV generation.</p>
            </div>
            <button onClick={handleSavePrompts} disabled={savingPrompts} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-4 py-2.5 transition-colors disabled:opacity-50 text-sm">
              {savingPrompts ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {savingPrompts ? 'Saving...' : 'Save Prompts'}
            </button>
          </div>
          <div className="space-y-2">
            <textarea rows={15} value={prompts['generator'] || ''} onChange={e => setPrompts(prev => ({ ...prev, generator: e.target.value }))} className={editorTextareaClass} spellCheck={false} />
            {promptDefaults['generator'] && prompts['generator'] !== promptDefaults['generator'] && (
              <button type="button" onClick={() => handleResetPrompt()} className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                <RotateCcw size={12} /> Reset to default
              </button>
            )}
          </div>
          <ChatPanel />
        </section>
      </div>
    </div>
  );
}
