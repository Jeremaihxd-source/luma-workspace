import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultNotificationSettings, dueBrowserReminders, reminderItems } from './notificationUtils.js'

const now = new Date('2026-10-01T09:00:00')
const workspace = {
  tasks: [
    { id: 'late', title: 'Vencida', date: '2026-09-30', done: false },
    { id: 'today', title: 'Hoy', date: '2026-10-01', done: false },
    { id: 'done', title: 'Lista', date: '2026-10-01', done: true },
  ],
  events: [{ id: 'meeting', title: 'Reunión', date: '2026-10-01', start: 555 }],
}

test('prioritizes overdue tasks and imminent events', () => {
  const reminders = reminderItems(workspace, now, 30)
  assert.equal(reminders[0].urgency, 0)
  assert.ok(reminders.some((item) => item.id === 'event:meeting:2026-10-01'))
})

test('creates one notification per task and one per event', () => {
  const reminders = dueBrowserReminders(workspace, defaultNotificationSettings, new Set(), now)
  assert.equal(reminders.length, 3)
  assert.equal(reminders[0].key, 'task:late:2026-10-01')
  assert.equal(reminders[1].key, 'task:today:2026-10-01')
  assert.equal(reminders[2].key, 'event:meeting:2026-10-01:30')
})

test('does not repeat reminders already sent', () => {
  const sent = new Set(['task:late:2026-10-01', 'task:today:2026-10-01', 'event:meeting:2026-10-01:30'])
  assert.deepEqual(dueBrowserReminders(workspace, defaultNotificationSettings, sent, now), [])
})
