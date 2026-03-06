# Oracle v17.9 - Harmony

A mystic chat application with Fate Cards, Voice Notes, and View Once messages.

## Deployment to Vercel

If you are facing "Failed to Deploy" on Vercel, follow these steps:

### 1. Configure Environment Variables
Vercel needs to know your Supabase credentials during the build process.
Go to your project on Vercel: **Settings > Environment Variables** and add:
- `VITE_SUPA_URL`: `https://rruxlxoeelxjjjmhafkc.supabase.co`
- `VITE_SUPA_KEY`: `(Your Supabase Anon Key)`

### 2. Build Settings
Ensure your Vercel build settings are as follows:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Routing & Deployment Fix
The `vercel.json` file handles SPA routing. I have also fixed `.vercelignore` which was previously blocking `package.json` from being uploaded to Vercel. Deployment should now work correctly.

### 4. Supabase Setup
Make sure you have run the SQL script in `supabase_setup.sql` in your Supabase SQL Editor to create the necessary tables and storage buckets.

## Features
- **Fate Cards**: Invoke destiny with Truth or Dare cards.
- **Voice Notes**: Send encrypted voice messages.
- **View Once**: Messages that disappear after being read.
- **Real-time**: Instant messaging powered by Supabase.
- **PWA**: Installable on Android and iOS.
