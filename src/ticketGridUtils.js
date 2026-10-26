export const TICKET_GRID_LIMITS = { rows: 50, columns: 20 }

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(maximum, parsed))
}

export function createTicketGridData(rows = 5, columns = 10, startNumber = 1) {
  const safeRows = boundedInteger(rows, 5, TICKET_GRID_LIMITS.rows)
  const safeColumns = boundedInteger(columns, 10, TICKET_GRID_LIMITS.columns)
  return {
    name: 'Control de entradas',
    ticketRows: safeRows,
    ticketColumns: safeColumns,
    startNumber: boundedInteger(startNumber, 1, 999999),
    availableColor: '#ffffff',
    reservedColor: '#dcefe4',
    textColor: '#24251f',
    ticketCells: Array.from({ length: safeRows * safeColumns }, () => ({ text: '', reserved: false, color: '' })),
  }
}

export function normalizeTicketGrid(grid = {}) {
  const defaults = createTicketGridData(grid.ticketRows, grid.ticketColumns, grid.startNumber)
  const total = defaults.ticketRows * defaults.ticketColumns
  const sourceCells = Array.isArray(grid.ticketCells) ? grid.ticketCells : []
  return {
    name: String(grid.name || defaults.name),
    ticketRows: defaults.ticketRows,
    ticketColumns: defaults.ticketColumns,
    startNumber: boundedInteger(grid.startNumber, 1, 999999),
    availableColor: /^#[0-9a-f]{6}$/i.test(grid.availableColor) ? grid.availableColor : defaults.availableColor,
    reservedColor: /^#[0-9a-f]{6}$/i.test(grid.reservedColor) ? grid.reservedColor : defaults.reservedColor,
    textColor: /^#[0-9a-f]{6}$/i.test(grid.textColor) ? grid.textColor : defaults.textColor,
    ticketCells: Array.from({ length: total }, (_, index) => ({
      text: String(sourceCells[index]?.text || '').slice(0, 120),
      reserved: Boolean(sourceCells[index]?.reserved),
      color: /^#[0-9a-f]{6}$/i.test(sourceCells[index]?.color) ? sourceCells[index].color : '',
    })),
  }
}

export function resizeTicketGrid(grid, rows, columns) {
  const current = normalizeTicketGrid(grid)
  const nextRows = boundedInteger(rows, current.ticketRows, TICKET_GRID_LIMITS.rows)
  const nextColumns = boundedInteger(columns, current.ticketColumns, TICKET_GRID_LIMITS.columns)
  const cells = Array.from({ length: nextRows * nextColumns }, (_, nextIndex) => {
    const row = Math.floor(nextIndex / nextColumns)
    const column = nextIndex % nextColumns
    if (row >= current.ticketRows || column >= current.ticketColumns) return { text: '', reserved: false, color: '' }
    return current.ticketCells[row * current.ticketColumns + column]
  })
  return { ...current, ticketRows: nextRows, ticketColumns: nextColumns, ticketCells: cells }
}

export function ticketNumber(grid, index) {
  return boundedInteger(grid?.startNumber, 1, 999999) + index
}
