import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MapPin,
  LayoutDashboard,
  Map,
  PlusCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/trips', label: 'My Trips', icon: <Map size={18} /> },
  { to: '/trips/new', label: 'New Trip', icon: <PlusCircle size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, signOut } = useAuth();

  const avatarChar = user?.user_metadata?.full_name?.[0] ||
    user?.email?.[0]?.toUpperCase() || 'U';
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';

  return (
    <aside
      className={clsx(
        'relative flex flex-col h-screen bg-slate-950/95 backdrop-blur-md border-r border-slate-800/60 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800/60 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/30">
          <MapPin size={15} className="text-white" />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-bold text-slate-100 text-base tracking-tight truncate">Wandr</span>
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-1.5 py-0.5 rounded-full">
              <Sparkles size={9} /> AI
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-200 text-xs font-medium px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-800/60 p-3">
        <div className={clsx('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
            {avatarChar}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{displayEmail}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={signOut}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 flex items-center justify-center transition-all duration-200 z-10 shadow-md"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
};
