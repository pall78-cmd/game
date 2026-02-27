
// Supabase Configuration and Client Initialization
const SUPA_URL = 'https://rruxlxoeelxjjjmhafkc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';

// Ensure Supabase client is available
if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    console.log("Supabase Client Initialized");
} else {
    console.error("Supabase library not loaded!");
}

// Export config if needed elsewhere
window.ORACLE_CONFIG = {
    SUPA_URL,
    SUPA_KEY
};
