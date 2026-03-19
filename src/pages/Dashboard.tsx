import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Download, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDialog } from '../context/DialogContext';
import { EmptyState } from '../components/EmptyState';
import { PaginationControls } from '../components/PaginationControls';
import { RestoreConfirmationDialog } from '../components/dialogs/RestoreConfirmationDialog';

interface Application {
  id: string;
  companyName: string;
  jobTitle: string;
  status: string;
  targetLanguage: string;
  createdAt: string;
  pdfGenerated: boolean;
}

export function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreAppCount, setRestoreAppCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('highlighted');
  const { confirm, toast } = useDialog();

  useEffect(() => {
    const skip = (currentPage - 1) * pageSize;
    fetch(`/api/applications?skip=${skip}&take=${pageSize}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch applications');
        return res.json();
      })
      .then(data => {
        setApps(data.applications || []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        toast('Failed to load applications', 'error');
        setLoading(false);
      });
  }, [currentPage, pageSize]);

  // Clear the highlighted parameter after first render
  useEffect(() => {
    if (highlightedId) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, '', '/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedId]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/applications/backup');
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `cvforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to download backup', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      const response = await fetch('/api/applications/export/pdf');
      if (!response.ok) throw new Error('PDF export failed');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `cvforge-applications-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to export PDF', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const filteredApps = apps.filter(app =>
    app.companyName.toLowerCase().includes(search.toLowerCase()) ||
    app.jobTitle.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Application',
      message: 'Are you sure you want to delete this application? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      severity: 'destructive',
    });

    if (confirmed) {
      try {
        const response = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
        if (response.ok) {
          setApps(apps.filter(app => app.id !== id));
          setTotal(prev => Math.max(0, prev - 1));
          toast('Application deleted successfully', 'success');
        } else {
          toast('Failed to delete application', 'error');
        }
      } catch {
        toast('Failed to delete application', 'error');
      }
    }
  };

  const handleRestoreClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const count = parsed.applications?.length ?? 0;
        setRestoreFile(file);
        setRestoreAppCount(count);
        setRestoreDialogOpen(true);
      } catch {
        toast('Failed to parse backup file. Please select a valid JSON file.', 'error');
      }
    };
    input.click();
  };

  const handleRestoreConfirm = async () => {
    if (!restoreFile) return;
    setRestoreDialogOpen(false);
    setRestoreLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      const response = await fetch('/api/applications/restore', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Restore failed');
      }
      const data = await response.json();
      toast(`Restored: ${data.created} created, ${data.updated} updated`, 'success');
      setCurrentPage(1);
      // Re-fetch applications at page 1
      const listRes = await fetch(`/api/applications?skip=0&take=${pageSize}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        setApps(listData.applications || []);
        setTotal(listData.total ?? 0);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to restore backup', 'error');
    } finally {
      setRestoreLoading(false);
      setRestoreFile(null);
      setRestoreAppCount(0);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreDialogOpen(false);
    setRestoreFile(null);
    setRestoreAppCount(0);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-serif text-text-primary tracking-tight mb-2">Applications</h1>
          <p className="text-text-secondary">Track and manage your generated CVs.</p>
        </div>
        <Link 
          to="/new" 
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium px-4 py-2 rounded transition-colors"
        >
          <Plus size={18} />
          New Application
        </Link>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Search company or title..." 
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded pl-10 pr-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded text-text-secondary hover:bg-bg-elevated transition-colors">
          <Filter size={18} />
          Filter
        </button>
        <button
          disabled={backupLoading}
          onClick={handleBackup}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded text-text-secondary hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {backupLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          Backup
        </button>
        <button
          disabled={exportLoading}
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded text-text-secondary hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exportLoading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          Export PDF
        </button>
        <button
          disabled={restoreLoading}
          onClick={handleRestoreClick}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded text-text-secondary hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {restoreLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Restore
        </button>
      </div>

      <div className="bg-bg-surface border border-border rounded overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-text-secondary text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Company</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Language</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-secondary">Loading...</td></tr>
            ) : filteredApps.length === 0 ? (
              <tr><td colSpan={6}><EmptyState message="No applications found." /></td></tr>
            ) : filteredApps.map(app => (
              <tr 
                key={app.id} 
                className={`hover:bg-bg-elevated transition-colors group ${
                  highlightedId === app.id 
                    ? 'flash-highlight' 
                    : ''
                }`}
              >
                <td className="p-4 font-medium text-text-primary">
                  <Link to={`/applications/${app.id}`} className="hover:text-accent transition-colors">
                    {app.companyName}
                  </Link>
                </td>
                <td className="p-4 text-text-secondary">{app.jobTitle}</td>
                <td className="p-4">
                  <StatusBadge status={app.status} />
                </td>
                <td className="p-4 text-text-secondary font-mono text-sm">{app.targetLanguage}</td>
                <td className="p-4 text-text-secondary font-mono text-sm">
                  {format(new Date(app.createdAt), 'MMM dd, yyyy')}
                </td>
                <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/api/applications/${app.id}/download/tex`} className="inline-flex p-2 text-text-secondary hover:text-accent transition-colors" title="Download TEX">
                    <FileText size={16} />
                  </a>
                  <a href={`/api/applications/${app.id}/download/pdf`} className="inline-flex p-2 text-text-secondary hover:text-accent transition-colors" title="Download PDF">
                    <Download size={16} />
                  </a>
                  <button onClick={() => handleDelete(app.id)} className="inline-flex p-2 text-text-secondary hover:text-destructive transition-colors" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setCurrentPage}
        disabled={loading}
      />

      <RestoreConfirmationDialog
        open={restoreDialogOpen}
        applicationCount={restoreAppCount}
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const dotColors: Record<string, string> = {
    GENERATED: 'bg-status-generated',
    APPLIED: 'bg-status-applied',
    INTERVIEW: 'bg-status-interview',
    OFFER: 'bg-status-offer',
    REJECTED: 'bg-status-rejected',
    WITHDRAWN: 'bg-status-withdrawn',
  };

  const dotColor = dotColors[status] || dotColors.GENERATED;

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary">
      <span className={`w-2 h-2 rounded-sm ${dotColor}`} />
      {status}
    </span>
  );
}
