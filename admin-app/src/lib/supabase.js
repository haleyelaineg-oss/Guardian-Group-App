import { createClient } from '@supabase/supabase-js';

// Same project/anon key as js/config.js (the vanilla app) — the anon key
// is public by design (RLS enforces access), so hardcoding it here matches
// how the rest of this codebase already treats it. Do not point this at a
// different Supabase project.
const SUPABASE_URL = 'https://wcuuinbgrunqajzxpcjs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdXVpbmJncnVucWFqenhwY2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODM5MzksImV4cCI6MjA4OTk1OTkzOX0.RJjBBOGgk6OS3QkwkGnem31akiSiDG-bwV_wryG7KfA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
