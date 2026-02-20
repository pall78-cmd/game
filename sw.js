self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
    if (e.data?.type === 'SHOW_NOTIFICATION') {
        const payload = e.data.payload;
        let cleanBody = payload.body;

        if (cleanBody.startsWith('[IMG]')) cleanBody = "📷 Photo";
        else if (cleanBody.startsWith('[VN]')) cleanBody = "🎤 Voice Message";
        else if (cleanBody.startsWith('[VO]')) cleanBody = "👁️ Secret Message";
        else if (cleanBody.includes('[SHARED FATE]')) cleanBody = "🔮 Shared Fate";
        else if (cleanBody.startsWith('[REPLY:{')) {
            const endIdx = cleanBody.indexOf('}]');
            if (endIdx !== -1) {
                 cleanBody = "↩️ " + cleanBody.substring(endIdx + 2);
            }
        } else {
             cleanBody = cleanBody.replace(/\[REPLY:.*?\]/g, "↩️ ").trim();
        }

        self.registration.showNotification(payload.sender, {
            body: cleanBody || "New mystic transmission",
            icon: 'https://cdn-icons-png.flaticon.com/512/3062/3062634.png',
            tag: 'oracle-msg',
            renotify: true,
            data: { url: self.location.origin }
        });
    }
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(self.clients.openWindow(e.notification.data.url));
});