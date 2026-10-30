import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  MapPin,
  Calendar,
  DollarSign,
  User,
  Users,
  Heart,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { useCreateTrip, useGenerateItinerary } from '../hooks/useTrips';
import { useToast } from '../hooks/useToast';
import type { TravelerType, BudgetLevel, Pace, TripInsert } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

// ─── Zod Schemas per Step ────────────────────────────────────────────────────

const step1Schema = z
  .object({
    destination: z.string().trim().min(2, 'Please enter a valid destination city or region.'),
    start_date: z.string().min(1, 'Departure date is required.'),
    end_date: z.string().min(1, 'Return date is required.'),
    title: z.string().trim().min(2, 'Trip title must be at least 2 characters.'),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.end_date) return true;
      return new Date(data.end_date) >= new Date(data.start_date);
    },
    {
      message: 'Return date cannot be earlier than departure date.',
      path: ['end_date'],
    }
  );

const step2Schema = z.object({
  traveler_type: z.enum(['solo', 'couple', 'group'] as const),
  num_travelers: z.number().int().min(1, 'Must have at least 1 traveler.'),
});

const step3Schema = z.object({
  budget_total: z.number().positive('Budget must be greater than 0.'),
  budget_level: z.enum(['budget', 'mid', 'premium'] as const),
  currency: z.string().min(1),
});

const step4Schema = z.object({
  pace: z.enum(['relaxed', 'balanced', 'packed'] as const),
  interests: z.array(z.string()).min(1, 'Select at least one travel interest.'),
  accommodation_pref: z.string().min(1, 'Please select accommodation preference.'),
  transport_pref: z.string().min(1, 'Please select transport preference.'),
});

// ─── Constants & Options ─────────────────────────────────────────────────────

const DRAFT_STORAGE_KEY = 'wandr_smart_trip_draft_v1';

