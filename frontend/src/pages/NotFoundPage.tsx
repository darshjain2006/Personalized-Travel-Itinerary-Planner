import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-3xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center mx-auto text-brand-400 shadow-2xl shadow-brand-500/10">
            <Compass size={48} className="animate-pulse" />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-lg">
            404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Lost off the itinerary?
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The page, destination, or trip route you are looking for does not exist or may have been archived.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto"
          >
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            size="md"
            leftIcon={<Plus size={16} />}
            onClick={() => navigate('/trips/new')}
            className="w-full sm:w-auto"
          >
            Plan a New Trip
          </Button>
        </div>
      </div>
    </div>
  );
};
