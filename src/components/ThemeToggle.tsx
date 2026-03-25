import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text hover:text-sidebar-heading hover:bg-sidebar-hover-bg transition-all duration-150"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={16} />
          <span className="text-sm">Light mode</span>
        </>
      ) : (
        <>
          <Moon size={16} />
          <span className="text-sm">Dark mode</span>
        </>
      )}
    </button>
  );
}
