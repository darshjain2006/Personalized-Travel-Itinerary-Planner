import React from 'react';
import { Map } from 'lucide-react';

export const TripsPage: React.FC = () => (
  <div className="max-w-5xl mx-auto">
    <div className="flex items-center gap-3 mb-7">
      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
        <Map size={18} className="text-slate-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-100">My Trips</h1>
        <p className="text-xs text-slate-400">All your planned adventures</p>
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/50 border border-slate-800/60 p-6 text-center py-16 text-slate-500 text-sm">
      Trip listing coming in the next step
    </div>
  </div>
);
