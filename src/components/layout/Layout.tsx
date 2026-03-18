import { Outlet, NavLink } from 'react-router-dom';
import { FileText, Plus, Settings } from 'lucide-react';

export function Layout() {
  return (
    <div className="flex h-screen bg-bg-base text-text-primary">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-bg-surface flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="text-accent font-serif text-2xl tracking-tight text-center">
            CVForge
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/new"
            className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${isActive ? 'bg-bg-elevated text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
          >
            <Plus size={18} />
            <span className="font-medium text-sm">New CV</span>
          </NavLink>
          <NavLink
            to="/"
            end
            className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${isActive ? 'bg-bg-elevated text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
          >
            <FileText size={18} />
            <span className="font-medium text-sm">Applications</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${isActive ? 'bg-bg-elevated text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
          >
            <Settings size={18} />
            <span className="font-medium text-sm">Context & Settings</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
