import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTableData, parseLocalizedNumber, parsePastedGrid, tableColumnCount, tableToCsv } from './tableUtils.js'

test('uses the widest row so existing table data is never hidden', () => {
  assert.equal(tableColumnCount([{ id: 'a' }, { id: 'b' }], [['1', '2', '3', '4']]), 4)
  const normalized = normalizeTableData({ columns: [], rows: [['a', 'b', 'c']] }, () => 'id')
  assert.equal(normalized.columns.length, 3)
  assert.deepEqual(normalized.rows[0], ['a', 'b', 'c'])
})

test('parses common Spanish and international number formats', () => {
  assert.equal(parseLocalizedNumber('1.234,56'), 1234.56)
  assert.equal(parseLocalizedNumber('1,234.56'), 1234.56)
  assert.equal(parseLocalizedNumber('$ 2.500'), 2500)
  assert.equal(parseLocalizedNumber('-12,5'), -12.5)
  assert.equal(parseLocalizedNumber('sin dato'), null)
})

test('turns a spreadsheet clipboard into a grid', () => {
  assert.deepEqual(parsePastedGrid('Ana\tConfirmada\r\nLuis\tPendiente'), [['Ana', 'Confirmada'], ['Luis', 'Pendiente']])
})

test('protects text cells from CSV formula injection without changing numbers', () => {
  const columns = [{ name: 'Nombre', type: 'text' }, { name: 'Total', type: 'number' }]
  const csv = tableToCsv(columns, [['=HYPERLINK("x")', '-5']])
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/)
  assert.match(csv, /,"-5"/)
})
