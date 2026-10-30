import React from 'react';
import { Settings } from 'lucide-react';

export const SettingsPage: React.FC = () => (
  <div className="max-w-2xl mx-auto">
    <div className="flex items-center gap-3 mb-7">
      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
        <Settings size={18} className="text-slate-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-xs text-slate-400">Manage your account and preferences</p>
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/50 border border-slate-800/60 p-6 text-center py-16 text-slate-500 text-sm">
      Settings panel coming soon
    </div>
  </div>
);
