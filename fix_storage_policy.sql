-- Enable the storage extension if not already enabled
create extension if not exists "storage" schema "extensions";

-- Create the 'voice note' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('voice note', 'voice note', true)
on conflict (id) do update set public = true;

-- Remove existing policies to avoid conflicts (optional, but cleaner)
drop policy if exists "Public Access Voice Note" on storage.objects;
drop policy if exists "Public Upload Voice Note" on storage.objects;
drop policy if exists "Public Update Voice Note" on storage.objects;

-- Policy 1: Allow Public Read Access (SELECT)
-- Allows anyone to view/download files from the 'voice note' bucket
create policy "Public Access Voice Note"
on storage.objects for select
using ( bucket_id = 'voice note' );

-- Policy 2: Allow Public Upload Access (INSERT)
-- Allows anyone (including anonymous users) to upload files to 'voice note'
create policy "Public Upload Voice Note"
on storage.objects for insert
with check ( bucket_id = 'voice note' );

-- Policy 3: Allow Public Update Access (UPDATE)
-- Allows overwriting files if needed
create policy "Public Update Voice Note"
on storage.objects for update
using ( bucket_id = 'voice note' );

-- Ensure RLS is enabled on the objects table (usually is by default)
alter table storage.objects enable row level security;
