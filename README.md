# Oracle v17.9 - Harmony (Secured & Optimized)

A mystic, real-time chat application featuring Fate Cards, Voice Notes, View Once messages, and dynamic multiplayer board games (UNO Flip & Tebak Kata), built with React, Vite, and Supabase.

---

## 🔒 SECURITY & CONCURRENCY UPDATE LEDGER (JUNE 2026)

In response to performance and data integrity reviews, major security reinforcements and refactoring steps have been applied. This prevents the platform from suffering database corruption ("data ngawur"), random state resets, or data leakage risks.

### 1. Decoupled Chat Engine (Anti-Token Crash)
* **Action**: Extracted massive inline-declared sub-components from `/src/components/SideB.tsx` to `/src/components/MessageBubble.tsx`.
* **Impact**: Decreased `/src/components/SideB.tsx` size by ~800 lines of highly interactive markup. This reduces memory footprint, eases browser rendering cycle times, and shields developers from unexpected compilation limits.

### 2. Optimistic Concurrency Control (OCC) / Version Lock Protection
* **Action**: Implemented structural version locks inside `/src/utils/useGameRoom.ts` (`saveToDb` writes and `postgres_changes` listener).
* **Impact**: 
  * **No Lost Updates**: Multi-user client writes are verified against the database record before taking effect. If a player tries to overwrite state with a lower transaction sequence, the request is safely ignored.
  * **Real-time Stale Protection**: Inbound events are filtered. Stale packets arriving out-of-order will no longer corrupt the local screen board or regress game states.

### 3. Client-Side Cryptographic Sanitation
* **Action**: Audited symmetric room-key pipelines and voice-note uploads.
* **Impact**: Handshakes, room codes, and multimedia metadata remain completely client-enclosed under end-to-end symmetric encryption (AES-GCM), neutralizing secondary vectors for data theft.

### 4. App-Wide Nickname/Identity Escaping
* **Action**: Applied automatic pipe-character (`|`) filtration, whitespace trimming, and a 20-character maximum cap on the registration username inputs in `App.tsx`.
* **Impact**: Eliminates downstream database partitioning bugs. Since the application concatenates identity components as `{Name}|{Avatar}|{Color}` inside database `nama` payloads, eliminating user-supplied pipes prevents format injection and browser crash vulnerability loops across other players' client rooms. Also, pruned over 800 lines of redundant, dead component duplication block in `App.tsx` to lower bundles.

---

## 🛠️ Deployment Instructions

### 1. Configure Environment Variables
Vercel and local configurations require Supabase credentials during build process. Add the following to your development or host settings:
* `VITE_SUPA_URL`: `https://your-project.supabase.co`
* `VITE_SUPA_KEY`: `(Your Supabase Anon Key)`

### 2. Build and Start Settings
Ensure your build routines compile as standard Vite Single Page Applications (SPA):
* **Framework Preset**: Vite / React
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Install Command**: `npm install`

### 3. Supabase Schema Bootstrap
Ensure your Supabase project holds schemas from `/supabase_setup.sql` and `/supabase_boardgame_schema.sql` inside the Supabase SQL Editor in order to instantiate matching channels.

---

## 🎨 Feature Overview

* **Fate Cards Display**: Invoke oracle drawings with Light, Deep, or Chaos variations. Implemented with dynamic spring rotation entries.
* **Encrypted Voice Notes**: Audio message recordings stored securely with live active waveform visualization using an HTML5 Canvas drawing system.
* **View Once (VO) Media**: Interactive photos or secrets that undergo instantaneous memory stripping upon reveal to protect temporary credentials.
* **Lobbies & Realtime Boardgames**: Interactive lobbies for UNO Flip and Tebak Kata with peer presence tracking, dynamic host handover, and robust version concurrency checks.

---

## 🎨 LATENCY & LAYERING OPTIMIZATION DEV-LOG (JUNE 2026)

