import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
    fetch(`/api/applications?skip=${skip}&take=${pageSize}${searchParam}`)
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
  }, [currentPage, pageSize, search]);

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
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">Track and manage your generated CVs</p>
        </div>
        <Link 
          to="/new" 
          className="btn-primary"
        >
          <Plus size={18} />
          New Application
        </Link>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search className="search-icon" size={16} />
          <input 
            type="text" 
            placeholder="Search company or title..." 
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="refined-input"
          />
        </div>
        <button className="btn-ghost">
          <Filter size={14} />
          Filter
        </button>
        <button disabled={backupLoading} onClick={handleBackup} className="btn-ghost">
          {backupLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Backup
        </button>
        <button disabled={exportLoading} onClick={handleExportPDF} className="btn-ghost">
          {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Export PDF
        </button>
        <button disabled={restoreLoading} onClick={handleRestoreClick} className="btn-ghost">
          {restoreLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Restore
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper surface-card">
        <table className="refined-table">
          <thead>
            <tr className="table-header">
              <th className="table-th">Company</th>
              <th className="table-th">Role</th>
              <th className="table-th">Status</th>
              <th className="table-th hide-mobile">Lang</th>
              <th className="table-th hide-mobile">Date</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-cell-loading">Loading...</td></tr>
            ) : apps.length === 0 ? (
              <tr><td colSpan={6}><EmptyState message={search ? 'No applications match your search.' : 'No applications found.'} /></td></tr>
            ) : apps.map(app => (
              <tr 
                key={app.id} 
                onClick={() => navigate(`/applications/${app.id}`)}
                className={`table-row clickable ${
                  highlightedId === app.id ? 'flash-highlight' : ''
                }`}
              >
                <td className="table-cell font-medium">
                  {app.companyName}
                </td>
                <td className="table-cell">{app.jobTitle}</td>
                <td className="table-cell">
                  <StatusBadge status={app.status} />
                </td>
                <td className="table-cell-mono hide-mobile">{app.targetLanguage}</td>
                <td className="table-cell-mono whitespace-nowrap hide-mobile">
                  {format(new Date(app.createdAt), 'dd.MM.yyyy')}
                </td>
                <td className="table-cell-actions" onClick={e => e.stopPropagation()}>
                  <a href={`/api/applications/${app.id}/download/tex`} className="icon-action" title="Download TEX">
                    <FileText size={16} />
                  </a>
                  <a href={`/api/applications/${app.id}/download/pdf`} className="icon-action" title="Download PDF">
                    <Download size={16} />
                  </a>
                  <button onClick={() => handleDelete(app.id)} className="icon-action-destructive" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        disabled={loading}
      />

      {/* Restore Dialog */}
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
  const styles: Record<string, string> = {
    GENERATED: 'badge-generate',
    APPLIED: 'badge-apply',
    INTERVIEW: 'badge-interview',
    OFFER: 'badge-offer',
    REJECTED: 'badge-reject',
    WITHDRAWN: 'badge-withdrawn',
  };

  return (
    <span className={`badge ${styles[status] || styles.GENERATED}`}>
      {status}
    </span>
  );
}
