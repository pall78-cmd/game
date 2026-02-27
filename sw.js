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
    if (!text) return { body: '', image: null, type: 'text' };

    let content = text;
    let type = 'text';
    
    // Strip tags wrapper
    if (content.startsWith("[VO]")) {
        content = content.substring(4);
        type = 'secret';
    }
    
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
        content = "🎤 Pesan Suara Baru";
        type = 'voice';
    } else if (content.startsWith("[IMG]")) {
        const rawImg = content.substring(5).trim();
        const firstSpace = rawImg.indexOf(' ');
        const firstNewline = rawImg.indexOf('\n');
        let splitIndex = -1;
        
        if (firstSpace !== -1 && firstNewline !== -1) splitIndex = Math.min(firstSpace, firstNewline);
        else if (firstSpace !== -1) splitIndex = firstSpace;
        else if (firstNewline !== -1) splitIndex = firstNewline;

        if (splitIndex !== -1) {
            image = rawImg.substring(0, splitIndex);
            content = rawImg.substring(splitIndex).trim() || "Mengirim Gambar";
        } else {
            image = rawImg;
            content = "🖼️ Gambar Baru";
        }
        type = 'image';
    } else if (content.startsWith("GAME ")) {
        content = "🔮 Takdir telah memanggilmu...";
        type = 'game';
    }

    if (type === 'secret') {
        content = "👁️ Seseorang mengirim pesan rahasia...";
    }

    return { body: content, image, type };
};

// --- Install & Activate ---
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// --- Push Event Listener (For notifications when app is closed) ---
self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Oracle', text: event.data.text() };
        }
    }

    const title = data.title || 'Oracle Chamber';
    const text = data.text || 'Ada pesan baru untukmu.';
    
    const parsed = parseMessageContent(text);
    
    const options = {
        body: parsed.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
        image: parsed.image,
        tag: 'oracle-push',
        renotify: true,
        vibrate: [100, 50, 100],
        data: {
            url: self.registration.scope
        },
        actions: [
            { action: 'open', title: '👁️ Buka Oracle' },
            { action: 'close', title: 'Tutup' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// --- Handle Messages from Client (Main Thread) ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, text, icon, tag } = event.data.payload;
        
        const parsed = parseMessageContent(text);
        
        const options = {
            body: parsed.body,
            icon: icon || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
            tag: tag || 'oracle-chat',
            renotify: true,
            data: {
                url: self.registration.scope
            },
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: '👁️ Masuk ke Chamber' },
                { action: 'mark_read', title: 'Tandai Dibaca' }
            ]
        };

        if (parsed.image) {
            options.image = parsed.image;
        }

        // Customizing based on type
        if (parsed.type === 'game') {
            options.vibrate = [500, 100, 500];
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
