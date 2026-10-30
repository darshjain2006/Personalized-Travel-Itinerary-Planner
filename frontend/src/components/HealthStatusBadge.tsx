import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Server, ShieldCheck, Cpu } from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { Skeleton } from './Skeleton';

export const HealthStatusBadge: React.FC = () => {
  const { data: health, isLoading, isError, error, refetch, isFetching } = useHealth();

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-blue-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Backend Systems Status
              <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300">
                GET /health
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live communication between React client and FastAPI server
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-colors disabled:opacity-50"
          title="Refetch health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
          <span>{isFetching ? 'Checking...' : 'Refresh'}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : isError ? (
        <div className="mt-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                Connection Failed
              </h4>
              <p className="text-xs text-rose-300/80 mt-1">
                {error?.message || 'Unable to connect to the backend server at http://localhost:8000.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Verify that the FastAPI server is running (`uvicorn app.main:app --port 8000`).
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold capitalize">{health?.status}</span>
              <span className="text-emerald-400/60">•</span>
              <span className="text-slate-300 font-mono">Env: {health?.environment}</span>
            </div>
            <span className="text-slate-400 text-[11px] font-mono">
              Timestamp: {health ? new Date(health.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span>FastAPI Service</span>
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {health?.services?.api || 'operational'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Database / Auth</span>
              </div>
              <div className="text-sm font-semibold text-slate-200 truncate">
                {health?.services?.database || 'Ready for Supabase'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Gemini 2.5 SDK</span>
              </div>
              <div className="text-sm font-semibold text-slate-200 truncate">
                {health?.services?.gemini_ai || 'Ready for GenAI'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
