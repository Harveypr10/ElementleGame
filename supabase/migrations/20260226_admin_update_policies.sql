-- ═══════════════════════════════════════════════════════════════
-- Admin CRM: UPDATE/INSERT RLS Policies
-- These policies allow admins to edit user data via the CMS.
-- The is_admin() function already exists and checks user_profiles.is_admin.
-- ═══════════════════════════════════════════════════════════════

-- ── user_stats_user ──────────────────────────────────────────
CREATE POLICY "Admins can update user_stats_user"
    ON public.user_stats_user FOR UPDATE
    USING (public.is_admin());

-- ── user_stats_region ────────────────────────────────────────
CREATE POLICY "Admins can update user_stats_region"
    ON public.user_stats_region FOR UPDATE
    USING (public.is_admin());

-- ── user_subscriptions ───────────────────────────────────────
CREATE POLICY "Admins can update user_subscriptions"
    ON public.user_subscriptions FOR UPDATE
    USING (public.is_admin());

-- ── user_badges ──────────────────────────────────────────────
CREATE POLICY "Admins can update user_badges"
    ON public.user_badges FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can insert user_badges"
    ON public.user_badges FOR INSERT
    WITH CHECK (public.is_admin());

-- ── user_settings ────────────────────────────────────────────
CREATE POLICY "Admins can update user_settings"
    ON public.user_settings FOR UPDATE
    USING (public.is_admin());

-- ── user_profiles ────────────────────────────────────────────
CREATE POLICY "Admins can update user_profiles"
    ON public.user_profiles FOR UPDATE
    USING (public.is_admin());

-- ── game_attempts_user ───────────────────────────────────────
CREATE POLICY "Admins can update game_attempts_user"
    ON public.game_attempts_user FOR UPDATE
    USING (public.is_admin());

-- ── game_attempts_region ─────────────────────────────────────
CREATE POLICY "Admins can update game_attempts_region"
    ON public.game_attempts_region FOR UPDATE
    USING (public.is_admin());

-- ── admin_action_logs (for audit trail) ──────────────────────
CREATE POLICY "Admins can insert admin_action_logs"
    ON public.admin_action_logs FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can read admin_action_logs"
    ON public.admin_action_logs FOR SELECT
    USING (public.is_admin());
