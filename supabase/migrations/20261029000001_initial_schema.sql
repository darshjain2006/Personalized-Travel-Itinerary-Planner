-- ==============================================================================
-- PERSONALIZED TRAVEL ITINERARY PLANNER - INITIAL SCHEMA
-- Migration: 20261029000001_initial_schema.sql
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLES DEFINITION
-- ==============================================================================

-- PROFILES (Linked directly to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- TRIPS (Core itinerary travel definition)
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    num_travelers INTEGER NOT NULL DEFAULT 1 CHECK (num_travelers > 0),
    traveler_type TEXT NOT NULL CHECK (traveler_type IN ('solo', 'couple', 'group')),
    budget_total NUMERIC(12, 2) CHECK (budget_total IS NULL OR budget_total >= 0),
    budget_level TEXT NOT NULL DEFAULT 'mid' CHECK (budget_level IN ('budget', 'mid', 'premium')),
    pace TEXT NOT NULL DEFAULT 'balanced' CHECK (pace IN ('relaxed', 'balanced', 'packed')),
    interests TEXT[] NOT NULL DEFAULT '{}',
    accommodation_pref TEXT,
    transport_pref TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- TRIP MEMBERS (Collaborative small group access control)
CREATE TABLE IF NOT EXISTS public.trip_members (
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (trip_id, user_id)
);

-- ITINERARY DAYS (Day-by-day scheduling container)
CREATE TABLE IF NOT EXISTS public.itinerary_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number > 0),
    date DATE NOT NULL,
    summary TEXT,
    estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_trip_day_number UNIQUE (trip_id, day_number)
);

-- ITINERARY ITEMS (Specific events, stays, meals, activities, and routes)
CREATE TABLE IF NOT EXISTS public.itinerary_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    type TEXT NOT NULL CHECK (type IN ('attraction', 'dining', 'accommodation', 'transport', 'activity')),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
    notes TEXT,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON public.trips(owner_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON public.trips(start_date);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON public.trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON public.trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_trip_id ON public.itinerary_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_day_number ON public.itinerary_days(trip_id, day_number);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_day_id ON public.itinerary_items(day_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_order ON public.itinerary_items(day_id, order_index);

-- ==============================================================================
-- 4. REUSABLE FUNCTIONS & TRIGGERS
-- ==============================================================================

-- A. Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;
CREATE TRIGGER set_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_itinerary_days_updated_at ON public.itinerary_days;
CREATE TRIGGER set_itinerary_days_updated_at
    BEFORE UPDATE ON public.itinerary_days
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_itinerary_items_updated_at ON public.itinerary_items;
CREATE TRIGGER set_itinerary_items_updated_at
    BEFORE UPDATE ON public.itinerary_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- B. Auto-create user profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, default_currency)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        'USD'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- C. Auto-add trip creator to trip_members with 'owner' role
CREATE OR REPLACE FUNCTION public.handle_new_trip_owner()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.trip_members (trip_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (trip_id, user_id) DO UPDATE SET role = 'owner';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_created_add_owner ON public.trips;
CREATE TRIGGER on_trip_created_add_owner
    AFTER INSERT ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_trip_owner();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- Avoids recursive policies between trips and trip_members
-- ==============================================================================

-- Check if user can view a trip (owner OR member)
CREATE OR REPLACE FUNCTION public.can_view_trip(lookup_trip_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.trips WHERE id = lookup_trip_id AND owner_id = lookup_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.trip_members WHERE trip_id = lookup_trip_id AND user_id = lookup_user_id
    );
$$;

-- Check if user can edit a trip (owner OR editor)
CREATE OR REPLACE FUNCTION public.can_edit_trip(lookup_trip_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.trips WHERE id = lookup_trip_id AND owner_id = lookup_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.trip_members 
        WHERE trip_id = lookup_trip_id 
          AND user_id = lookup_user_id 
          AND role IN ('owner', 'editor')
    );
$$;

-- Check if user is trip owner
CREATE OR REPLACE FUNCTION public.is_trip_owner(lookup_trip_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.trips WHERE id = lookup_trip_id AND owner_id = lookup_user_id
    );
$$;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all 5 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Anyone authenticated can view profiles (to display avatars/names of group members)
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- TRIPS POLICIES
-- ------------------------------------------------------------------------------
-- View: trip owner or member
CREATE POLICY "Users can view trips they own or belong to"
    ON public.trips FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid() OR public.can_view_trip(id, auth.uid()));

-- Insert: authenticated user creates trip as owner
CREATE POLICY "Users can create trips"
    ON public.trips FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Update: trip owner or editor
CREATE POLICY "Trip owners and editors can update trips"
    ON public.trips FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid() OR public.can_edit_trip(id, auth.uid()))
    WITH CHECK (owner_id = auth.uid() OR public.can_edit_trip(id, auth.uid()));

