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

  const editorTextareaClass = "input-refined font-mono text-sm whitespace-pre-wrap resize-y leading-relaxed min-h-[300px]";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Context & Settings</h1>
          <p className="page-subtitle">Manage your master CV and generation rules</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-refined btn-refined-primary"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-1 -mb-px">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 ${
              activeSection === tab.key
                ? 'text-text-primary bg-bg-surface border-accent'
                : 'text-text-secondary hover:text-text-primary border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {/* Master CV */}
        <section className={`surface-card p-8 space-y-4${activeSection !== 'master-cv' ? ' hidden' : ''} mt-[-1px] border-t-0 border-b border-border`}>
          <h2 className="form-label">Master CV (LaTeX)</h2>
          <p className="text-sm text-text-secondary">The base LaTeX template and content to draw from.</p>
          <textarea rows={15} value={context['master-cv.tex']} onChange={e => setContext({...context, 'master-cv.tex': e.target.value})} className={editorTextareaClass} spellCheck={false} />
        </section>

        {/* Profile Picture */}
        <section className={`surface-card p-8 space-y-4${activeSection !== 'profile-picture' ? ' hidden' : ''} mt-[-1px] border-t-0 border-b border-border`}>
          <h2 className="form-label">Profile Picture</h2>
          <p className="text-sm text-text-secondary">Upload your profile picture to use in your CV.</p>
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              {profileImage.exists && profileImage.url ? (
                <div className="relative">
                  <img src={profileImage.url} alt="Profile" className="w-32 h-32 object-cover border border-border rounded-lg" />
                  <button onClick={handleProfileImageDelete} className="absolute -top-2 -right-2 bg-bg-elevated border border-border text-text-secondary p-1.5 rounded-full hover:bg-destructive-subtle hover:text-destructive hover:border-destructive transition-colors" title="Delete profile picture">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent-subtle transition-all">
                  {uploadingProfile ? <Loader2 className="animate-spin text-text-secondary" size={24} /> : (
                    <><Upload className="text-text-secondary mb-2" size={24} /><span className="text-xs text-text-secondary">Upload</span></>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingProfile} className="btn-refined btn-refined-secondary">
                <Upload size={16} />
                {uploadingProfile ? 'Uploading...' : 'Choose Image'}
              </button>
              <p className="text-xs text-text-muted">Accepted formats: JPG, PNG, WebP. Maximum size: 5MB.</p>
              {!profileImage.exists && <p className="text-sm text-accent">No profile picture uploaded. A placeholder will be used.</p>}
            </div>
          </div>
        </section>

        {/* Certificates */}
        <section className={`surface-card p-8 space-y-4${activeSection !== 'certificates' ? ' hidden' : ''} mt-[-1px] border-t-0 border-b border-border`} />

        {/* Prompts */}
        <section className={`surface-card p-8 space-y-4${activeSection !== 'prompts' ? ' hidden' : ''} mt-[-1px] border-t-0 border-b border-border`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="form-label">Generation Prompt</h2>
              <p className="text-sm text-text-secondary mt-1">Customize the prompt used for CV generation.</p>
            </div>
            <button onClick={handleSavePrompts} disabled={savingPrompts} className="btn-refined btn-refined-primary">
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
