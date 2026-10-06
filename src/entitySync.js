const entityDefinitions = {
  tasks: {
    table: 'workspace_tasks',
    toRow: (item, workspaceId, position) => ({
      workspace_id: workspaceId,
      id: item.id,
      title: item.title || '',
      done: Boolean(item.done),
      due_date: item.date || null,
      priority: item.priority || 'Media',
      position,
    }),
    fromRow: (row) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      date: row.due_date || '',
      priority: row.priority,
    }),
  },
  events: {
    table: 'workspace_events',
    toRow: (item, workspaceId, position) => ({
      workspace_id: workspaceId,
      id: item.id,
      title: item.title || '',
      event_date: item.date,
      start_minute: Number(item.start) || 0,
      duration_minutes: Number(item.duration) || 30,
      color: item.color || 'blue',
      position,
    }),
    fromRow: (row) => ({
      id: row.id,
      title: row.title,
      date: row.event_date,
      day: dayIndex(row.event_date),
      start: row.start_minute,
      duration: row.duration_minutes,
      color: row.color,
    }),
  },
  pages: {
    table: 'workspace_pages',
    toRow: (item, workspaceId, position) => ({
      workspace_id: workspaceId,
      id: item.id,
      title: item.title || 'Sin titulo',
      icon: item.icon || '📄',
      cover: item.cover || '',
      blocks: Array.isArray(item.blocks) ? item.blocks : [],
      task_ids: Array.isArray(item.taskIds) ? item.taskIds : [],
      project_ids: Array.isArray(item.projectIds) ? item.projectIds : [],
      position,
    }),
    fromRow: (row) => ({
      id: row.id,
      title: row.title,
      icon: row.icon || '📄',
      cover: row.cover || '',
      blocks: Array.isArray(row.blocks) && row.blocks.length ? row.blocks : [{ id: crypto.randomUUID(), type: 'text', content: '' }],
      taskIds: Array.isArray(row.task_ids) ? row.task_ids : [],
      projectIds: Array.isArray(row.project_ids) ? row.project_ids : [],
    }),
  },
}

function dayIndex(value) {
  if (!value) return 0
  const date = new Date(`${value}T12:00:00`)
  return (date.getDay() + 6) % 7
}

export const normalizedEntityKeys = Object.keys(entityDefinitions)

export function stripNormalizedEntities(workspace) {
  const { tasks: _tasks, events: _events, pages: _pages, ...state } = workspace
  return state
}

export function entityTable(key) {
  return entityDefinitions[key].table
}

export function entitiesFromRows(rowsByKey) {
  return Object.fromEntries(normalizedEntityKeys.map((key) => [
    key,
    [...(rowsByKey[key] || [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.id).localeCompare(String(b.id)))
      .map(entityDefinitions[key].fromRow),
  ]))
}

export function rowToEntity(key, row) {
  return entityDefinitions[key].fromRow(row)
}

export function diffEntityCollection(key, previous, current, workspaceId) {
  const definition = entityDefinitions[key]
  const previousMap = new Map((previous || []).map((item, position) => [item.id, { item, position }]))
  const currentIds = new Set((current || []).map((item) => item.id))
  const upserts = []

  ;(current || []).forEach((item, position) => {
    const before = previousMap.get(item.id)
    if (!before || before.position !== position || JSON.stringify(before.item) !== JSON.stringify(item)) {
      upserts.push(definition.toRow(item, workspaceId, position))
    }
  })

  return {
    upserts,
    deletes: [...previousMap.keys()].filter((id) => !currentIds.has(id)),
  }
}

export function mergeEntityChange(collection, key, payload) {
  const id = payload.new?.id || payload.old?.id
  if (!id) return collection
  if (payload.eventType === 'DELETE') return collection.filter((item) => item.id !== id)
  const incoming = rowToEntity(key, payload.new)
  const position = Math.max(0, Math.min(Number(payload.new.position) || 0, collection.length))
  const next = collection.filter((item) => item.id !== id)
  next.splice(position, 0, incoming)
  return next
}

export function snapshotEntities(workspace) {
  return Object.fromEntries(normalizedEntityKeys.map((key) => [key, structuredClone(workspace[key] || [])]))
}
