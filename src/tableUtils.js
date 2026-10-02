const DEFAULT_MIN_COLUMNS = 2

export function tableColumnCount(columns = [], rows = [], minimum = DEFAULT_MIN_COLUMNS) {
  const widestRow = Array.isArray(rows)
    ? rows.reduce((widest, row) => Math.max(widest, Array.isArray(row) ? row.length : 0), 0)
    : 0
  return Math.max(Array.isArray(columns) ? columns.length : 0, widestRow, minimum)
}

export function normalizeTableData(table, createId = () => crypto.randomUUID()) {
  const sourceRows = Array.isArray(table?.rows) ? table.rows : []
  const sourceColumns = Array.isArray(table?.columns) ? table.columns : []
  const count = tableColumnCount(sourceColumns, sourceRows)
  const columns = Array.from({ length: count }, (_, index) => ({
    id: sourceColumns[index]?.id || createId(),
    name: String(sourceColumns[index]?.name || `Columna ${index + 1}`),
    type: ['text', 'number', 'currency', 'date', 'checkbox'].includes(sourceColumns[index]?.type)
      ? sourceColumns[index].type
      : 'text',
  }))
  const rows = (sourceRows.length ? sourceRows : [Array(count).fill('')]).map((row) => {
    const safeRow = Array.isArray(row) ? row.slice(0, count) : []
    return [...safeRow, ...Array(Math.max(0, count - safeRow.length)).fill('')]
  })
  return { columns, rows }
}

export function parseLocalizedNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let text = String(value ?? '').trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!text || !/\d/.test(text)) return null

  const negative = text.startsWith('-')
  text = text.replace(/-/g, '')
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  const separator = Math.max(comma, dot)
  if (separator >= 0) {
    const fractionLength = text.length - separator - 1
    const sameSeparatorCount = [...text].filter((character) => character === text[separator]).length
    const looksLikeThousands = fractionLength === 3 && sameSeparatorCount >= 1 && !text.includes(text[separator] === ',' ? '.' : ',')
    if (looksLikeThousands) text = text.replace(/[.,]/g, '')
    else {
      const integer = text.slice(0, separator).replace(/[.,]/g, '')
      const fraction = text.slice(separator + 1).replace(/[.,]/g, '')
      text = `${integer}.${fraction}`
    }
  }
  const parsed = Number(`${negative ? '-' : ''}${text}`)
  return Number.isFinite(parsed) ? parsed : null
}

export function parsePastedGrid(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((row, index, all) => row.length > 0 || index < all.length - 1)
    .map((row) => row.split('\t'))
}

function protectCsvFormula(value, type) {
  const text = String(value ?? '')
  return type === 'text' && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
}

function quoteCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function tableToCsv(columns, rows) {
  return [
    columns.map((column) => quoteCsv(column.name)).join(','),
    ...rows.map((row) => row.map((value, index) => quoteCsv(protectCsvFormula(value, columns[index]?.type))).join(',')),
  ].join('\r\n')
}
