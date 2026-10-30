import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Heart, 
  Users, 
  Sparkles, 
  Compass, 
  ArrowRight, 
  Layers, 
  Database, 
  Bot 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HealthStatusBadge } from '../components/HealthStatusBadge';

const scenarios = [
  {
    id: 'solo',
    title: 'Solo Traveler',
    badge: 'Optimized & Budget-Aware',
    tagline: 'Weekend getaway or fast-paced exploration',
    icon: User,
    color: 'from-blue-600 to-cyan-500',
    description: 'Designed for independent travelers with limited time who need an ultra-efficient, budget-aware route and curated local spots.',
    features: [
      'Time-optimized transit routes',
      'Curated budget caps & daily spend tracking',
      'Solo-friendly cafes and walk tours',
      'Instant alternative recommendations',
    ],
  },
  {
    id: 'couple',
    title: 'Couple Getaway',
    badge: 'Relaxed & Romantic',
    tagline: 'Scenic pacing, premium stays & flexibility',
    icon: Heart,
    color: 'from-rose-500 to-pink-500',
    description: 'Crafted for relaxed pacing, scenic dining, and boutique hotels. Includes single-day regeneration and real-time cost estimations.',
    features: [
      'Romantic sunset & dining recommendations',
      'Regenerate individual days on demand',
      'Flexible pacing (relaxed vs active)',
      'Estimated shared expenses & reservations',
    ],
  },
  {
    id: 'group',
    title: 'Small Group Adventure',
    badge: 'Collaborative & Balanced',
    tagline: 'Conflict-free logistics & combined preferences',
    icon: Users,
    color: 'from-amber-500 to-orange-500',
    description: 'Balances diverse group tastes (adventure vs. culture vs. leisure) with logistics that minimize schedule conflicts.',
    features: [
      'Multi-day group itineraries with headcount sizing',
      'Merged preference weighting (adventure & culture)',
      'Split-cost estimates and shared transport',
      'Logistics optimized to avoid conflicts',
    ],
  },
];

const techStackHighlights = [
  {
    name: 'Frontend',
    detail: 'React 18 + Vite + TS + Tailwind CSS',
    icon: Layers,
    sub: 'TanStack Query, React Hook Form, Zod',
  },
  {
    name: 'Backend',
    detail: 'FastAPI (Python 3.11/3.14)',
    icon: Compass,
    sub: 'Layered Routers -> Services -> Repositories',
  },
  {
    name: 'Database & Auth',
    detail: 'Supabase Postgres + RLS',
    icon: Database,
    sub: 'Row Level Security & User Sessions',
  },
  {
    name: 'AI Engine',
    detail: 'Gemini API (google-genai)',
    icon: Bot,
    sub: 'Strict Pydantic JSON validation & retries',
  },
];

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleExplore = () => {
    if (user) {
      navigate('/trips/new');
    } else {
      navigate('/login', { state: { from: { pathname: '/trips/new' } } });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute bottom-10 -right-20 w-[450px] h-[450px] bg-cyan-600/10 blur-3xl rounded-full" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Wandr
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  AI
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center text-xs text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-900"
            >
              API Docs
            </a>
            {user ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: { pathname: '/trips/new' } } })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={handleExplore}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Trip</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>AI-Powered Full-Stack Travel Planner</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Intelligent Itineraries,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">
              Tailored to Your Journey
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Generate customized, day-by-day travel schedules with real-time budget forecasting,
            customizable pacing, and conflict-free logistics powered by Gemini AI and FastAPI.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleExplore}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>Explore Itinerary Builder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <span>Swagger API Docs</span>
            </a>
          </div>
        </div>

        {/* Live Backend Connection Card (Step 1 Verification) */}
        <section className="max-w-4xl mx-auto">
          <HealthStatusBadge />
        </section>

        {/* 3 Core Scenarios Section */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Tailored for Every Travel Persona
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Our AI architecture adapts its itinerary structure, pacing, and logistics to match specific group dynamics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarios.map((sc) => {
              const Icon = sc.icon;
              return (
                <div
                  key={sc.id}
                  className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl bg-gradient-to-tr ${sc.color} text-white shadow-md`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {sc.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{sc.title}</h3>
                      <p className="text-xs text-blue-400 font-medium mt-0.5">{sc.tagline}</p>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {sc.description}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Scenario Highlights
                      </p>
                      <ul className="space-y-1.5">
                        {sc.features.map((feat, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80">
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium group-hover:text-blue-400">
                      Configured for Step 3 Generator
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tech Stack Specs */}
        <section className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Full-Stack Tech Architecture</h3>
              <p className="text-xs text-slate-400">
                Layered backend separation of concerns with modern typed React 18 client
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 px-3 py-1 rounded-md bg-slate-900 border border-slate-800">
              Monorepo: /frontend & /backend
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {techStackHighlights.map((tech, idx) => {
              const TechIcon = tech.icon;
              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 space-y-2">
                  <div className="flex items-center gap-2.5 text-blue-400">
                    <TechIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {tech.name}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{tech.detail}</div>
                  <div className="text-xs text-slate-400">{tech.sub}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-500" />
            <span>Personalized Travel Itinerary Planner © 2026</span>
          </div>
          <div className="flex items-center space-x-6">
            <span>FastAPI + Pydantic v2</span>
            <span>•</span>
            <span>React 18 + Vite</span>
            <span>•</span>
            <span>Supabase & Gemini AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
