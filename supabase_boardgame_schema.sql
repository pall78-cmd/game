-- Run this script in the Supabase SQL Editor to support the Custom Storage Adapter for boardgame.io

CREATE TABLE public.boardgame_state (
  match_id TEXT PRIMARY KEY,
  state JSONB,
  initial_state JSONB,
  metadata JSONB,
  log JSONB DEFAULT '[]'::jsonb
);

-- Note: Because server connects to Supabase directly with service_role/anon, 
-- ensure RLS is correctly configured if necessary.
-- To allow anon connections to read/write for now:
ALTER TABLE public.boardgame_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anon" ON public.boardgame_state FOR ALL USING (true);
