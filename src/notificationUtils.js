const DAY_MS = 86400000

export const defaultNotificationSettings = {
  enabled: false,
  dailyHour: 9,
  eventLeadMinutes: 30,
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function eventTime(event) {
  if (!event.date) return null
  const date = new Date(`${event.date}T00:00:00`)
  date.setMinutes(Number(event.start) || 0)
  return date
}

export function reminderItems(workspace, now = new Date(), eventLeadMinutes = 30) {
  const today = localDateKey(now)
  const tomorrow = localDateKey(new Date(now.getTime() + DAY_MS))
  const tasks = (workspace.tasks || []).filter((task) => !task.done && task.date && task.date <= tomorrow).map((task) => ({
    id: `task:${task.id}`,
    kind: 'task',
    itemId: task.id,
    title: task.title,
    detail: task.date < today ? 'Tarea vencida' : task.date === today ? 'Para hoy' : 'Para mañana',
    urgency: task.date < today ? 0 : task.date === today ? 1 : 3,
  }))
  const leadMs = eventLeadMinutes * 60000
  const events = (workspace.events || []).map((event) => ({ event, time: eventTime(event) })).filter(({ time }) => time && time.getTime() >= now.getTime() - 15 * 60000 && time.getTime() <= now.getTime() + Math.max(leadMs, DAY_MS)).map(({ event, time }) => ({
    id: `event:${event.id}:${event.date}`,
    kind: 'event',
    itemId: event.id,
    title: event.title,
    detail: time.toLocaleString('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
    startsAt: time.getTime(),
    urgency: time.getTime() <= now.getTime() + leadMs ? 0 : 2,
  }))
  return [...tasks, ...events].sort((a, b) => a.urgency - b.urgency || (a.startsAt || 0) - (b.startsAt || 0))
}

export function dueBrowserReminders(workspace, settings, sentKeys, now = new Date()) {
  const today = localDateKey(now)
  const results = []
  const pendingToday = (workspace.tasks || []).filter((task) => !task.done && task.date && task.date <= today)
  if (now.getHours() >= settings.dailyHour) {
    for (const task of pendingToday) {
      const key = `task:${task.id}:${today}`
      if (!sentKeys.has(key)) results.push({ key, title: task.title, body: task.date < today ? 'Tarea vencida' : 'Tarea para hoy', view: 'tasks' })
    }
  }
  const leadMs = settings.eventLeadMinutes * 60000
  for (const event of workspace.events || []) {
    const time = eventTime(event)
    const key = `event:${event.id}:${event.date}:${settings.eventLeadMinutes}`
    if (time && time.getTime() >= now.getTime() && time.getTime() <= now.getTime() + leadMs && !sentKeys.has(key)) {
      results.push({ key, title: event.title, body: `Empieza en ${Math.max(1, Math.ceil((time.getTime() - now.getTime()) / 60000))} min`, view: 'agenda' })
    }
  }
  return results
}

export function pruneSentReminderKeys(keys, now = new Date()) {
  const threshold = new Date(now.getTime() - 14 * DAY_MS)
  const oldest = localDateKey(threshold)
  return [...keys].filter((key) => !/\d{4}-\d{2}-\d{2}/.test(key) || key.match(/\d{4}-\d{2}-\d{2}/)[0] >= oldest)
}
