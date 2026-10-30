import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  DollarSign,
  Globe,
  Clock,
  Sparkles,
  Plus,
  Search,
  MoreVertical,
  ExternalLink,
  Copy,
  Archive,
  Trash2,
  Compass,
  AlertCircle,
  ArrowRight,
  User,
  Users,
  Heart,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from '../hooks/useTrips';
import { useToast } from '../hooks/useToast';
import type { Trip, TravelerType, TripStatus } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ModalFooter } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-blue-600 via-indigo-600 to-violet-700',
  'from-emerald-600 via-teal-600 to-cyan-700',
  'from-rose-600 via-pink-600 to-amber-600',
  'from-amber-600 via-orange-600 to-rose-700',
  'from-purple-600 via-fuchsia-600 to-pink-700',
  'from-sky-600 via-blue-600 to-indigo-700',
];

function getCoverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function formatDateRange(startStr?: string, endStr?: string): string {
  if (!startStr) return 'Dates flexible';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;

  const startFormatted = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (!end) return startFormatted;

  const endFormatted = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startFormatted} – ${endFormatted}`;
}

function getDaysUntil(dateStr?: string): { days: number; text: string; isPast: boolean } {
  if (!dateStr) return { days: 0, text: 'Dates pending', isPast: false };
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: Math.abs(diffDays), text: `${Math.abs(diffDays)}d ago`, isPast: true };
  }
  if (diffDays === 0) {
    return { days: 0, text: 'Starts today!', isPast: false };
  }
  if (diffDays === 1) {
    return { days: 1, text: 'Starts tomorrow!', isPast: false };
  }
  return { days: diffDays, text: `In ${diffDays} days`, isPast: false };
}

function getTravelerIcon(type: TravelerType) {
  switch (type) {
    case 'solo':
      return <User size={13} className="text-blue-400" />;
    case 'couple':
      return <Heart size={13} className="text-rose-400" />;
    case 'group':
      return <Users size={13} className="text-amber-400" />;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const { data: trips, isLoading, isError, refetch } = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TripStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TravelerType>('all');
  const [sortBy, setSortBy] = useState<'date-asc' | 'date-desc' | 'budget-desc' | 'name'>('date-asc');

  // Active action menu & modal states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);

  const userName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Explorer';

  // ─── Computed Metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    if (!trips || trips.length === 0) {
      return {
        totalTrips: 0,
        upcomingTrips: 0,
        totalSpend: 0,
        uniqueDestinations: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = trips.filter((t) => {
      if (t.status === 'archived') return false;
      if (!t.start_date) return t.status === 'generated';
      return new Date(t.start_date) >= today;
    }).length;

    const spend = trips.reduce((acc, t) => acc + (t.budget_total || 0), 0);

    const dests = new Set(trips.map((t) => t.destination.trim().toLowerCase())).size;

    return {
      totalTrips: trips.length,
      upcomingTrips: upcoming,
      totalSpend: spend,
      uniqueDestinations: dests,
    };
  }, [trips]);

  // ─── Hero Card: Next Upcoming Trip ─────────────────────────────────────────

  const upcomingHeroTrip = useMemo(() => {
    if (!trips || trips.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeFuture = trips
      .filter((t) => t.status !== 'archived')
      .sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return dateA - dateB;
      });

    // Prefer trips starting today or in future
    const futureTrip = activeFuture.find((t) => t.start_date && new Date(t.start_date) >= today);
    return futureTrip || activeFuture[0] || null;
  }, [trips]);

  // ─── Filtered & Sorted Trips ───────────────────────────────────────────────

  const filteredTrips = useMemo(() => {
    if (!trips) return [];

    return trips
      .filter((t) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDest = t.destination.toLowerCase().includes(q);
          if (!matchTitle && !matchDest) return false;
        }

        // Status
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;

        // Traveler type
        if (typeFilter !== 'all' && t.traveler_type !== typeFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-asc') {
          const dA = a.start_date ? new Date(a.start_date).getTime() : Infinity;
          const dB = b.start_date ? new Date(b.start_date).getTime() : Infinity;
          return dA - dB;
        }
        if (sortBy === 'date-desc') {
          const dA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dB - dA;
        }
        if (sortBy === 'budget-desc') {
          return (b.budget_total || 0) - (a.budget_total || 0);
        }
        if (sortBy === 'name') {
          return a.destination.localeCompare(b.destination);
        }
        return 0;
      });
  }, [trips, searchQuery, statusFilter, typeFilter, sortBy]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleDuplicate = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      await createTrip.mutateAsync({
        title: `${trip.title} (Copy)`,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        num_travelers: trip.num_travelers,
        traveler_type: trip.traveler_type,
        budget_total: trip.budget_total,
        budget_level: trip.budget_level,
        pace: trip.pace,
        interests: trip.interests,
        accommodation_pref: trip.accommodation_pref,
        transport_pref: trip.transport_pref,
        status: 'draft',
      });
      success('Trip duplicated', `Created a copy of ${trip.destination}`);
    } catch {
      showError('Failed to duplicate', 'Please try again.');
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newStatus: TripStatus = trip.status === 'archived' ? 'draft' : 'archived';
    try {
      await updateTrip.mutateAsync({
        id: trip.id,
        data: { status: newStatus },
      });
      success(
        newStatus === 'archived' ? 'Trip archived' : 'Trip restored',
        `Moved to ${newStatus}`
      );
    } catch {
      showError('Error updating trip', 'Please try again.');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!tripToDelete) return;
    try {
      await deleteTrip.mutateAsync(tripToDelete.id);
      success('Trip deleted', `${tripToDelete.title} was removed.`);
      setTripToDelete(null);
    } catch {
      showError('Failed to delete', 'Could not remove this trip.');
    }
  };

  return (
    <div
      className="max-w-7xl mx-auto space-y-8 pb-12"
      onClick={() => setActiveMenuId(null)}
    >
      {/* ─── Header & Top Actions ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Welcome back, {userName}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Sparkles size={11} /> AI Planner
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Track your journeys, budgets, and personalized itineraries in one place.
          </p>
        </div>

        <Button
          onClick={() => navigate('/trips/new')}
          variant="gradient"
          leftIcon={<Plus size={16} />}
          className="shadow-lg shadow-brand-500/20 self-start sm:self-auto"
        >
          Plan New Trip
        </Button>
      </div>

      {/* ─── Metric Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} variant="glass" padding="md" className="space-y-2">
              <Skeleton variant="line" className="h-3 w-1/2" />
              <Skeleton variant="line" className="h-7 w-3/4" />
            </Card>
          ))
        ) : (
          <>
            <Card variant="glass" padding="md" className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Trips
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                    {metrics.totalTrips}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                  <Compass size={22} />
                </div>
              </div>
            </Card>

            <Card variant="glass" padding="md" className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Upcoming Trips
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                    {metrics.upcomingTrips}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                  <Calendar size={22} />
                </div>
              </div>
            </Card>

            <Card variant="glass" padding="md" className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Estimated Spend
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                    ${metrics.totalSpend.toLocaleString()}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <DollarSign size={22} />
                </div>
              </div>
            </Card>

            <Card variant="glass" padding="md" className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Destinations Explored
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                    {metrics.uniqueDestinations}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Globe size={22} />
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ─── Hero Card: Next Upcoming Trip ────────────────────────────────── */}
      {isLoading ? (
        <Card variant="glass" padding="lg">
          <div className="space-y-4">
            <Skeleton variant="line" className="h-5 w-1/4" />
            <Skeleton variant="line" className="h-8 w-1/2" />
            <Skeleton variant="line" className="h-4 w-3/4" />
          </div>
        </Card>
      ) : upcomingHeroTrip ? (
        (() => {
          const countdown = getDaysUntil(upcomingHeroTrip.start_date);
          const gradient = getCoverGradient(upcomingHeroTrip.destination);

          return (
            <div
              onClick={() => navigate(`/trips/${upcomingHeroTrip.id}`)}
              className="relative overflow-hidden rounded-3xl border border-slate-700/60 shadow-2xl group cursor-pointer transition-all duration-300 hover:border-slate-500/70"
            >
              {/* Background gradient banner */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-20 group-hover:opacity-25 transition-opacity`}
              />
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

              <div className="relative p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      <Clock size={12} />
                      {countdown.text}
                    </span>
                    <Badge variant="primary" dot>
                      Next Upcoming Adventure
                    </Badge>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {upcomingHeroTrip.destination}
                    </h2>
                    <p className="text-slate-300 text-sm font-medium mt-1">
                      {upcomingHeroTrip.title}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-brand-400" />
                      {formatDateRange(upcomingHeroTrip.start_date, upcomingHeroTrip.end_date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {getTravelerIcon(upcomingHeroTrip.traveler_type)}
                      <span className="capitalize">{upcomingHeroTrip.traveler_type}</span> ({upcomingHeroTrip.num_travelers})
                    </span>
                    {upcomingHeroTrip.budget_total && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign size={13} className="text-emerald-400" />
                        ${upcomingHeroTrip.budget_total.toLocaleString()} budget
                      </span>
                    )}
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {upcomingHeroTrip.pace} pace
                    </span>
                  </div>

                  {upcomingHeroTrip.interests && upcomingHeroTrip.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {upcomingHeroTrip.interests.slice(0, 4).map((interest, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-300 font-medium"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center md:flex-col md:items-end justify-between gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-left md:text-right">
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Itinerary Status</p>
                    <p className="text-sm font-bold text-slate-200 capitalize">
                      {upcomingHeroTrip.status}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<ArrowRight size={15} />}
                    className="shadow-lg shadow-brand-500/20 group-hover:translate-x-1 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/trips/${upcomingHeroTrip.id}`);
                    }}
                  >
                    Open Itinerary
                  </Button>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}

      {/* ─── Error State Banner ───────────────────────────────────────────── */}
      {isError && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-5 flex items-center justify-between text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Failed to load itineraries</p>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Check that your backend connection is running and retry.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RotateCcw size={13} />}
            onClick={() => refetch()}
            className="border-rose-500/40 hover:bg-rose-500/15 text-rose-200"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ─── Trip List Section ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section Header & Search/Filters Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-100">All Journeys</h2>
            <Badge variant="outline" size="sm">
              {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </Badge>
          </div>

          {/* Search, Filter, Sort Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="w-full sm:w-56">
              <Input
                placeholder="Search trips or cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
                className="py-1.5 text-xs bg-slate-900/60"
              />
            </div>

            {/* Status Filter */}
            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'generated', label: 'Generated' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ]}
                className="py-1.5 text-xs bg-slate-900/60"
              />
            </div>

            {/* Traveler Type Filter */}
            <div className="w-36">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'solo', label: 'Solo' },
                  { value: 'couple', label: 'Couple' },
                  { value: 'group', label: 'Group' },
                ]}
                className="py-1.5 text-xs bg-slate-900/60"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="w-40">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                options={[
                  { value: 'date-asc', label: 'Departure Date' },
                  { value: 'date-desc', label: 'Recently Added' },
                  { value: 'budget-desc', label: 'Highest Budget' },
                  { value: 'name', label: 'Destination (A-Z)' },
                ]}
                className="py-1.5 text-xs bg-slate-900/60"
              />
            </div>
          </div>
        </div>

        {/* ─── Grid of Trip Cards ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} variant="glass" padding="none" className="overflow-hidden space-y-4 p-5">
                <Skeleton variant="rect" className="h-28 w-full -mx-5 -mt-5 mb-4" />
                <Skeleton variant="line" className="h-5 w-3/4" />
                <Skeleton variant="line" className="h-3.5 w-1/2" />
                <div className="flex gap-2 pt-2">
                  <Skeleton variant="rect" className="h-6 w-16 rounded-full" />
                  <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <EmptyState
            icon={<Compass size={32} />}
            title={
              searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No matching trips found'
                : 'Plan your first trip'
            }
            description={
              searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try tweaking your filters or search keywords to find what you are looking for.'
                : 'Your passport to intelligent travel begins here. Let our local AI planner engineer your dream itinerary in seconds.'
            }
            action={
              searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                    },
                  }
                : {
                    label: 'Plan Your First Trip',
                    onClick: () => navigate('/trips/new'),
                    icon: <Plus size={15} />,
                  }
            }
          />
        ) : (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => {
              const coverGrad = getCoverGradient(trip.destination);
              const isMenuOpen = activeMenuId === trip.id;

              return (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="group relative flex flex-col justify-between rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 shadow-xl hover:shadow-2xl transition-all duration-200 overflow-hidden cursor-pointer"
                >
                  {/* Visual Scenic Cover Banner */}
                  <div
                    className={`h-24 w-full bg-gradient-to-r ${coverGrad} relative p-3 flex items-start justify-between`}
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold border border-white/10">
                      <MapPin size={11} className="text-white/80" />
                      <span className="truncate max-w-[150px]">{trip.destination}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          trip.status === 'generated'
                            ? 'success'
                            : trip.status === 'draft'
                            ? 'warning'
                            : 'outline'
                        }
                        dot
                        size="sm"
                        className="bg-black/50 backdrop-blur-md border-white/20 capitalize"
                      >
                        {trip.status}
                      </Badge>

                      {/* Dropdown Menu Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : trip.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors border border-white/10"
                          aria-label="Trip actions"
                        >
                          <MoreVertical size={13} />
                        </button>

                        {/* Action Menu Dropdown */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <button
                              onClick={() => navigate(`/trips/${trip.id}`)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <ExternalLink size={13} className="text-slate-400" />
                              Open Itinerary
                            </button>

                            <button
                              onClick={(e) => handleDuplicate(e, trip)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <Copy size={13} className="text-slate-400" />
                              Duplicate Trip
                            </button>

                            <button
                              onClick={(e) => handleToggleArchive(e, trip)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <Archive size={13} className="text-slate-400" />
                              {trip.status === 'archived' ? 'Restore Trip' : 'Archive Trip'}
                            </button>

                            <div className="my-1 border-t border-slate-800" />

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                setTripToDelete(trip);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 size={13} />
                              Delete Trip
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-100 text-base leading-snug group-hover:text-brand-300 transition-colors truncate">
                        {trip.title}
                      </h3>

                      <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                        <Calendar size={12} className="text-slate-500 flex-shrink-0" />
                        <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                      </p>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 text-[11px] font-medium text-slate-300">
                        {getTravelerIcon(trip.traveler_type)}
                        <span className="capitalize">{trip.traveler_type}</span>
                      </span>

                      {trip.budget_total ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-slate-800/80 text-[11px] font-medium text-slate-300">
                          <DollarSign size={11} className="text-emerald-400" />
                          ${trip.budget_total.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-400 capitalize">
                          {trip.budget_level}
                        </span>
                      )}

                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-400 capitalize">
                        {trip.pace}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Delete Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(tripToDelete)}
        onClose={() => setTripToDelete(null)}
        title="Delete Itinerary"
        description="Are you sure you want to permanently delete this trip? All saved days, activities, and notes will be removed."
      >
        {tripToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase">Trip to delete</p>
              <p className="text-base font-bold text-slate-100 mt-0.5">{tripToDelete.title}</p>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin size={12} className="text-brand-400" />
                {tripToDelete.destination}
              </p>
            </div>

            <ModalFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTripToDelete(null)}
                disabled={deleteTrip.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteTrip.isPending}
                leftIcon={<Trash2 size={14} />}
                onClick={handleDeleteConfirmed}
              >
                Delete Trip
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
};
