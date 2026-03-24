import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Download, RefreshCw, Loader2, BarChart2, CheckCircle2, XCircle, Clock, RefreshCcw, FileEdit } from 'lucide-react';
import { format } from 'date-fns';
import { useDialog } from '../context/DialogContext';
import { EmptyState } from '../components/EmptyState';
import { PaginationControls } from '../components/PaginationControls';
import { RestoreConfirmationDialog } from '../components/dialogs/RestoreConfirmationDialog';
import { fetchActiveJobs, JobInfo } from '../hooks/useJobStatus';

interface Application {
  id: string;
  companyName: string;
  jobTitle: string;
  status: string;
  targetLanguage: string;
  createdAt: string;
  pdfGenerated: boolean;
}

interface DashboardStats {
  total: number;
  inProgress: number;
  active: number;
  outcomes: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobInfo[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, inProgress: 0, active: 0, outcomes: 0 });
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

    Promise.all([
      fetch(`/api/applications?skip=${skip}&take=${pageSize}${searchParam}`).then(res => {
        if (!res.ok) throw new Error('Failed to fetch applications');
        return res.json();
      }),
      fetchActiveJobs().catch(() => [])
    ])
    .then(([appData, jobs]) => {
      setApps(appData.applications || []);
      setTotal(appData.total ?? 0);
      setActiveJobs(jobs as JobInfo[]);
      if (appData.stats) {
        setStats({
          ...appData.stats,
          inProgress: (appData.stats.inProgress || 0) + (jobs?.length || 0)
        });
      }
      setLoading(false);
    })
    .catch(() => {
      toast('Failed to load dashboard data', 'error');
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

  const toolbarBtnClass = "flex items-center gap-2 px-3 py-1.5 border border-border text-text-secondary font-mono text-xs uppercase tracking-wider hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end pb-6">
        <div>
          <h1 className="text-[2.5rem] font-serif text-text-primary tracking-tight leading-tight">Dashboard</h1>
          <p className="text-text-secondary mt-1">Manage your job applications</p>
        </div>
        <Link 
          to="/new" 
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-on-accent font-medium px-6 py-3 rounded-sm transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Application
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-surface border border-border p-4 flex flex-col surface-card">
          <div className="flex items-center gap-2 text-text-secondary mb-2">
            <BarChart2 size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider">Total</span>
          </div>
          <span className="text-3xl font-serif text-text-primary">{stats.total}</span>
        </div>
        <div className="bg-bg-surface border border-border p-4 flex flex-col surface-card">
          <div className="flex items-center gap-2 text-status-generating mb-2">
            <Clock size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider">In Progress</span>
          </div>
          <span className="text-3xl font-serif text-text-primary">{stats.inProgress}</span>
        </div>
        <div className="bg-bg-surface border border-border p-4 flex flex-col surface-card">
          <div className="flex items-center gap-2 text-status-applied mb-2">
            <CheckCircle2 size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider">Active</span>
          </div>
          <span className="text-3xl font-serif text-text-primary">{stats.active}</span>
        </div>
        <div className="bg-bg-surface border border-border p-4 flex flex-col surface-card">
          <div className="flex items-center gap-2 text-status-offer mb-2">
            <XCircle size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider">Outcomes</span>
          </div>
          <span className="text-3xl font-serif text-text-primary">{stats.outcomes}</span>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search company or title..." 
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-transparent border-b border-border pl-6 pr-4 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button className={toolbarBtnClass}>
          <Filter size={14} />
          Filter
        </button>
        <button disabled={backupLoading} onClick={handleBackup} className={toolbarBtnClass}>
          {backupLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Backup
        </button>
        <button disabled={exportLoading} onClick={handleExportPDF} className={toolbarBtnClass}>
          {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Export PDF
        </button>
        <button disabled={restoreLoading} onClick={handleRestoreClick} className={toolbarBtnClass}>
          {restoreLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Restore
        </button>
      </div>

      <div className="border border-border overflow-hidden bg-bg-surface surface-card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="thead-gradient text-thead-text border-b border-border">
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider">Company</th>
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider">Role</th>
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider">Status</th>
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider">Lang</th>
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider">Date</th>
              <th className="p-4 font-mono text-[11px] font-normal uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-muted font-mono text-sm">Loading...</td></tr>
            ) : apps.length === 0 && activeJobs.length === 0 ? (
              <tr><td colSpan={6}><EmptyState message={search ? 'No applications match your search.' : 'No applications found.'} /></td></tr>
            ) : (
              <>
                {currentPage === 1 && activeJobs.map(job => (
                  <tr
                    key={job.id}
                    className="border-b border-border bg-bg-elevated/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-text-primary opacity-70">
                      {job.companyName || 'Unknown Company'}
                    </td>
                    <td className="p-4 text-text-primary opacity-70">{job.jobTitle || 'New Application'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-2 bg-status-generating/10 text-status-generating px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wider">
                        <Loader2 size={10} className="animate-spin" /> GENERATING
                      </span>
                    </td>
                    <td className="p-4 text-text-secondary font-mono text-sm opacity-70">-</td>
                    <td className="p-4 text-text-secondary font-mono text-sm whitespace-nowrap opacity-70">
                      Just now
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-2">
                    </td>
                  </tr>
                ))}
                {apps.map(app => (
                  <tr
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className={`border-b border-border hover:bg-bg-elevated transition-colors cursor-pointer group ${
                      highlightedId === app.id ? 'flash-highlight' : ''
                    }`}
                  >
                    <td className="p-4 font-medium text-text-primary">
                      {app.companyName}
                    </td>
                    <td className="p-4 text-text-primary">{app.jobTitle}</td>
                    <td className="p-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="p-4 text-text-secondary font-mono text-sm">{app.targetLanguage}</td>
                    <td className="p-4 text-text-secondary font-mono text-sm whitespace-nowrap">
                      {format(new Date(app.createdAt), 'dd.MM.yyyy')}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/applications/${app.id}`)} className="inline-flex p-2 text-text-muted hover:text-accent transition-colors" title="Notes">
                        <FileEdit size={16} />
                      </button>
                      <button onClick={() => navigate(`/new?regenerate=${app.id}`)} className="inline-flex p-2 text-text-muted hover:text-accent transition-colors" title="Regenerate">
                        <RefreshCcw size={16} />
                      </button>
                      <a href={`/api/applications/${app.id}/download/pdf`} className="inline-flex p-2 text-text-muted hover:text-accent transition-colors" title="View PDF">
                        <Download size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </>
            )}
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
  const styles: Record<string, string> = {
    GENERATED: 'bg-status-generated/10 text-status-generated',
    APPLIED: 'bg-status-applied/10 text-status-applied',
    INTERVIEW: 'bg-status-interview/10 text-status-interview',
    OFFER: 'bg-status-offer/10 text-status-offer',
    REJECTED: 'bg-status-rejected/10 text-status-rejected',
    WITHDRAWN: 'bg-status-withdrawn/10 text-status-withdrawn',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wider ${styles[status] || styles.GENERATED}`}>
      {status}
    </span>
  );
}
