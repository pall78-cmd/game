# Oracle - System Architecture & Technical Documentation

This document serves as the implementation guidelines and technical reference for future developers maintaining, scaling, or auditing the Oracle boardgame & chat environment.

---

## 1. Architectural Overview

The application is structured as a real-time full-stack SPA utilizing **React 18 + Vite**, **Supabase (PostgreSQL, Realtime, and Storage)**, and **Symmetric Client-Side Encryption** (AES-GCM / PBKDF2) to protect confidential user correspondences. 

Interactive multi-player game boards (such as **UNO Flip** and **Tebak Kata**) are orchestrated by clean, stateful frontend engines coupled dynamically to Supabase Postgres replication channels.

```
+--------------------------------------------------------------+
|                     Client Browser (React 18)                |
|  +--------------------+  +--------------------+  +--------+  |
|  |     SideB UI       |  |  useGameRoom Hook  |  | Engines|  |
|  +---------+----------+  +---------+----------+  +---+----+  |
|            |                       |                 |       |
|            | MessageBubble         |                 |       |
|            v                       |                 |       |
|  +--------------------+            |                 |       |
|  | MessageBubble.tsx  |            |                 |       |
|  +---------+----------+            |                 |       |
+------------|-----------------------|-----------------|-------+
             |                       |                 |
             v                       v                 v
+------------------------------------+-------------------------+
|                      Supabase Cloud Infrastructure           |
|                                                              |
|   +-------------------+   +------------------+               |
|   |   Realtime (WS)   |   |  Database (Postg)|               |
|   +-------------------+   +------------------+               |
+--------------------------------------------------------------+
```

---

## 2. Decoupled Chat Engine & Component Anatomy

To optimize build performance, reduce the probability of token limit clipping, and ensure isolation of concerns, we refactored `/src/components/SideB.tsx` by decouplng chat components out to a modular view file:

### `/src/components/MessageBubble.tsx`
This standalone component is responsible for message presentation and handles specific payloads:
* **`AudioPlayer`**: Manages interactive voice note rendering with a canvas-drawn active waveform visualizer.
* **`FateCardDisplay`**: Formats tarot-style fate, light, deep, and chaotic prompts.
* **`BoardGameCardDisplay`**: Leverages customizable vector vectors and special card configurations (`specialCardDetails`) to render interactive cards (e.g., Draw Wild, Action Skips).
* **`formatText`**: Implements custom regex string parse rules for Markdown structures (`*bold*`, `_italics_`, `~strikethrough~`, and ``` `code` ``` blocks).
* **`MessageContent`**: Orchestrates nested data nodes based on parsed message identifiers (Image embeds, Secret View-Once items, Voice Notes).
* **`MessageBubble`**: The memoized component wrapper handling long-press editing, horizontal swipe-to-reply gestures, unread/read state delivery, and image-loaded height triggers.

---

## 3. Database Schema Blueprint

The application interfaces directly with Supabase Postgres. The core tables are defined below:

### Table: `boardgame_state`
Coordinates active match parameters, game iterations, and current hands.
* `match_id` (`UUID` or `TEXT`, PRIMARY KEY): Identifies the matching room.
* `state` (`JSONB`): Nested schema representation of the active board. Contains standard game variables, deck stacks, current player index, array of player hands, and the state's `version` lock property.
* `initial_state` (`JSONB`): Keeps record of the base board configuration for reset / retry bounds.
* `metadata` (`JSONB`): Trackers for game model type (e.g., `UNO_FLIP`) and last update timestamps.
* `log` (`JSONB`): Historic move audits.

### Table: `game_lobbies`
Manages open, full, and active room configurations before game starting triggers.
* `id` (`BIGINT` or `UUID`, PRIMARY KEY)
* `match_id` (`TEXT`): Associated match hash.
* `status` (`TEXT`): Enum states (`"waiting"` / `"playing"` / `"completed"`).
* `creator_id` (`TEXT`): User identifier of the host configuration client.
* `players` (`JSONB`): Array list containing joiners with nicknames.

