-- 1. Create the 'bukti' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('bukti', 'bukti', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policies to avoid conflicts
drop policy if exists "Public Access Bukti" on storage.objects;
drop policy if exists "Public Upload Bukti" on storage.objects;
drop policy if exists "Public Update Bukti" on storage.objects;

-- 3. Policy: Allow Public Read Access (SELECT)
create policy "Public Access Bukti"
on storage.objects for select
using ( bucket_id = 'bukti' );

-- 4. Policy: Allow Public Upload Access (INSERT)
create policy "Public Upload Bukti"
on storage.objects for insert
with check ( bucket_id = 'bukti' );

-- 5. Policy: Allow Public Update Access (UPDATE)
create policy "Public Update Bukti"
on storage.objects for update
using ( bucket_id = 'bukti' );
