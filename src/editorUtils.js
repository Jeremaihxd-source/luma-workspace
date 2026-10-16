const automaticBlocks = new Map([
  ['-', 'bullet'],
  ['*', 'bullet'],
  ['1.', 'numbered'],
  ['[]', 'todo'],
  ['[ ]', 'todo'],
  ['#', 'h1'],
  ['##', 'h2'],
  ['>', 'quote'],
])

export function automaticBlockType(value) {
  return automaticBlocks.get(String(value ?? '').replace(/\u00a0/g, ' ').trim()) || null
}

export function continuationBlockType(type) {
  return ['bullet', 'numbered', 'todo'].includes(type) ? type : 'text'
}

export function numberedBlockPosition(blocks, index) {
  if (blocks[index]?.type !== 'numbered') return null
  let position = 1
  for (let cursor = index - 1; cursor >= 0 && blocks[cursor]?.type === 'numbered'; cursor -= 1) position += 1
  return position
}

