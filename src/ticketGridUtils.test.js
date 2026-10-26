import test from 'node:test'
import assert from 'node:assert/strict'
import { createTicketGridData, normalizeTicketGrid, resizeTicketGrid, ticketNumber } from './ticketGridUtils.js'

test('creates a numbered empty ticket grid with the chosen dimensions', () => {
  const grid = createTicketGridData(4, 8, 101)
  assert.equal(grid.ticketRows, 4)
  assert.equal(grid.ticketColumns, 8)
  assert.equal(grid.ticketCells.length, 32)
  assert.equal(ticketNumber(grid, 0), 101)
  assert.equal(ticketNumber(grid, 31), 132)
})

test('preserves cells by row and column when the ticket grid grows', () => {
  const grid = createTicketGridData(2, 2)
  grid.ticketCells[3] = { text: 'Ana', reserved: true, color: '#ffddaa' }
  const resized = resizeTicketGrid(grid, 3, 4)
  assert.deepEqual(resized.ticketCells[5], { text: 'Ana', reserved: true, color: '#ffddaa' })
  assert.equal(resized.ticketCells.length, 12)
})

test('normalizes unsafe dimensions, colors and cell values', () => {
  const grid = normalizeTicketGrid({ ticketRows: 999, ticketColumns: 0, reservedColor: 'red', ticketCells: [{ text: 7, reserved: 1, color: 'blue' }] })
  assert.equal(grid.ticketRows, 50)
  assert.equal(grid.ticketColumns, 1)
  assert.equal(grid.reservedColor, '#dcefe4')
  assert.deepEqual(grid.ticketCells[0], { text: '7', reserved: true, color: '' })
})
