import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FileText, Plus, Settings } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { useEffect, useState } from 'react';

export function Layout() {
  const location = useLocation();
  const [fadeKey, setFadeKey] = useState(location.pathname);

  useEffect(() => {
    setFadeKey(location.pathname);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
      isActive
        ? 'bg-sidebar-text-active/10 text-sidebar-text-active border-l-2 border-accent -ml-px'
        : 'text-sidebar-text hover:text-sidebar-heading hover:bg-sidebar-text-active/5'
    }`;

  return (
    <div className="flex h-screen text-text-primary">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 border-r border-sidebar-border sidebar-gradient flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="text-sidebar-heading font-serif text-xl tracking-tight">
            CVForge
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/new" className={navLinkClass}>
            <Plus size={16} />
            <span>New CV</span>
          </NavLink>
          <NavLink to="/" end className={navLinkClass}>
            <FileText size={16} />
            <span>Applications</span>
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <Settings size={16} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto main-content-gradient">
        <div key={fadeKey} className="max-w-6xl mx-auto p-8 page-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
