-- 1. Create the 'voice note' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('voice note', 'voice note', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policies to avoid conflicts
drop policy if exists "Public Access Voice Note" on storage.objects;
drop policy if exists "Public Upload Voice Note" on storage.objects;
drop policy if exists "Public Update Voice Note" on storage.objects;

-- 3. Policy: Allow Public Read Access (SELECT)
create policy "Public Access Voice Note"
on storage.objects for select
using ( bucket_id = 'voice note' );

-- 4. Policy: Allow Public Upload Access (INSERT)
create policy "Public Upload Voice Note"
on storage.objects for insert
with check ( bucket_id = 'voice note' );

-- 5. Policy: Allow Public Update Access (UPDATE)
create policy "Public Update Voice Note"
on storage.objects for update
using ( bucket_id = 'voice note' );
