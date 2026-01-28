-- 1. Enable UPDATE permission for users on their own badges
-- Run this in your Supabase SQL Editor

create policy "Users can update their own badges"
on public.user_badges
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Alternatively, if you prefer an RPC function (Security Definer) to bypass RLS:
-- create or replace function mark_badge_awarded(p_user_badge_id int)
-- returns void
-- language plpgsql
-- security definer
-- as $$
-- begin
--   update public.user_badges
--   set is_awarded = true
--   where id = p_user_badge_id
--   and user_id = auth.uid(); -- Extra safety to prevent editing others
-- end;
-- $$;
