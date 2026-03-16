import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search, Filter, MoreVertical, Download, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDialog } from '../context/DialogContext';

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
  const { confirm, toast } = useDialog();

  useEffect(() => {
    fetch('/api/applications')
      .then(res => res.json())
      .then(data => {
        setApps(data.applications || []);
        setLoading(false);
      });
  }, []);

  const filteredApps = apps.filter(app =>
    app.companyName.toLowerCase().includes(search.toLowerCase()) ||
    app.jobTitle.toLowerCase().includes(search.toLowerCase())
  );

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
          toast('Application deleted successfully', 'success');
        } else {
          toast('Failed to delete application', 'error');
        }
      } catch {
        toast('Failed to delete application', 'error');
      }
    }
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
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded pl-10 pr-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded text-text-secondary hover:bg-bg-elevated transition-colors">
          <Filter size={18} />
          Filter
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
              <tr><td colSpan={6} className="p-8 text-center text-text-secondary">No applications found.</td></tr>
            ) : filteredApps.map(app => (
              <tr key={app.id} className="hover:bg-bg-elevated transition-colors group">
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
