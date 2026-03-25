import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FileText, Plus, Settings, Menu, X, Sun, Moon } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { useEffect, useState } from 'react';

export function Layout() {
  const location = useLocation();
  const [fadeKey, setFadeKey] = useState(location.pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setFadeKey(location.pathname);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-nav-item ${isActive ? 'active' : ''}`;

  return (
    <div className="flex h-screen text-text-primary">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-overlay z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto
        w-[240px] shrink-0 h-full
        border-r border-sidebar-border sidebar-gradient 
        flex flex-col
        transition-transform duration-300 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="sidebar-brand">CVForge</div>
            <button 
              className="lg:hidden p-1 text-sidebar-text hover:text-sidebar-heading transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-[11px] text-sidebar-text mt-1 font-mono tracking-wide">
            Craft your story
          </p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/new" className={navLinkClass}>
            <Plus size={18} />
            <span>New CV</span>
          </NavLink>
          <NavLink to="/" end className={navLinkClass}>
            <FileText size={18} />
            <span>Applications</span>
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto main-content-gradient">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border bg-surface">
          <button 
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="font-serif text-lg text-text-primary">CVForge</span>
        </div>

        <div key={fadeKey} className="max-w-5xl mx-auto p-6 lg:p-8 page-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