---

## 4. State Synchronization & Optimistic Version Locking

To prevent race conditions, out-of-order writes, or lost updates (e.g. two players making game decisions at the exact same fraction of a second), a robust client-side **Optimistic Concurrency Control (OCC) / Version Locking** engine is implemented inside `/src/utils/useGameRoom.ts`.

### 4.1. Outbound Writes Protection (`saveToDb`)
Before performing an upsert to the database, `saveToDb` performs an OCC lease check:
1. It queries the current database state for the targeted `match_id` to retrieve the latest version in the database (`currentDbVersion`).
2. It reads the local version in the memory engine (`newStateVersion`).
3. If `currentDbVersion > newStateVersion`, the write is rejected to safeguard against overwriting an update made by another peer.
4. If acceptable, it increments the lock parameter `version = Math.max(currentDbVersion, newStateVersion) + 1` and persists the payload.

```typescript
const { data: currentDbState } = await supabaseClient
    .from('boardgame_state')
    .select('state')
    .eq('match_id', gameId)
    .maybeSingle();

const currentDbVersion = currentDbState?.state?.version || 0;
const newStateVersion = state.version || 0;

if (currentDbState && currentDbVersion > newStateVersion) {
    console.warn("Version Lock Rejected write.");
    return;
}
```

### 4.2. Inbound Reads Protection (`postgres_changes`)
Upon receiving real-time notifications from the Postgres observer channel:
1. The client parses the payload's `incomingVersion`.
2. It compares it to the client's current memory version (`currentLocalVersion`).
3. If `incomingVersion >= currentLocalVersion`, the client updates local states and engine buffers.
4. If `incomingVersion < currentLocalVersion`, the update is ignored as stale data, preventing flickering/regressing states.

---

## 5. Security Protocols & Client-Side Privacy

* **Zero-Knowledge Message Storage**: Communication blocks are cryptographically ciphered via AES-GCM prior to database transmission. De-scrubbing occurs exclusively in runtime memory on recipient machines using the shared room Secret Key.
* **Server-Less API Key Boundaries**: Critical keys exist completely encapsulated in client memory spaces (or secure local storage buffers), avoiding exposed logs.
* **View Once (VO) Messages**: Handled with immediate destruction. Upon revealing the View Once record, local states dispatch state triggers to flag deletion, which automatically strips storage contents.
* **Identity Sanitization**: User nicknames are filtered upon registration inside `App.tsx` to automatically purge custom delimiter tokens (`|`) and enforce strict length safeguards.

---

## 6. Game Lifecycle Sequence

```
[ Lobby Creation ]
        |  (Creator initializes the Lobby block)
        v
[ Invitation & Subscriptions ]
        |  (Peers join through Match ID and subscribe to Supabase Realtime Channels)
        v
[ Engine Initialization ]
        |  (Lobby transitions to 'playing'. Host instantiates the UNO/Game engine)
        v
[ Active Gameplay Turn Iterations ]
        |  (Client applies action locally -> locks version -> pushes upsert to DB -> broadcasts peer triggers)
        v
[ Validation or Game End ]
        |  (Winner calculated -> states cleared -> lobby archived or set back to 'waiting')
```

---

## 7. App-Wide Input Validation & Partition Boundaries

To prevent visual distortions, buffer issues, or client application crashes, all client inputs are validated before state or local storage adjustments:

1. **Character Restrictions**: Nicknames are constrained to a strict maximum length of `20` characters (`maxLength={20}`) to maintain visual balance and layout correctness across all mobile and desktop layouts (SideA / SideB views).
2. **Identity Delimiter Filtration**: Because the database represents user metadata as standard pipe-separated values (e.g. `username|avatar|theme_color`), user nicknames have the pipe character (`|`) programmatically stripped via `replace(/\|/g, '')`. This stops database/identity parsing bugs from disrupting other active chat client rooms.
3. **Automated Edge Trimming**: Nicknames are trimmed via `.trim()` to suppress empty spaces or phantom identity blocks before transition thresholds are unlocked.