In this layout optimization cycle, the entire application has been audited and enhanced to resolve page lag, layout collisions, and interactive layering bugs.

### 1. Unified Portal Transition Lifecycles (App.tsx)
* **Problem**: Transitioning between the Lobby and active side-chambers (Dimension Sisi A/B) experienced a jarring visual cut. Because the transition overlay element was inside separate early return states, the overlay unmounted instantly on layer changes, breaking Framer Motion's exit animations.
* **Fix**: Unified early return paths inside `App.tsx` and wrapped the main active layout module (`layer === 'MAIN'`) inside an outer `<AnimatePresence>` containing the exact same transition overlay structure. Also introduced a 100ms delay before clearing the portal transition state.
* **Impact**: Transitions feel buttery-smooth, displaying a gorgeous dimension vortex animation that fades out dynamically across views.

### 2. Standalone Modal Layering Fixes (z-index Overlapping)
* **Problem**: Several modal overlays, warning indicators, and loading blocks were hidden underneath active game boards because the boards are drawn at `z-[100]`.
* **Fixes applied**:
  * **Oracle Modal overlay**: Elevated `CosmicOracleModal` wrapper z-index from `z-50` to `z-[600]` (`/src/components/CosmicOracleModal.tsx`).
  * **Game Loading & Timeouts overlay**: Elevated `LoadingScreen` container to `z-[1200]` and its cancellation button to `z-[1205]` (`/src/components/LoadingScreen.tsx`).
  * **Settings Header**: Replaced invalid non-standard `z-15` classes with a standard `z-20` utility inside both Sisi A and Sisi B settings menu drawers.
* **Impact**: Modals, game state loading menus, and configuration headers will never slip beneath active board games or scrolling elements, providing a pristine, bulletproof visual stacking order.

### 3. Tap Latency Elimination (App-wide)
* **Action**: Verified that all critical interactive elements, alphabetical keyboard grids (Tebak Kata letter buttons), deck zones, is-playable checkers, and UNO tiles utilize standard `button` elements that inherit `touch-action: manipulation` from global styles.
* **Impact**: Eliminates mobile browser 300ms double-tap delay, providing instantaneous reaction to user taps across both mobile devices and client iframe previews.
* **Status**: Highly fast, stable, and ready to roll!


### 🚀 TEBAK KATA & SOLO-PLAY MULTIPLAYER OPTIMIZATION LOG (JUNE 2026)

In this update, several major gameplay mechanics for "Tebak Kata" have been re-engineered to support both multiplayer flexibility and single-player autonomy:

1. **Wait State & Manual Start Overlay**:
   * *Problem*: When Tebak Kata was initialized with fewer than the maximum player room targets (e.g. 1 host playing alone, or 2 players playing in a of max 4 room), the board state loaded, but the letters were completely unclickable because the room's back-end status was still locked in `'waiting'`.
   * *Solution*: Implemented a beautiful `"Lobi Divinasi Kata"` waiting screen overlay inside `ReactTebakKataBoard.tsx` when `G.status === 'waiting'`. We added a `"Mulai Sekarang"` button which dispatches the missing `startGame` move via `SupabaseMultiplayerWrapper.tsx`.
   * *Impact*: Players can immediately start any game manually at any time!

2. **Single-Player Mode Support**:
   * *Action*: Adjusted the Lobby Create Modal select rules. When "Tebak Kata" is chosen in the form, the slider minimum automatically drops from `2` down to `1`.
   * *Impact*: Setting maximum players to `1` instantly fills the requirement, launching the game into `'playing'` status on creation for seamless, offline-like solo play.

3. **Wordle-style Daily Streak Triggers**:
   * *Action*: Delayed the streak incrementers in `ReactTebakKataBoard.tsx`. Instead of firing immediately when the inactive waiting lobby is initialized, the `StreakManager.recordPlayToday()` effect now triggers **only when the board enters the active `'playing'` state**.
   * *Impact*: Daily streaks are tracked realistically without false lobby triggers!


