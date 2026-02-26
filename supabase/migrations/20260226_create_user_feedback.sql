-- ============================================================================
-- Case Management System — user_feedback + feedback_notes
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. user_feedback table
CREATE TABLE public.user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    email TEXT,
    type TEXT NOT NULL CHECK (type IN ('feedback', 'bug', 'support')),
    message TEXT NOT NULL,
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'investigating', 'resolved', 'closed')),
    app_version TEXT,
    device_os TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX idx_user_feedback_type ON public.user_feedback(type);
CREATE INDEX idx_user_feedback_created ON public.user_feedback(created_at DESC);

-- 2. feedback_notes table (admin internal notes)
CREATE TABLE public.feedback_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id UUID NOT NULL REFERENCES public.user_feedback(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_notes_feedback ON public.feedback_notes(feedback_id);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.update_user_feedback_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_feedback_updated_at
    BEFORE UPDATE ON public.user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_feedback_modified();

-- 4. Row Level Security — user_feedback
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert only their own rows; guests can insert with user_id = NULL
CREATE POLICY "Users can insert own feedback"
    ON public.user_feedback FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR user_id IS NULL
    );

-- Admins can read all feedback
CREATE POLICY "Admins can read all feedback"
    ON public.user_feedback FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );

-- Admins can update feedback (change status etc.)
CREATE POLICY "Admins can update feedback"
    ON public.user_feedback FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );

-- 5. Row Level Security — feedback_notes
ALTER TABLE public.feedback_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notes"
    ON public.feedback_notes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );
