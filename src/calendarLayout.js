function eventEnd(event) {
  return event.start + Math.max(30, Number(event.duration) || 0)
}

/**
 * Assigns overlapping calendar events to side-by-side columns.
 * Events connected through an overlap chain share the same column count,
 * which keeps the layout stable while dragging or resizing a block.
 */
export function layoutCalendarEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || eventEnd(b) - eventEnd(a))
  const layout = []
  let cluster = []
  let clusterEnd = -Infinity

  const flushCluster = () => {
    if (!cluster.length) return
    const columnEnds = []
    const placed = cluster.map((event) => {
      let column = columnEnds.findIndex((end) => end <= event.start)
      if (column === -1) column = columnEnds.length
      columnEnds[column] = eventEnd(event)
      return { event, column }
    })
    const columnCount = Math.max(1, columnEnds.length)
    placed.forEach((entry) => layout.push({ ...entry, columnCount }))
    cluster = []
    clusterEnd = -Infinity
  }

  sorted.forEach((event) => {
    if (cluster.length && event.start >= clusterEnd) flushCluster()
    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, eventEnd(event))
  })
  flushCluster()

  return layout
}
