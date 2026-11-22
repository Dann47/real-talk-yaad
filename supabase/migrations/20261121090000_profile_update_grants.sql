-- Fix: "permission denied for table profiles" when saving Edit profile.
-- The first profiles migration only lets people update display_name, handle and parish.
-- The weekly goal, leaderboard switch and updated_at came later and need the same permission.
-- (Columns like level and id stay locked: only the database can change them.)
grant update (display_name, handle, parish, week_goal, show_on_leaderboard, updated_at)
  on public.profiles to authenticated;
