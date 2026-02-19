import { createClient } from '@supabase/supabase-js';

// Project URL
const SUPA_URL = 'https://rruxlxoeelxjjjmhafkc.supabase.co';
// Anon Key
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';

export const supabase = createClient(SUPA_URL, SUPA_KEY);

export const sendMessage = async (nama: string, teks: string) => {
  return await supabase.from('Pesan').insert([{ nama, teks }]);
};

export const deleteMessage = async (id: number) => {
  return await supabase.from('Pesan').delete().eq('id', id);
};

export const updateMessage = async (id: number, teks: string) => {
  return await supabase.from('Pesan').update({ teks }).eq('id', id);
};

export const clearAllMessages = async () => {
  return await supabase.from('Pesan').delete().neq('id', 0);
};