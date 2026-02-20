self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/🔮.png',
      badge: '/🔮.png',
      tag: data.tag || 'oracle-msg',
      renotify: true,
      data: {
        url: data.url || '/'
      }
    };

    // Grouping logic: if there's already a notification with the same tag, 
    // we could potentially update it or handle it differently.
    // For now, standard grouping by 'tag' is handled by the browser.
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
