-- Supabase Schema for Game Lobbies and User Preferences

-- 1. Game Lobbies Table
CREATE TABLE IF NOT EXISTS public.game_lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    game_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    current_players INTEGER NOT NULL DEFAULT 1,
    max_players INTEGER NOT NULL DEFAULT 4,
    settings JSONDEFAULT '{}'::jsonb, -- Store game-specific settings
    match_id TEXT, -- The boardgame.io match ID once started
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: In a real app with Supabase Auth, host_id would reference auth.users(id).
-- Here we'll just use the player's alias/ID since the original app doesn't enforce auth.

-- 2. User Preferences Table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL UNIQUE, -- Store preferences by device ID or player ID
    default_game_type TEXT DEFAULT 'UNO',
    default_player_name TEXT DEFAULT '',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: Enable RLS (Row Level Security) if you add Supabase Auth later
-- ALTER TABLE public.game_lobbies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- If not using Auth, you can leave RLS disabled, or create a policy that allows anonymous access:
-- CREATE POLICY "Allow public access" ON public.game_lobbies FOR ALL USING (true);
-- CREATE POLICY "Allow public access" ON public.user_preferences FOR ALL USING (true);

-- Enable Realtime for the lobbies so users can see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_lobbies;
