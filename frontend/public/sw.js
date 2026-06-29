self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'FlowMind AI', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data || {},
      actions: data.data?.actions
        ? data.data.actions.map(a => ({ action: a, title: a.charAt(0).toUpperCase() + a.slice(1) }))
        : []
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action; // 'done' or 'skip' from notification action buttons
  
  if (action && data.task_id && data.user_id) {
    event.waitUntil(
      fetch('/api/notifications/respond', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, task_id: data.task_id, user_id: data.user_id })
      })
    );
  } else {
    // No action clicked — just open the app
    event.waitUntil(clients.openWindow('/'));
  }
});
