import test from 'node:test'
import assert from 'node:assert/strict'
import { diffEntityCollection, entitiesFromRows, mergeEntityChange, stripNormalizedEntities } from './entitySync.js'

test('keeps normalized entities out of the shared workspace json', () => {
  assert.deepEqual(stripNormalizedEntities({ tasks: [1], events: [2], pages: [3], projects: [4] }), { projects: [4] })
})

test('only writes rows that changed and identifies deleted rows', () => {
  const previous = [{ id: 'a', title: 'A', done: false, date: '', priority: 'Media' }, { id: 'b', title: 'B', done: false, date: '', priority: 'Media' }]
  const current = [{ ...previous[0], done: true }]
  const diff = diffEntityCollection('tasks', previous, current, 'workspace-id')
  assert.equal(diff.upserts.length, 1)
  assert.equal(diff.upserts[0].id, 'a')
  assert.deepEqual(diff.deletes, ['b'])
})

test('maps and orders database rows into workspace entities', () => {
  const result = entitiesFromRows({ tasks: [
    { id: 'b', title: 'Second', done: false, due_date: null, priority: 'Baja', position: 1 },
    { id: 'a', title: 'First', done: true, due_date: '2026-10-01', priority: 'Alta', position: 0 },
  ] })
  assert.deepEqual(result.tasks.map((task) => task.id), ['a', 'b'])
  assert.equal(result.tasks[0].date, '2026-10-01')
})

test('merges one realtime row without replacing unrelated rows', () => {
  const current = [{ id: 'a', title: 'A', done: false, date: '', priority: 'Media' }]
  const next = mergeEntityChange(current, 'tasks', { eventType: 'INSERT', new: { id: 'b', title: 'B', done: false, due_date: null, priority: 'Alta', position: 1 } })
  assert.deepEqual(next.map((task) => task.id), ['a', 'b'])
})
