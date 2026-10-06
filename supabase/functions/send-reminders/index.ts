import { createClient } from 'npm:@supabase/supabase-js@2.58.0'
import { buildPushPayload } from 'npm:@block65/webcrypto-web-push@2.0.0'

type Subscription = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  timezone: string
  daily_hour: number
  event_lead_minutes: number
}

const jsonHeaders = { 'content-type': 'application/json' }

function localClock(timezone: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) }
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

async function send(subscription: Subscription, data: Record<string, unknown>) {
  const vapid = {
    subject: Deno.env.get('VAPID_SUBJECT') || 'https://luma-workspace-omega.vercel.app',
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
  }
  const payload = await buildPushPayload({ data, options: { ttl: 3600, urgency: 'normal', topic: String(data.tag || 'luma-reminder').slice(0, 32) } }, {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, vapid)
  return fetch(subscription.endpoint, payload)
}

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const now = new Date()
  const { data: subscriptions, error: subscriptionError } = await supabase.from('push_subscriptions').select('*').eq('enabled', true)
  if (subscriptionError) return new Response(JSON.stringify({ error: subscriptionError.message }), { status: 500, headers: jsonHeaders })
  if (!subscriptions?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: jsonHeaders })

  const userIds = [...new Set(subscriptions.map((item: Subscription) => item.user_id))]
  const { data: memberships, error: memberError } = await supabase.from('workspace_members').select('user_id,workspace_id').in('user_id', userIds)
  if (memberError) return new Response(JSON.stringify({ error: memberError.message }), { status: 500, headers: jsonHeaders })
  const workspaceIds = [...new Set((memberships || []).map((item) => item.workspace_id))]
  if (!workspaceIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: jsonHeaders })
  const clocks = new Map(subscriptions.map((item: Subscription) => [item.id, localClock(item.timezone, now)]))
  const dates = [...clocks.values()].map((clock) => clock.date).sort()
  const maxDate = nextDate(dates.at(-1)!)
  const minDate = dates[0]!
  const [{ data: tasks, error: taskError }, { data: events, error: eventError }] = await Promise.all([
    supabase.from('workspace_tasks').select('workspace_id,id,title,due_date').in('workspace_id', workspaceIds).eq('done', false).lte('due_date', maxDate),
    supabase.from('workspace_events').select('workspace_id,id,title,event_date,start_minute').in('workspace_id', workspaceIds).gte('event_date', minDate).lte('event_date', maxDate),
  ])
  if (taskError || eventError) return new Response(JSON.stringify({ error: taskError?.message || eventError?.message }), { status: 500, headers: jsonHeaders })

  let sent = 0
  for (const subscription of subscriptions as Subscription[]) {
    const clock = clocks.get(subscription.id)!
    const allowed = new Set((memberships || []).filter((item) => item.user_id === subscription.user_id).map((item) => item.workspace_id))
    const messages: Array<{ key: string; title: string; body: string; view: string }> = []
    const dueTasks = (tasks || []).filter((task) => allowed.has(task.workspace_id) && task.due_date <= clock.date)
    if (clock.minute >= subscription.daily_hour * 60) {
      for (const task of dueTasks) {
        messages.push({
          key: `task:${task.workspace_id}:${task.id}:${clock.date}`,
          title: task.title,
          body: task.due_date < clock.date ? 'Tarea vencida' : 'Tarea para hoy',
          view: 'tasks',
        })
      }
    }
    const tomorrow = nextDate(clock.date)
    for (const event of events || []) {
      if (!allowed.has(event.workspace_id) || (event.event_date !== clock.date && event.event_date !== tomorrow)) continue
      const remaining = (event.event_date === tomorrow ? 1440 : 0) + event.start_minute - clock.minute
      if (remaining >= 0 && remaining <= subscription.event_lead_minutes) {
        messages.push({ key: `event:${event.workspace_id}:${event.id}:${event.event_date}:${subscription.event_lead_minutes}`, title: event.title, body: `Empieza en ${Math.max(1, remaining)} min`, view: 'agenda' })
      }
    }

    for (const message of messages) {
      const { error: logError } = await supabase.from('push_delivery_log').insert({ subscription_id: subscription.id, reminder_key: message.key })
      if (logError?.code === '23505') continue
      if (logError) continue
      try {
        const response = await send(subscription, { ...message, tag: message.key, url: `/?view=${message.view}` })
        if (response.ok) sent += 1
        else {
          await supabase.from('push_delivery_log').delete().eq('subscription_id', subscription.id).eq('reminder_key', message.key)
          if (response.status === 404 || response.status === 410) await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      } catch {
        await supabase.from('push_delivery_log').delete().eq('subscription_id', subscription.id).eq('reminder_key', message.key)
      }
    }
  }
  await supabase.from('push_delivery_log').delete().lt('delivered_at', new Date(now.getTime() - 30 * 86400000).toISOString())
  return new Response(JSON.stringify({ sent }), { headers: jsonHeaders })
})
