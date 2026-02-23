/**
 * Service Worker untuk ORACLE
 * Menangani notifikasi push, caching aset, dan background sync.
 */

const CACHE_NAME = 'oracle-v1';
const ASSETS = [
    './',
    './index.html',
    './config.js',
    './deck.js',
    './audioManager.js',
    './messageParser.js',
    './manageraudio.js',
    './connectionManager.js'
];

// --- Message Parser Logic (Duplicated for SW independence) ---
const parseMessageContent = (text) => {
    if (!text) return { body: '', image: null };

    let content = text;
    
    // Strip tags wrapper
    if (content.startsWith("[VO]")) content = content.substring(4);
    
    // Handle Reply wrapper
    const replyMatch = content.match(/^\[REPLY:(.+?)\](.*)$/s);
    if (replyMatch) {
        content = replyMatch[2];
    }

    content = content.trim();
    let image = null;

    // Parse Oracle JSON
    if (content.startsWith('{')) {
        try {
            const parsed = JSON.parse(content);
            if (parsed.content) content = parsed.content;
        } catch (e) {}
    }

    // Parse Types
    if (content.startsWith("[VN]")) {
        content = "🎤 Mengirim Pesan Suara";
    } else if (content.startsWith("[IMG]")) {
        const rawImg = content.substring(5).trim();
        // Extract URL and Caption
        const firstSpace = rawImg.indexOf(' ');
        const firstNewline = rawImg.indexOf('\n');
        let splitIndex = -1;
        
        if (firstSpace !== -1 && firstNewline !== -1) splitIndex = Math.min(firstSpace, firstNewline);
        else if (firstSpace !== -1) splitIndex = firstSpace;
        else if (firstNewline !== -1) splitIndex = firstNewline;

        if (splitIndex !== -1) {
            image = rawImg.substring(0, splitIndex);
            content = "🖼️ " + rawImg.substring(splitIndex).trim();
        } else {
            image = rawImg;
            content = "🖼️ Mengirim Gambar";
        }
    } else if (content.startsWith("GAME ")) {
        content = "🔮 Kartu Takdir Terbuka";
    }

    return { body: content, image };
};

// --- Install & Activate ---
self.addEventListener('install', (event) => {
    self.skipWaiting();
    // Optional: Cache assets
    // event.waitUntil(
    //     caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    // );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// --- Handle Messages from Client (Main Thread) ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, text, icon, tag } = event.data.payload;
        
        const parsed = parseMessageContent(text);
        
        const options = {
            body: parsed.body,
            icon: icon || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', // Default Oracle Icon
            badge: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', // Small icon for status bar
            tag: tag || 'oracle-chat', // Grouping key
            renotify: true, // Vibrate/Sound again even if same tag
            data: {
                url: self.registration.scope
            },
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'Buka Chat' },
                { action: 'mark_read', title: 'Tandai Dibaca' }
            ]
        };

        // Add image if exists
        if (parsed.image) {
            options.image = parsed.image;
        }

        self.registration.showNotification(title, options);
    }
});

// --- Handle Notification Click ---
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        // Open or Focus Window
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If no window is open, open a new one
                if (self.clients.openWindow) {
                    return self.clients.openWindow('./index.html');
                }
            })
        );
    }
});
