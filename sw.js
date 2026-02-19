self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
    if (e.data?.type === 'SHOW_NOTIFICATION') {
        const payload = e.data.payload;
        self.registration.showNotification(payload.sender, {
            body: payload.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3062/3062634.png',
            tag: 'oracle-msg',
            data: { url: 'https://pall78-cmd.github.io/game/' }
        });
    }
});
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(self.clients.openWindow(e.notification.data.url));
});