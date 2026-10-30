-- ==============================================================================
-- Migration: 20261029000002_group_collaboration.sql
-- Group Collaboration Support: Item Voting and Member Preferences with RLS
-- ==============================================================================

-- 1. ITEM VOTES TABLE
-- Stores group member feedback (thumbs up / thumbs down) for activities
CREATE TABLE IF NOT EXISTS public.item_votes (
    item_id UUID NOT NULL REFERENCES public.itinerary_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_item_votes_item_id ON public.item_votes(item_id);
CREATE INDEX IF NOT EXISTS idx_item_votes_user_id ON public.item_votes(user_id);

-- 2. MEMBER PREFERENCES TABLE
-- Stores individual member interests and budget constraints for small group consensus
CREATE TABLE IF NOT EXISTS public.member_preferences (
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interests TEXT[] NOT NULL DEFAULT '{}',
    budget_cap NUMERIC(12, 2) CHECK (budget_cap IS NULL OR budget_cap >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_preferences_trip_id ON public.member_preferences(trip_id);
CREATE INDEX IF NOT EXISTS idx_member_preferences_user_id ON public.member_preferences(user_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS set_member_preferences_updated_at ON public.member_preferences;
CREATE TRIGGER set_member_preferences_updated_at
    BEFORE UPDATE ON public.member_preferences
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.item_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_preferences ENABLE ROW LEVEL SECURITY;

-- Helper to find trip_id from item_id
CREATE OR REPLACE FUNCTION public.get_trip_id_from_item(lookup_item_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT d.trip_id
    FROM public.itinerary_items i
    JOIN public.itinerary_days d ON d.id = i.day_id
    WHERE i.id = lookup_item_id;
$$;

-- ------------------------------------------------------------------------------
-- ITEM VOTES POLICIES
-- ------------------------------------------------------------------------------
-- View: users who have read access to the trip can view votes
CREATE POLICY "Users can view votes for accessible items"
    ON public.item_votes FOR SELECT
    TO authenticated
    USING (public.can_view_trip(public.get_trip_id_from_item(item_id), auth.uid()));

-- Insert/Update: users can vote on accessible items for themselves
CREATE POLICY "Users can insert their own vote on accessible items"
    ON public.item_votes FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        public.can_view_trip(public.get_trip_id_from_item(item_id), auth.uid())
    );

CREATE POLICY "Users can update their own vote"
    ON public.item_votes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own vote"
    ON public.item_votes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- MEMBER PREFERENCES POLICIES
-- ------------------------------------------------------------------------------
-- View: members who can view the trip can view all group preferences
CREATE POLICY "Users can view group preferences for accessible trips"
    ON public.member_preferences FOR SELECT
    TO authenticated
    USING (public.can_view_trip(trip_id, auth.uid()));

-- Insert: member can save their own preferences for the trip
CREATE POLICY "Users can insert their own preferences"
    ON public.member_preferences FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        public.can_view_trip(trip_id, auth.uid())
    );

-- Update: member can update their own preferences
CREATE POLICY "Users can update their own preferences"
    ON public.member_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Delete: member can delete their own preferences, or trip owner can reset
CREATE POLICY "Users can delete their own preferences"
    ON public.member_preferences FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_trip_owner(trip_id, auth.uid()));
