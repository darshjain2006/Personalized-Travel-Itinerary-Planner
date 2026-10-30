import React from 'react';
import { Compass, Sparkles, Activity } from 'lucide-react';
import { useHealth } from '../hooks/useHealth';

export const Header: React.FC = () => {
  const { data: health, isLoading, isError } = useHealth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              WanderAI
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Planner
              </span>
            </span>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Personalized Travel Itineraries
            </p>
          </div>
        </div>

        {/* Navigation & Connection Pill */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-800 bg-slate-900/60 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Backend:</span>
            {isLoading ? (
              <span className="inline-flex items-center text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1.5"></span>
                Connecting...
              </span>
            ) : isError ? (
              <span className="inline-flex items-center text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shadow-sm shadow-emerald-400"></span>
                v{health?.version || '1.0.0'}
              </span>
            )}
          </div>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
          >
            API Docs
          </a>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 hover:shadow-blue-500/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Itinerary</span>
          </button>
        </div>
      </div>
    </header>
  );
};
