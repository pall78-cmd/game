import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://rruxlxoeelxjjjmhafkc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';

export const supabase = (() => {
  try {
    return createClient(SUPA_URL, SUPA_KEY);
  } catch (e) {
    console.error("Supabase init failed:", e);
    return null;
  }
})();

export const sendMessage = async (nama: string, teks: string) => {
  if (!supabase) throw new Error("Supabase not initialized");
  return await supabase.from('Pesan').insert([{ nama, teks }]);
};

export const deleteMessage = async (id: number) => {
  if (!supabase) throw new Error("Supabase not initialized");
  return await supabase.from('Pesan').delete().eq('id', id);
};

export const updateMessage = async (id: number, teks: string) => {
  if (!supabase) throw new Error("Supabase not initialized");
  return await supabase.from('Pesan').update({ teks }).eq('id', id);
};

export const clearAllMessages = async () => {
  if (!supabase) throw new Error("Supabase not initialized");
  return await supabase.from('Pesan').delete().neq('id', 0);
};

export const testConnection = async () => {
  if (!supabase) return { success: false, error: "Client not initialized" };
  try {
    const { error } = await supabase.from('Pesan').select('id').limit(1);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const uploadImage = async (file: File) => {
  if (!supabase) throw new Error("Supabase not initialized");
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage
    .from('bukti')
    .upload(filePath, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('bukti')
    .getPublicUrl(filePath);

  return publicUrl;
};