// Service Worker for Push Notifications
/* eslint-disable no-restricted-globals */

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  if (!event.data) {
    console.log('[SW] Push event but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'New Notification',
      body: event.data.text(),
      icon: '/favicon.png',
    };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'default',
    data: data.data || {},
    vibrate: [200, 100, 200],
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const urlToOpen = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a tab open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // No existing tab, open new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event);
});

// Handle push subscription change (if browser refreshes keys)
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).then(function(newSubscription) {
      // In a real app, you'd send this new subscription to your server
      console.log('[SW] New subscription:', newSubscription);
    })
  );
});