const INTEREST_OPTIONS = [
  { id: 'food', label: 'Food & Dining', emoji: '🍜' },
  { id: 'sightseeing', label: 'Sightseeing', emoji: '🏛️' },
  { id: 'adventure', label: 'Adventure', emoji: '🧗' },
  { id: 'culture', label: 'Culture & Art', emoji: '🎨' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🍸' },
  { id: 'nature', label: 'Nature & Parks', emoji: '🌲' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'relaxation', label: 'Relaxation', emoji: '🧘' },
  { id: 'romantic', label: 'Romantic Spots', emoji: '💖' },
];

const ACCOMMODATION_OPTIONS = [
  { value: 'Boutique Hotel', label: 'Boutique Hotel (Charming & unique)' },
  { value: 'Vacation Rental / Apartment', label: 'Apartment / AirBnb (Local feel & kitchen)' },
  { value: 'Luxury Resort & Spa', label: 'Luxury Resort (Full-service & high-end)' },
  { value: 'Budget Hostel / Guesthouse', label: 'Hostel / Budget Stay (Social & economical)' },
  { value: 'Historic Inn / Heritage Stay', label: 'Historic Inn / Traditional Ryokan' },
];

const TRANSPORT_OPTIONS = [
  { value: 'Public Transit & Walking', label: 'Walking & Metro / Bus (Eco-friendly & central)' },
  { value: 'Rental Car', label: 'Rental Car (Road trip & countryside flexibility)' },
  { value: 'Rideshare & Taxis', label: 'Rideshare / Taxis (Door-to-door convenience)' },
  { value: 'High-Speed Rail & Trains', label: 'High-Speed Trains (Inter-city scenic rail)' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'INR', label: 'INR (₹)' },
];

// Presets data
interface Preset {
  name: string;
  badge: string;
  destination: string;
  title: string;
  durationDays: number;
  traveler_type: TravelerType;
  num_travelers: number;
  budget_total: number;
  budget_level: BudgetLevel;
  pace: Pace;
  interests: string[];
  accommodation_pref: string;
  transport_pref: string;
}

const PRESETS: Preset[] = [
  {
    name: 'Weekend Getaway',
    badge: 'Solo',
    destination: 'San Francisco, CA',
    title: 'San Francisco Fog & Flavors',
    durationDays: 3,
    traveler_type: 'solo',
    num_travelers: 1,
    budget_total: 900,
    budget_level: 'mid',
    pace: 'balanced',
    interests: ['food', 'sightseeing', 'culture'],
    accommodation_pref: 'Boutique Hotel',
    transport_pref: 'Public Transit & Walking',
  },
  {
    name: 'Romantic Escape',
    badge: 'Couple',
    destination: 'Florence, Italy',
    title: 'Tuscan Sunset Romance',
    durationDays: 5,
    traveler_type: 'couple',
    num_travelers: 2,
    budget_total: 3400,
    budget_level: 'premium',
    pace: 'relaxed',
    interests: ['romantic', 'food', 'culture', 'relaxation'],
    accommodation_pref: 'Boutique Hotel',
    transport_pref: 'Public Transit & Walking',
  },
  {
    name: 'Friends Adventure',
    badge: 'Group',
    destination: 'Tokyo, Japan',
    title: 'Tokyo Neon & Shrines Expedition',
    durationDays: 7,
    traveler_type: 'group',
    num_travelers: 4,
    budget_total: 5800,
    budget_level: 'mid',
    pace: 'packed',
    interests: ['adventure', 'food', 'nightlife', 'culture', 'shopping'],
    accommodation_pref: 'Vacation Rental / Apartment',
    transport_pref: 'High-Speed Rail & Trains',
  },
];

// ─── Default Form State ──────────────────────────────────────────────────────

function getInitialDates() {
  const start = new Date();
  start.setDate(start.getDate() + 14); // 2 weeks out
  const end = new Date(start);
  end.setDate(end.getDate() + 4); // 5 days total

  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
}

interface FormData {
  destination: string;
  title: string;
  start_date: string;
  end_date: string;
  traveler_type: TravelerType;
  num_travelers: number;
  budget_total: number;
  budget_level: BudgetLevel;
  currency: string;
  pace: Pace;
  interests: string[];
  accommodation_pref: string;
  transport_pref: string;
  additional_notes: string;
}

const defaultFormData: FormData = {
  destination: '',
  title: '',
  ...getInitialDates(),
  traveler_type: 'couple',
  num_travelers: 2,
  budget_total: 2500,
  budget_level: 'mid',
  currency: 'USD',
  pace: 'balanced',
  interests: ['food', 'sightseeing', 'culture'],
  accommodation_pref: 'Boutique Hotel',
  transport_pref: 'Public Transit & Walking',
  additional_notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const NewTripPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const createTrip = useCreateTrip();
  const generateItinerary = useGenerateItinerary();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return { ...defaultFormData, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return defaultFormData;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasCustomTitle, setHasCustomTitle] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatusIndex, setGenerationStatusIndex] = useState(0);

  // Auto-save draft
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch {
      // ignore
    }
  }, [formData]);

  // Animated generation progress ticker
  const generationMessages = useMemo(
    () => [
      `Connecting to local AI travel expert for ${formData.destination || 'your destination'}...`,
      'Surveying iconic landmarks, hidden local spots, and scenic viewpoints...',
      'Clustering nearby attractions into smart daily geographic zones...',
      'Curating authentic breakfast, lunch, and dinner food scenes...',
      `Enforcing your ${formData.budget_level} budget & pace constraints...`,
      'Finalizing your hour-by-hour cohesive itinerary schedule...',
    ],
    [formData.destination, formData.budget_level]
  );

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setGenerationStatusIndex((prev) => (prev + 1) % generationMessages.length);
    }, 2800);

    const progressTimer = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + Math.floor(Math.random() * 8) + 4;
      });
    }, 500);

    return () => {
      clearInterval(interval);
      clearInterval(progressTimer);
    };
  }, [isGenerating, generationMessages.length]);

  // Auto-update trip title if user hasn't explicitly customized it
  const handleDestinationChange = (dest: string) => {
    setFormData((prev) => {
      const updated: FormData = { ...prev, destination: dest };
      if (!hasCustomTitle && dest.trim()) {
        const cleanDest = dest.split(',')[0].trim();
        updated.title = `${cleanDest} Discovery`;
      }
      return updated;
    });
    if (errors.destination) {
      setErrors((prev) => ({ ...prev, destination: '' }));
    }
  };

  // Duration in days calculation
  const tripDurationDays = useMemo(() => {
    if (!formData.start_date || !formData.end_date) return 1;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [formData.start_date, formData.end_date]);

  // Apply a preset
  const handleApplyPreset = (preset: Preset) => {
    const start = new Date();
    start.setDate(start.getDate() + 14);
    const end = new Date(start);
    end.setDate(end.getDate() + preset.durationDays - 1);

    setFormData({
      ...formData,
      destination: preset.destination,
      title: preset.title,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      traveler_type: preset.traveler_type,
      num_travelers: preset.num_travelers,
      budget_total: preset.budget_total,
      budget_level: preset.budget_level,
      pace: preset.pace,
      interests: preset.interests,
      accommodation_pref: preset.accommodation_pref,
      transport_pref: preset.transport_pref,
    });
    setHasCustomTitle(true);
    setErrors({});
    success('Preset Applied', `Loaded "${preset.name}" template`);
  };

  // Toggle interest
  const toggleInterest = (id: string) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(id);
      const updated = exists
        ? prev.interests.filter((item) => item !== id)
        : [...prev.interests, id];
      return { ...prev, interests: updated };
    });
    if (errors.interests) {
      setErrors((prev) => ({ ...prev, interests: '' }));
    }
  };

  // Step validation
  const validateCurrentStep = (): boolean => {
    setErrors({});

    if (currentStep === 1) {
      const result = step1Schema.safeParse({
        destination: formData.destination,
        start_date: formData.start_date,
        end_date: formData.end_date,
        title: formData.title,
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      const result = step2Schema.safeParse({
        traveler_type: formData.traveler_type,
        num_travelers: formData.num_travelers,
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      const result = step3Schema.safeParse({
        budget_total: Number(formData.budget_total),
        budget_level: formData.budget_level,
        currency: formData.currency,
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      const result = step4Schema.safeParse({
        pace: formData.pace,
        interests: formData.interests,
        accommodation_pref: formData.accommodation_pref,
        transport_pref: formData.transport_pref,
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setFormData(defaultFormData);
    setCurrentStep(1);
    setErrors({});
    success('Draft Cleared', 'Reset to clean template.');
  };

  // Submit and Generate
  const handleGenerate = async () => {
    if (!validateCurrentStep()) return;

    setIsGenerating(true);
    setGenerationProgress(10);
    setGenerationStatusIndex(0);

    try {
      // 1. Create Trip Record
      const tripInsertPayload: TripInsert = {
        title: formData.title.trim(),
        destination: formData.destination.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        num_travelers: formData.num_travelers,
        traveler_type: formData.traveler_type,
        budget_total: Number(formData.budget_total),
        budget_level: formData.budget_level,
        pace: formData.pace,
        interests: formData.interests,
        accommodation_pref: formData.accommodation_pref,
        transport_pref: formData.transport_pref,
        status: 'draft',
      };

      const newTrip = await createTrip.mutateAsync(tripInsertPayload);

      // Parse additional notes for must_include or avoid constraints if provided
      let must_include: string[] | undefined = undefined;
      let avoid: string[] | undefined = undefined;

      if (formData.additional_notes.trim()) {
        must_include = [formData.additional_notes.trim()];
      }

      // 2. Trigger AI Generation
      await generateItinerary.mutateAsync({
        tripId: newTrip.id,
        constraints: {
          must_include,
          avoid,
        },
      });

      // Clear draft on success
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setGenerationProgress(100);

      // Brief pause to show completion before navigation
      setTimeout(() => {
        success('Itinerary Ready!', `Generated trip for ${newTrip.destination}`);
        navigate(`/trips/${newTrip.id}`);
      }, 700);
    } catch (err: unknown) {
      setIsGenerating(false);
      showError(
        'Generation Failed',
        err instanceof Error ? err.message : 'Could not generate itinerary. Please try again.'
      );
    }
  };

  // ─── Step Steps Definitions ────────────────────────────────────────────────

  const steps = [
    { number: 1, title: 'Basics' },
    { number: 2, title: 'Travelers' },
    { number: 3, title: 'Budget' },
    { number: 4, title: 'Style' },
    { number: 5, title: 'Review' },
  ];

  // ─── Render Generating Loading State ───────────────────────────────────────

  if (isGenerating) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-7">
          {/* Pulsing AI Compass Visual */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-violet-600/30 animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-2xl shadow-brand-500/50">
              <Sparkles size={30} className="animate-spin text-white duration-1000" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-100">
              Crafting your {formData.destination || 'dream'} itinerary
            </h2>
            <p className="text-sm text-brand-300 font-medium h-6 transition-all duration-300">
              {generationMessages[generationStatusIndex]}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 max-w-md mx-auto">
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-violet-400 transition-all duration-300 shadow-sm shadow-brand-400"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Gemini Pro Travel Engine</span>
              <span>{generationProgress}% complete</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 max-w-sm mx-auto text-left space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between text-slate-400">
              <span>Duration</span>
              <span className="text-slate-200 font-medium">{tripDurationDays} Days</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Traveler Type</span>
              <span className="text-slate-200 font-medium capitalize">
                {formData.traveler_type} ({formData.num_travelers})
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Pace</span>
              <span className="text-slate-200 font-medium capitalize">{formData.pace}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Normal Wizard Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* ─── Header & Presets Bar ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Smart Trip Builder
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Design your personalized journey in 5 simple steps.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearDraft}
            className="self-start sm:self-auto text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> Clear draft
          </button>
        </div>

        {/* Quick Presets Shortcuts */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
            <Zap size={13} className="text-amber-400" /> Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors hover:border-brand-500/40"
              >
                <span>{p.name}</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-slate-700 text-brand-300">
                  {p.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Stepper Progress Indicator ────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center justify-between relative">
          {/* Line behind steps */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand-500 transition-all duration-300 -z-0"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 88}%` }}
          />

          {steps.map((s) => {
            const isCompleted = currentStep > s.number;
            const isCurrent = currentStep === s.number;

            return (
              <button
                key={s.number}
                type="button"
                onClick={() => {
                  if (s.number < currentStep) setCurrentStep(s.number);
                }}
                disabled={s.number > currentStep}
                className="relative z-10 flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 ${
                    isCompleted
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                      : isCurrent
                      ? 'bg-slate-900 text-brand-400 border-2 border-brand-500 shadow-md shadow-brand-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isCompleted ? <Check size={14} /> : s.number}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-semibold transition-colors hidden sm:block ${
                    isCurrent ? 'text-brand-300' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Wizard Step Body ──────────────────────────────────────────────── */}
      <Card variant="glass" padding="lg" className="border-slate-800/90 shadow-2xl">
        {/* ─── STEP 1: BASICS ────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Where and when are you going?</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your target destination and departure dates.
              </p>
            </div>

            <div className="space-y-4">
              {/* Destination */}
              <div>
                <Input
                  id="destination-input"
                  label="Destination"
                  placeholder="e.g. Barcelona, Spain or Kyoto, Japan"
                  value={formData.destination}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  leftIcon={<MapPin size={16} />}
                  error={errors.destination}
                  autoFocus
                />
                {/* Popular pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500 py-0.5">Popular:</span>
                  {['Tokyo, Japan', 'Paris, France', 'Rome, Italy', 'New York, USA', 'Reykjavik, Iceland'].map(
                    (city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => handleDestinationChange(city)}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors"
                      >
                        {city}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="start-date-input"
                  type="date"
                  label="Departure Date"
                  value={formData.start_date}
                  onChange={(e) => {
                    setFormData({ ...formData, start_date: e.target.value });
                    if (errors.start_date) setErrors((prev) => ({ ...prev, start_date: '' }));
                  }}
                  leftIcon={<Calendar size={15} />}
                  error={errors.start_date}
                />

                <Input
                  id="end-date-input"
                  type="date"
                  label="Return Date"
                  value={formData.end_date}
                  onChange={(e) => {
                    setFormData({ ...formData, end_date: e.target.value });
                    if (errors.end_date) setErrors((prev) => ({ ...prev, end_date: '' }));
                  }}
                  leftIcon={<Calendar size={15} />}
                  error={errors.end_date}
                  helperText={`${tripDurationDays} ${tripDurationDays === 1 ? 'day' : 'days'} duration`}
                />
              </div>

              {/* Trip Title */}
              <Input
                id="trip-title-input"
                label="Itinerary Title"
                placeholder="e.g. Mediterranean Culinary Tour"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  setHasCustomTitle(true);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                }}
                error={errors.title}
              />
            </div>
          </div>
        )}

        {/* ─── STEP 2: TRAVELERS ─────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Who is traveling?</h2>
              <p className="text-xs text-slate-400 mt-1">
                Our local AI tailors schedule pacing, cost-splitting, and venue atmospheres to match your party.
              </p>
            </div>

            {/* Traveler Type Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                {
                  type: 'solo' as const,
                  title: 'Solo Explorer',
                  tagline: 'Fast-paced, safe, walk-tours & cozy spots',
                  icon: <User size={22} className="text-blue-400" />,
                  defaultCount: 1,
                },
                {
                  type: 'couple' as const,
                  title: 'Couple Getaway',
                  tagline: 'Scenic vistas, romantic dining & flexible pacing',
                  icon: <Heart size={22} className="text-rose-400" />,
                  defaultCount: 2,
                },
                {
                  type: 'group' as const,
                  title: 'Group Adventure',
                  tagline: 'Split-costs, shared tables & diverse interests',
                  icon: <Users size={22} className="text-amber-400" />,
                  defaultCount: 4,
                },
              ].map((card) => {
                const isSelected = formData.traveler_type === card.type;

                return (
                  <div
                    key={card.type}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        traveler_type: card.type,
                        num_travelers:
                          card.type === 'solo' ? 1 : card.type === 'couple' ? 2 : Math.max(formData.num_travelers, 3),
                      });
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 shadow-lg shadow-brand-500/15'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center mb-3">
                        {card.icon}
                      </div>
                      <h3 className="font-bold text-slate-100 text-sm">{card.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{card.tagline}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>Default: {card.defaultCount}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Group Size Stepper */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Number of Travelers
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={formData.traveler_type === 'solo' || formData.num_travelers <= 1}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      num_travelers: Math.max(1, prev.num_travelers - 1),
                    }))
                  }
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  -
                </button>

                <div className="w-20 text-center font-mono font-bold text-lg text-slate-100 py-2 rounded-xl bg-slate-900 border border-slate-700">
                  {formData.num_travelers}
                </div>

                <button
                  type="button"
                  disabled={formData.traveler_type === 'solo'}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      num_travelers: prev.num_travelers + 1,
                    }))
                  }
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  +
                </button>

                <span className="text-xs text-slate-400 ml-2">
                  {formData.traveler_type === 'solo'
                    ? 'Solo trips are fixed at 1 traveler'
                    : formData.traveler_type === 'couple'
                    ? 'Couple trips default to 2'
                    : 'Groups can scale to any party size'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: BUDGET ────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">What is your target budget?</h2>
              <p className="text-xs text-slate-400 mt-1">
                The planner estimates attraction tickets, dining, and transit to guarantee your total spend stays on target.
              </p>
            </div>

            {/* Currency & Total */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <Select
                  label="Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  options={CURRENCIES}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  id="budget-total-input"
                  type="number"
                  label="Total Estimated Budget"
                  value={formData.budget_total}
                  onChange={(e) => {
                    setFormData({ ...formData, budget_total: Number(e.target.value) });
                    if (errors.budget_total) setErrors((prev) => ({ ...prev, budget_total: '' }));
                  }}
                  leftIcon={<DollarSign size={15} />}
                  error={errors.budget_total}
                  helperText={`Approx. $${Math.round(
                    (formData.budget_total || 0) / (tripDurationDays * formData.num_travelers)
                  )} per person / day`}
                />
              </div>
            </div>

            {/* Budget Tier Cards */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Budget Level Tier
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    level: 'budget' as const,
                    title: 'Budget Smart',
                    desc: 'Street food, hostels, public metro, and low-cost or free activities.',
                  },
                  {
                    level: 'mid' as const,
                    title: 'Mid-Range',
                    desc: 'Comfortable 3-4★ hotels, casual sit-down dinners, and balanced ticket admission.',
                  },
                  {
                    level: 'premium' as const,
                    title: 'Luxury / Premium',
                    desc: '5★ luxury stays, fine dining, private drivers, and exclusive experiences.',
                  },
                ].map((tier) => {
                  const isSelected = formData.budget_level === tier.level;

                  return (
                    <div
                      key={tier.level}
                      onClick={() => setFormData({ ...formData, budget_level: tier.level })}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-500/10 border-brand-500 text-slate-100 shadow-lg shadow-brand-500/15'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-200">{tier.title}</span>
                        {isSelected && <Check size={14} className="text-brand-400" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{tier.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 4: STYLE & PREFERENCES ───────────────────────────────── */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Trip Style & Preferences</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select your pacing, primary interests, and preferred travel logistics.
              </p>
            </div>

            {/* Pace Slider / Segmented Buttons */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Itinerary Pacing
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { pace: 'relaxed' as const, label: 'Relaxed', desc: '2–3 activities/day' },
                  { pace: 'balanced' as const, label: 'Balanced', desc: '4 activities/day' },
                  { pace: 'packed' as const, label: 'Packed', desc: '5–6 activities/day' },
                ].map((p) => {
                  const isSelected = formData.pace === p.pace;
                  return (
                    <button
                      key={p.pace}
                      type="button"
                      onClick={() => setFormData({ ...formData, pace: p.pace })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-brand-500/15 border-brand-500 text-brand-300 shadow-md shadow-brand-500/15'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-bold text-sm text-slate-100">{p.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interest Chips */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Interests & Focus Areas (Pick 1 or more)
              </label>
              {errors.interests && (
                <p className="text-xs text-rose-400 font-medium">{errors.interests}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {INTEREST_OPTIONS.map((item) => {
                  const isSelected = formData.interests.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleInterest(item.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-brand-500/20 border-brand-500 text-brand-200 shadow-md shadow-brand-500/15'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accommodation & Transport */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Select
                label="Accommodation Style"
                value={formData.accommodation_pref}
                onChange={(e) => setFormData({ ...formData, accommodation_pref: e.target.value })}
                options={ACCOMMODATION_OPTIONS}
              />

              <Select
                label="Transport Mode"
                value={formData.transport_pref}
                onChange={(e) => setFormData({ ...formData, transport_pref: e.target.value })}
                options={TRANSPORT_OPTIONS}
              />
            </div>
          </div>
        )}

        {/* ─── STEP 5: REVIEW & GENERATE ─────────────────────────────────── */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Review & Generate Itinerary</h2>
              <p className="text-xs text-slate-400 mt-1">
                Double-check your parameters before our AI planner generates your complete schedule.
              </p>
            </div>

            {/* Summary Grid */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 space-y-4">
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-100">{formData.title}</h3>
                  <p className="text-xs text-brand-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {formData.destination}
                  </p>
                </div>
                <Badge variant="primary" dot>
                  {tripDurationDays} Days
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Dates</p>
                  <p className="text-slate-200 font-medium mt-0.5">
                    {formData.start_date} – {formData.end_date}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Party Size</p>
                  <p className="text-slate-200 font-medium capitalize mt-0.5">
                    {formData.traveler_type} ({formData.num_travelers} {formData.num_travelers === 1 ? 'person' : 'people'})
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Total Budget</p>
                  <p className="text-emerald-400 font-bold mt-0.5">
                    ${formData.budget_total.toLocaleString()} {formData.currency}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Pacing</p>
                  <p className="text-slate-200 font-medium capitalize mt-0.5">{formData.pace}</p>
                </div>

                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Stay Style</p>
                  <p className="text-slate-200 font-medium mt-0.5 truncate">{formData.accommodation_pref}</p>
                </div>

                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">Transport</p>
                  <p className="text-slate-200 font-medium mt-0.5 truncate">{formData.transport_pref}</p>
                </div>
              </div>

              {/* Interests tag list */}
              <div className="pt-2 border-t border-slate-800">
                <p className="text-slate-500 font-semibold uppercase text-[10px] mb-1.5">
                  Selected Interests
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {formData.interests.map((int) => (
                    <span
                      key={int}
                      className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium capitalize"
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional Anything Else Textarea */}
            <div className="space-y-1.5">
              <label
                htmlFor="notes-textarea"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Anything else? (Optional)
              </label>
              <textarea
                id="notes-textarea"
                rows={3}
                placeholder="Specific bucket list places to include (e.g. 'Must visit Louvre on Day 2'), dietary needs, or areas to avoid..."
                value={formData.additional_notes}
                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs p-3 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        )}

        {/* ─── Navigation Buttons ────────────────────────────────────────── */}
        <div className="mt-8 pt-5 border-t border-slate-800/80 flex items-center justify-between">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={handleBack}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight size={14} />}
              onClick={handleNext}
            >
              Next Step
            </Button>
          ) : (
            <Button
              type="button"
              variant="gradient"
              size="md"
              leftIcon={<Sparkles size={16} />}
              onClick={handleGenerate}
              className="shadow-lg shadow-brand-500/25"
            >
              Generate Itinerary
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
