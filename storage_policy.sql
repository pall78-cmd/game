-- ==============================================================================
-- SCRIPT SETUP SUPABASE STORAGE BUCKET "bukti" & "voicenote"
-- Copy dan paste script ini ke dalam menu "SQL Editor" di dashboard Supabase Anda
-- lalu klik "Run".
-- ==============================================================================

-- 1. Buat bucket 'bukti' (untuk gambar) dan 'voicenote' (untuk audio) jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('bukti', 'bukti', true),
  ('voicenote', 'voicenote', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Aktifkan Row Level Security (RLS) pada tabel storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada (opsional, untuk menghindari error duplicate)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;

-- 4. Buat Policy: Izinkan siapa saja (public) untuk membaca/melihat file
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id IN ('bukti', 'voicenote') );

-- 5. Buat Policy: Izinkan siapa saja (anon/authenticated) untuk mengupload file baru
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id IN ('bukti', 'voicenote') );

-- 6. Buat Policy: Izinkan siapa saja untuk mengupdate file yang sudah ada
CREATE POLICY "Allow Updates"
ON storage.objects FOR UPDATE
USING ( bucket_id IN ('bukti', 'voicenote') );

-- 7. Buat Policy: Izinkan siapa saja untuk menghapus file (dibutuhkan untuk fitur Hapus Riwayat)
CREATE POLICY "Allow Deletes"
ON storage.objects FOR DELETE
USING ( bucket_id IN ('bukti', 'voicenote') );

-- Selesai! Bucket 'bukti' dan 'voicenote' sekarang siap digunakan.
