self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() || {} } catch { data = { title: 'Luma Workspace', body: event.data?.text() || 'Tienes un recordatorio pendiente.' } }
  event.waitUntil(self.registration.showNotification(data.title || 'Luma Workspace', {
    body: data.body || 'Tienes un recordatorio pendiente.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'luma-reminder',
    renotify: false,
    data: { url: data.url || '/' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) { existing.navigate(target); return existing.focus() }
    return self.clients.openWindow(target)
  }))
})
