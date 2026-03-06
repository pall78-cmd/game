import { createClient } from '@supabase/supabase-js';

export const SUPA_URL = 'https://rruxlxoeelxjjjmhafkc.supabase.co';
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';

export const supabaseClient = createClient(SUPA_URL, SUPA_KEY);

// For backward compatibility if needed
if (typeof window !== 'undefined') {
    window.supabaseClient = supabaseClient;
    window.ORACLE_CONFIG = { SUPA_URL, SUPA_KEY };
}
