-- ============================================================================
-- LEAGUE SYSTEM — Part 5: RLS Policies
-- Run this AFTER Part 4c (all functions created)
-- ============================================================================

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_live ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_snapshot ENABLE ROW LEVEL SECURITY;

-- leagues
CREATE POLICY "League members can view their leagues"
    ON public.leagues FOR SELECT
    USING (
        id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Authenticated users can create leagues"
    ON public.leagues FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update league"
    ON public.leagues FOR UPDATE
    USING (admin_user_id = auth.uid());

CREATE POLICY "Admin can delete league"
    ON public.leagues FOR DELETE
    USING (admin_user_id = auth.uid());

-- league_members
CREATE POLICY "League members can view other members"
    ON public.league_members FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Members join via RPC"
    ON public.league_members FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Members can leave or admin can remove"
    ON public.league_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR league_id IN (SELECT id FROM public.leagues WHERE admin_user_id = auth.uid())
    );

CREATE POLICY "Members can update own row"
    ON public.league_members FOR UPDATE
    USING (user_id = auth.uid());

-- league_standings_live
CREATE POLICY "League members can view standings"
    ON public.league_standings_live FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Standings updated via trigger only"
    ON public.league_standings_live FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Standings updated via trigger update"
    ON public.league_standings_live FOR UPDATE
    USING (false);

-- league_standings_snapshot
CREATE POLICY "League members can view snapshots"
    ON public.league_standings_snapshot FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );
