export const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const COLORS = ['blue', 'purple', 'orange', 'green']

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const localDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Dates in the product are calendar dates, not UTC instants. Using
// toISOString() shifted them to the following day in American time zones.
const iso = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDateKey(date)
}

export function parseWorkspaceCache(raw) {
  if (!raw) return null
  try {
    return migrateWorkspace(JSON.parse(raw))
  } catch {
    return null
  }
}

const dateForWeekDay = (day, anchor = new Date()) => {
  const mondayOffset = (anchor.getDay() + 6) % 7
  const date = new Date(anchor)
  date.setHours(12, 0, 0, 0)
  date.setDate(anchor.getDate() - mondayOffset + Number(day || 0))
  return localDateKey(date)
}

export const initialWorkspace = () => {
  const tasks = [
    { id: uid(), title: 'Preparar propuesta de lanzamiento', done: false, date: iso(1), priority: 'Alta' },
    { id: uid(), title: 'Revisar notas de la reunión', done: true, date: iso(0), priority: 'Media' },
    { id: uid(), title: 'Enviar presupuesto final', done: false, date: iso(2), priority: 'Alta' },
  ]
  return {
    version: 5,
    tasks,
    projects: [
      { id: uid(), symbol: '◎', name: 'Renovación del portafolio', description: 'Contenido, sistema visual y publicación.', taskIds: [tasks[1].id] },
      { id: uid(), symbol: '↗', name: 'Lanzamiento Q4', description: 'Mensajes, calendario y materiales.', taskIds: [tasks[0].id, tasks[2].id] },
      { id: uid(), symbol: '◇', name: 'Ideas para explorar', description: 'Experimentos para el próximo ciclo.', taskIds: [] },
    ],
    events: [
      { id: uid(), title: 'Plan semanal', date: dateForWeekDay(0), day: 0, start: 540, duration: 60, color: 'orange' },
      { id: uid(), title: 'Trabajo profundo', date: dateForWeekDay(1), day: 1, start: 600, duration: 120, color: 'blue' },
      { id: uid(), title: 'Revisión de diseño', date: dateForWeekDay(2), day: 2, start: 780, duration: 75, color: 'purple' },
      { id: uid(), title: 'Reunión de equipo', date: dateForWeekDay(3), day: 3, start: 660, duration: 60, color: 'green' },
      { id: uid(), title: 'Cierre de la semana', date: dateForWeekDay(4), day: 4, start: 930, duration: 45, color: 'orange' },
    ],
  ideaBoard: {
    nodes: [
      { id: uid(), type: 'note', x: 150, y: 130, width: 260, height: 170, title: 'Concepto central', content: 'Arrastra ideas, conéctalas y conviértelas en trabajo concreto.', color: 'yellow', taskIds: [], projectIds: [] },
      { id: uid(), type: 'text', x: 560, y: 250, width: 300, height: 150, title: 'Próximo paso', content: 'Vincula esta idea con una tarea o proyecto.', color: 'blue', taskIds: [tasks[0].id], projectIds: [] },
    ],
    connections: [],
  },
  document: {
    title: 'Notas de trabajo',
    blocks: [
      { id: uid(), type: 'h2', content: 'Ideas para esta semana' },
      { id: uid(), type: 'bullet', content: 'Simplificar la propuesta principal' },
      { id: uid(), type: 'bullet', content: 'Pedir comentarios antes del jueves' },
      { id: uid(), type: 'bullet', content: 'Reservar tiempo sin reuniones' },
    ],
  },
  pages: [
    {
      id: uid(),
      title: 'Plan de lanzamiento',
      icon: '🚀',
      cover: 'sunset',
      blocks: [
        { id: uid(), type: 'h1', content: 'Plan de lanzamiento' },
        { id: uid(), type: 'text', content: 'Centraliza aquí las decisiones, tareas y proyectos relacionados.' },
      ],
      taskIds: [],
      projectIds: [],
    },
  ],
  trash: [],
  }
}

export function migrateWorkspace(value) {
  const base = initialWorkspace()
  if (!value || typeof value !== 'object') return base
  const note = value.document ?? value.note ?? base.document
  let blocks = note.blocks
  if (!Array.isArray(blocks)) {
    blocks = String(note.body ?? '').split('\n').map((line) => ({
      id: uid(), type: line.startsWith('• ') ? 'bullet' : 'text', content: line.replace(/^•\s*/, ''),
    }))
  }
  const pages = Array.isArray(value.pages) ? value.pages.map((page) => ({
    id: page.id || uid(),
    title: page.title || 'Sin título',
    icon: page.icon || '📄',
    cover: page.cover || '',
    blocks: Array.isArray(page.blocks) && page.blocks.length ? page.blocks : [{ id: uid(), type: 'text', content: '' }],
    taskIds: Array.isArray(page.taskIds) ? page.taskIds : [],
    projectIds: Array.isArray(page.projectIds) ? page.projectIds : [],
  })) : base.pages
  return {
    version: 5,
    tasks: Array.isArray(value.tasks) ? value.tasks : base.tasks,
    projects: Array.isArray(value.projects) ? value.projects.map((project) => ({ ...project, taskIds: Array.isArray(project.taskIds) ? project.taskIds : [] })) : base.projects,
    events: Array.isArray(value.events) ? value.events.map((event) => ({ ...event, date: event.date || dateForWeekDay(event.day), day: Number.isInteger(event.day) ? event.day : 0 })) : base.events,
    ideaBoard: value.ideaBoard && Array.isArray(value.ideaBoard.nodes) ? {
      nodes: value.ideaBoard.nodes.map((node) => ({ ...node, taskIds: Array.isArray(node.taskIds) ? node.taskIds : [], projectIds: Array.isArray(node.projectIds) ? node.projectIds : [] })),
      connections: Array.isArray(value.ideaBoard.connections) ? value.ideaBoard.connections : [],
    } : base.ideaBoard,
    document: { title: note.title || 'Notas de trabajo', blocks: blocks.length ? blocks : [{ id: uid(), type: 'text', content: '' }] },
    pages,
    trash: Array.isArray(value.trash) ? value.trash : [],
  }
}

export { uid, iso, localDateKey }
