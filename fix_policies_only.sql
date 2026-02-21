-- Hapus policy lama jika ada agar tidak error duplikat
drop policy if exists "Public Access Voice Note" on storage.objects;
drop policy if exists "Public Upload Voice Note" on storage.objects;

-- 1. Policy: Izinkan SEMUA orang melihat/mendengar voice note (SELECT)
create policy "Public Access Voice Note"
on storage.objects for select
using ( bucket_id = 'voice note' );

-- 2. Policy: Izinkan SEMUA orang mengupload voice note (INSERT)
create policy "Public Upload Voice Note"
on storage.objects for insert
with check ( bucket_id = 'voice note' );
