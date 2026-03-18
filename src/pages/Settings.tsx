import { useEffect, useState, useRef } from 'react';
import { Save, Check, Loader2, Upload, Award, FileText, Trash2, CheckCircle, User, X } from 'lucide-react';
import { CertificateUpload, type ExtractionResult } from '../components/CertificateUpload';
import { CertificatePreview, type Certificate } from '../components/CertificatePreview';
import { useDialog } from '../context/DialogContext';

export function Settings() {
  const { confirm, alert, toast } = useDialog();
  const [context, setContext] = useState({
    'master-cv.tex': '',
    'certificates.md': '',
    'instructions.md': '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Certificate import state
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [extractionResults, setExtractionResults] = useState<ExtractionResult[] | null>(null);
  const [savingCertificates, setSavingCertificates] = useState(false);
  const [savedCerts, setSavedCerts] = useState<Certificate[]>([]);
  const [, setLoadingCerts] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Profile image state
  const [profileImage, setProfileImage] = useState<{ exists: boolean; url?: string; filename?: string }>({ exists: false });
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings/context')
      .then(res => res.json())
      .then(data => {
        setContext(data);
        setLoading(false);
      });
    
    // Load saved certificates
    loadCertificates();
    
    // Load profile image
    fetch('/api/settings/profile-image')
      .then(res => res.json())
      .then(data => {
        setProfileImage(data);
      })
      .catch(() => {
        setProfileImage({ exists: false });
      });
  }, []);

  const loadCertificates = async () => {
    try {
      setLoadingCerts(true);
      const res = await fetch('/api/certificates');
      if (res.ok) {
        const data = await res.json();
        setSavedCerts(data.certificates || []);
      }
    } catch (e) {
      console.error('Failed to load certificates:', e);
    } finally {
      setLoadingCerts(false);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingProfile(true);
    const formData = new FormData();
    formData.append('profileImage', file);
    
    try {
      const res = await fetch('/api/settings/profile-image', {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfileImage({ exists: true, url: data.url, filename: data.filename });
        toast('Profile picture uploaded successfully', 'success');
      } else {
        const error = await res.json();
        toast(error.error || 'Failed to upload profile picture', 'error');
      }
    } catch (e) {
      console.error('Failed to upload profile picture:', e);
      toast('Failed to upload profile picture', 'error');
    } finally {
      setUploadingProfile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProfileImageDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Profile Picture',
      message: 'Are you sure you want to delete your profile picture?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      severity: 'destructive',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await fetch('/api/settings/profile-image', {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setProfileImage({ exists: false });
        toast('Profile picture deleted', 'success');
      } else {
        toast('Failed to delete profile picture', 'error');
      }
    } catch (e) {
      console.error('Failed to delete profile picture:', e);
      toast('Failed to delete profile picture', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      
      if (response.ok) {
        toast('Settings saved successfully', 'success');
      } else {
        toast('Failed to save settings', 'error');
      }
    } catch {
      toast('Failed to save settings', 'error');
    }
    setTimeout(() => setSaving(false), 1000);
  };

  const handleExtracted = (results: ExtractionResult[]) => {
    setExtractionResults(results);
  };

  const handleSaveCertificates = async (certificates: Certificate[]) => {
    setSavingCertificates(true);
    try {
      // Save each certificate
      for (const cert of certificates) {
        await fetch('/api/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cert),
        });
      }

      // Sync to context file
      await fetch('/api/certificates/sync-to-context', {
        method: 'POST',
      });

      // Refresh the certificates context text
      const contextRes = await fetch('/api/settings/context');
      if (contextRes.ok) {
        const data = await contextRes.json();
        setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] }));
      }

      // Refresh saved certificates list
      await loadCertificates();

      // Reset extraction results
      setExtractionResults(null);
      setActiveTab('manual');
      
      toast(`${certificates.length} certificate(s) saved successfully`, 'success');
    } catch (e) {
      console.error('Failed to save certificates:', e);
      toast('Failed to save certificates', 'error');
    } finally {
      setSavingCertificates(false);
    }
  };

  const handleCancelImport = () => {
    setExtractionResults(null);
  };

  const handleSyncToContext = async () => {
    console.log('[Frontend] Starting sync to context...');
    setSaving(true);
    setSyncSuccess(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/certificates/sync-to-context', {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Sync failed:', error);
        await alert({
          title: 'Sync Failed',
          message: error.error || 'Failed to sync certificates.',
          severity: 'error',
        });
      } else {
        const result = await response.json();
        console.log('Sync successful:', result);
        
        // Refresh the context
        const contextRes = await fetch('/api/settings/context');
        if (contextRes.ok) {
          const data = await contextRes.json();
          setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] }));
        }
        
        // Show success toast
        toast('Certificates synced successfully', 'success');
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.error('Sync timed out');
        await alert({
          title: 'Sync Timed Out',
          message: 'The server may be busy. Please try again later.',
          severity: 'warning',
        });
      } else {
        console.error('Failed to sync:', e);
        await alert({
          title: 'Sync Failed',
          message: 'Failed to sync certificates. Check console for details.',
          severity: 'error',
        });
      }
    } finally {
      console.log('[Frontend] Sync complete, resetting saving state');
      setSaving(false);
    }
  };

  const handleDeleteCertificate = async (certId: string) => {
    const confirmed = await confirm({
      title: 'Delete Certificate',
      message: 'Are you sure you want to delete this certificate? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      severity: 'destructive',
    });

    if (!confirmed) {
      return;
    }
    
    try {
      const response = await fetch(`/api/certificates/${certId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh the certificates list
        await loadCertificates();
        // Also refresh the context to reflect changes
        const contextRes = await fetch('/api/settings/context');
        if (contextRes.ok) {
          const data = await contextRes.json();
          setContext(prev => ({ ...prev, 'certificates.md': data['certificates.md'] }));
        }
        toast('Certificate deleted successfully', 'success');
      } else {
        const error = await response.json();
        await alert({
          title: 'Delete Failed',
          message: error.error || 'Failed to delete certificate.',
          severity: 'error',
        });
      }
    } catch (e) {
      console.error('Failed to delete certificate:', e);
      await alert({
        title: 'Delete Failed',
        message: 'Failed to delete certificate. Check console for details.',
        severity: 'error',
      });
    }
  };

  if (loading) return <div className="p-8 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-serif text-text-primary tracking-tight mb-2">Context & Settings</h1>
          <p className="text-text-secondary">Manage your master CV and generation rules.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium px-6 py-2.5 rounded-sm transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-8">
        {/* Master CV Section */}
        <section className="bg-bg-surface border border-border rounded p-8 space-y-4">
          <h2 className="text-lg font-serif text-text-primary">Master CV (LaTeX)</h2>
          <p className="text-sm text-text-secondary">The base LaTeX template and content to draw from.</p>
          <textarea
            rows={15}
            value={context['master-cv.tex']}
            onChange={e => setContext({...context, 'master-cv.tex': e.target.value})}
            className="w-full bg-bg-base border border-border rounded-sm p-4 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono whitespace-pre-wrap resize-y"
            spellCheck={false}
          />
        </section>

        {/* Profile Picture Section */}
        <section className="bg-bg-surface border border-border rounded p-8 space-y-4">
          <h2 className="text-lg font-serif text-text-primary flex items-center gap-2">
            <User size={20} />
            Profile Picture
          </h2>
          <p className="text-sm text-text-secondary">
            Upload your profile picture to use in your CV. If you don't upload one, a placeholder will be used when generating CVs.
          </p>
          
          <div className="flex items-start gap-6">
            {/* Profile image preview or upload area */}
            <div className="flex-shrink-0">
              {profileImage.exists && profileImage.url ? (
                <div className="relative">
                  <img
                    src={profileImage.url}
                    alt="Profile"
                    className="w-32 h-32 rounded-sm object-cover border border-border"
                  />
                  <button
                    onClick={handleProfileImageDelete}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                    title="Delete profile picture"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-bg-base transition-colors"
                >
                  {uploadingProfile ? (
                    <Loader2 className="animate-spin text-text-secondary" size={24} />
                  ) : (
                    <>
                      <Upload className="text-text-secondary mb-2" size={24} />
                      <span className="text-xs text-text-secondary">Upload</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Upload controls */}
            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfileImageUpload}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingProfile}
                className="flex items-center gap-2 text-sm bg-bg-base border border-border px-4 py-2 rounded-sm hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {uploadingProfile ? 'Uploading...' : 'Choose Image'}
              </button>
              
              <p className="text-xs text-text-secondary">
                Accepted formats: JPG, PNG, WebP. Maximum size: 5MB.
              </p>
              
              {!profileImage.exists && (
                <p className="text-sm text-amber-600">
                  No profile picture uploaded. A placeholder will be used in generated CVs.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Certificates Section - New Design */}
        <section className="bg-bg-surface border border-border rounded p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif text-text-primary flex items-center gap-2">
                <Award size={20} />
                Certificates & Qualifications
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Manage your certificates, courses, and qualifications.
              </p>
            </div>
            {savedCerts.length > 0 && (
              <button
                onClick={handleSyncToContext}
                disabled={saving}
                className={`flex items-center gap-2 text-sm transition-colors ${
                  syncSuccess
                    ? 'text-green-500 hover:text-green-400'
                    : 'text-accent hover:text-accent-hover'
                }`}
              >
                {syncSuccess ? (
                  <>
                    <CheckCircle size={16} />
                    Synced!
                  </>
                ) : saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Sync {savedCerts.length} to Context
                  </>
                )}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-border">
            <button
              onClick={() => setActiveTab('manual')}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Manual Edit
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === 'import'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Import from PDF
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'manual' ? (
            <div className="space-y-4">
               <textarea
                 rows={10}
                 value={context['certificates.md']}
                 onChange={e => setContext({...context, 'certificates.md': e.target.value})}
                 className="w-full bg-bg-base border border-border rounded-sm p-4 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono whitespace-pre-wrap resize-y"
                 spellCheck={false}
               />
              
              {/* Saved certificates summary */}
              {savedCerts.length > 0 && (
                <div className="bg-bg-base border border-border rounded p-4">
                  <h3 className="text-sm font-medium text-text-primary mb-2">
                    Saved Certificates ({savedCerts.length})
                  </h3>
                  <ul className="space-y-2">
                    {savedCerts.map((cert, i) => (
                      <li key={cert.id || i} className="text-sm text-text-secondary flex items-center justify-between gap-2 group">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check size={14} className="text-green-500 flex-shrink-0" />
                          <span className="truncate">{cert.name} — {cert.issuer}</span>
                        </div>
                        <button
                          onClick={() => cert.id && handleDeleteCertificate(cert.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-all p-1"
                          title="Delete certificate"
                        >
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
                  <div className="bg-bg-base border border-border rounded p-4">
                    <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-2">
                      <Upload size={16} />
                      Upload Certificate PDFs
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">
                      Upload PDF files of your certificates. The app will extract the certificate name, 
                      issuer, dates, credential ID, and skills using OCR.
                    </p>
                    <CertificateUpload onExtracted={handleExtracted} />
                  </div>
                  
                  {savedCerts.length > 0 && (
                    <p className="text-sm text-text-secondary text-center">
                      You have {savedCerts.length} certificate{savedCerts.length !== 1 ? 's' : ''} saved.
                      New certificates will be added to the existing collection.
                    </p>
                  )}
                </div>
              ) : (
                <CertificatePreview
                  results={extractionResults}
                  onSave={handleSaveCertificates}
                  onCancel={handleCancelImport}
                  saving={savingCertificates}
                />
              )}
            </div>
          )}
        </section>

        {/* Custom Instructions Section */}
        <section className="bg-bg-surface border border-border rounded p-8 space-y-4">
          <h2 className="text-lg font-serif text-text-primary">Custom Instructions (Markdown)</h2>
          <p className="text-sm text-text-secondary">Personal rules for the AI (e.g., "Always emphasize my leadership experience").</p>
          <textarea
            rows={8}
            value={context['instructions.md']}
            onChange={e => setContext({...context, 'instructions.md': e.target.value})}
            className="w-full bg-bg-base border border-border rounded-sm p-4 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono whitespace-pre-wrap resize-y"
            spellCheck={false}
          />
        </section>
      </div>
    </div>
  );
}