-- Delete: only trip owner
CREATE POLICY "Only trip owner can delete trip"
    ON public.trips FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- ------------------------------------------------------------------------------
-- TRIP MEMBERS POLICIES
-- ------------------------------------------------------------------------------
-- View: users can view members of trips they have access to
CREATE POLICY "Users can view members of accessible trips"
    ON public.trip_members FOR SELECT
    TO authenticated
    USING (public.can_view_trip(trip_id, auth.uid()));

-- Insert: only trip owner can invite / add members
CREATE POLICY "Trip owners can add members"
    ON public.trip_members FOR INSERT
    TO authenticated
    WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));

-- Update: only trip owner can modify roles
CREATE POLICY "Trip owners can update member roles"
    ON public.trip_members FOR UPDATE
    TO authenticated
    USING (public.is_trip_owner(trip_id, auth.uid()))
    WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));

-- Delete: trip owner can remove members, or a member can leave
CREATE POLICY "Trip owners can remove members or users can leave"
    ON public.trip_members FOR DELETE
    TO authenticated
    USING (public.is_trip_owner(trip_id, auth.uid()) OR user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- ITINERARY DAYS POLICIES
-- ------------------------------------------------------------------------------
-- View: user can view if they can view the parent trip
CREATE POLICY "Users can view itinerary days of accessible trips"
    ON public.itinerary_days FOR SELECT
    TO authenticated
    USING (public.can_view_trip(trip_id, auth.uid()));

-- Insert: owner or editor can add days
CREATE POLICY "Owners and editors can add itinerary days"
    ON public.itinerary_days FOR INSERT
    TO authenticated
    WITH CHECK (public.can_edit_trip(trip_id, auth.uid()));

-- Update: owner or editor can update days
CREATE POLICY "Owners and editors can update itinerary days"
    ON public.itinerary_days FOR UPDATE
    TO authenticated
    USING (public.can_edit_trip(trip_id, auth.uid()))
    WITH CHECK (public.can_edit_trip(trip_id, auth.uid()));

-- Delete: owner or editor can delete days
CREATE POLICY "Owners and editors can delete itinerary days"
    ON public.itinerary_days FOR DELETE
    TO authenticated
    USING (public.can_edit_trip(trip_id, auth.uid()));

-- ------------------------------------------------------------------------------
-- ITINERARY ITEMS POLICIES
-- ------------------------------------------------------------------------------
-- Helper function to find trip_id from day_id
CREATE OR REPLACE FUNCTION public.get_trip_id_from_day(lookup_day_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT trip_id FROM public.itinerary_days WHERE id = lookup_day_id LIMIT 1;
$$;

-- View: user can view items if they can view the parent day's trip
CREATE POLICY "Users can view itinerary items of accessible trips"
    ON public.itinerary_items FOR SELECT
    TO authenticated
    USING (public.can_view_trip(public.get_trip_id_from_day(day_id), auth.uid()));

-- Insert: owner or editor can add items
CREATE POLICY "Owners and editors can add itinerary items"
    ON public.itinerary_items FOR INSERT
    TO authenticated
    WITH CHECK (public.can_edit_trip(public.get_trip_id_from_day(day_id), auth.uid()));

-- Update: owner or editor can update items
CREATE POLICY "Owners and editors can update itinerary items"
    ON public.itinerary_items FOR UPDATE
    TO authenticated
    USING (public.can_edit_trip(public.get_trip_id_from_day(day_id), auth.uid()))
    WITH CHECK (public.can_edit_trip(public.get_trip_id_from_day(day_id), auth.uid()));

-- Delete: owner or editor can delete items
CREATE POLICY "Owners and editors can delete itinerary items"
    ON public.itinerary_items FOR DELETE
    TO authenticated
    USING (public.can_edit_trip(public.get_trip_id_from_day(day_id), auth.uid()));
