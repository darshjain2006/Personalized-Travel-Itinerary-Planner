import React from 'react';
import { Bell, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, actions }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const avatarChar =
    user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U';
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="flex-shrink-0 h-16 flex items-center justify-between px-5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60">
      {/* Left: page title */}
      <div className="flex-1 min-w-0">
        {title && (
          <div>
            <h2 className="text-sm font-semibold text-slate-100 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Center: custom actions slot */}
      {actions && <div className="flex-1 flex justify-center">{actions}</div>}

      {/* Right: controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications (placeholder) */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors relative"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* User menu */}
        <div className="group relative">
          <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-800 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {avatarChar}
            </div>
            <span className="text-xs font-medium text-slate-300 hidden sm:block max-w-[100px] truncate">
              {displayName}
            </span>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/40 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-50">
            <div className="px-3 py-2.5 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <div className="p-1">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
