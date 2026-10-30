// ==============================================================================
// Database & Domain Model TypeScript Definitions
// Matches Supabase Schema: 20261029000001_initial_schema.sql
// ==============================================================================

export type TravelerType = 'solo' | 'couple' | 'group';
export type BudgetLevel = 'budget' | 'mid' | 'premium';
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type TripStatus = 'draft' | 'generated' | 'archived';
export type TripRole = 'owner' | 'editor' | 'viewer';
export type ItineraryItemType = 
  | 'attraction' 
  | 'dining' 
  | 'accommodation' 
  | 'transport' 
  | 'activity';

// ------------------------------------------------------------------------------
// Profiles Table
// ------------------------------------------------------------------------------
export interface Profile {
  id: string; // references auth.users(id)
  email?: string | null;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

// ------------------------------------------------------------------------------
// Trips Table
// ------------------------------------------------------------------------------
export interface Trip {
  id: string;
  owner_id: string;
  title: string;
  destination: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  num_travelers: number;
  traveler_type: TravelerType;
  budget_total: number | null;
  budget_level: BudgetLevel;
  pace: Pace;
  interests: string[];
  accommodation_pref: string | null;
  transport_pref: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export type TripInsert = Omit<Trip, 'id' | 'owner_id' | 'created_at' | 'updated_at'> & {
  owner_id?: string;
};

export type TripUpdate = Partial<Omit<Trip, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>;

// ------------------------------------------------------------------------------
// Trip Members Table
// ------------------------------------------------------------------------------
export interface TripMember {
  trip_id: string;
  user_id: string;
  role: TripRole;
  joined_at: string;
  profile?: Profile;
}

export type TripMemberInsert = Omit<TripMember, 'joined_at' | 'profile'>;

// ------------------------------------------------------------------------------
// Itinerary Days Table
// ------------------------------------------------------------------------------
export interface ItineraryDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string; // YYYY-MM-DD
  summary: string | null;
  estimated_cost: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export type ItineraryDayInsert = Omit<ItineraryDay, 'id' | 'created_at' | 'updated_at'>;
export type ItineraryDayUpdate = Partial<Omit<ItineraryDay, 'id' | 'trip_id' | 'created_at' | 'updated_at'>>;

// ------------------------------------------------------------------------------
// Itinerary Items Table
// ------------------------------------------------------------------------------
export interface ItineraryItem {
  id: string;
  day_id: string;
  order_index: number;
  type: ItineraryItemType;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;   // HH:MM:SS
  estimated_cost: number;
  notes: string | null;
  is_locked: boolean;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  user_vote?: number | null;
  created_at: string;
  updated_at: string;
}

export type ItineraryItemInsert = Omit<ItineraryItem, 'id' | 'created_at' | 'updated_at' | 'upvotes' | 'downvotes' | 'score' | 'user_vote'>;
export type ItineraryItemUpdate = Partial<Omit<ItineraryItem, 'id' | 'day_id' | 'created_at' | 'updated_at' | 'upvotes' | 'downvotes' | 'score' | 'user_vote'>>;

// ------------------------------------------------------------------------------
// Group Collaboration & Preferences
// ------------------------------------------------------------------------------
export interface MemberPreference {
  trip_id: string;
  user_id: string;
  user_email?: string | null;
  user_name?: string | null;
  interests: string[];
  budget_cap?: number | null;
  notes?: string | null;
  updated_at: string;
}

export interface GroupPreferencesSummary {
  trip_id: string;
  preferences: MemberPreference[];
  merged_interests: string[];
  effective_budget_cap?: number | null;
  conflicts: string[];
}

// ------------------------------------------------------------------------------
// Composite Aggregated Views (Used in Dashboard & Itinerary Viewer)
// ------------------------------------------------------------------------------
export interface ItineraryDayWithItems extends ItineraryDay {
  items: ItineraryItem[];
}

export interface TripWithDetails extends Trip {
  owner?: Profile;
  members?: (TripMember & { profile?: Profile })[];
  days?: ItineraryDayWithItems[];
}
