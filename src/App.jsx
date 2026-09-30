import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Bold, CalendarDays, Check, CheckSquare, ChevronDown, ChevronLeft,
  ChevronRight, Cloud, Copy, Download, FileText, Files, FolderKanban,
  GripVertical, Grid3X3, Hand, HardDrive, Home, Image as ImageIcon, Italic, Link as LinkIcon,
  Link2, LogOut, Menu, MoreHorizontal, PenTool, Plus, Search, Settings,
  MousePointer2, Share2, StickyNote, Trash2, Type, Underline, Unlink, Upload, Users, X,
} from 'lucide-react'
import { getAuthRedirectUrl, supabase, supabaseConfigured } from './lib/supabase'
import { layoutCalendarEvents } from './calendarLayout'
import { COLORS, DAYS, initialWorkspace, iso, localDateKey, migrateWorkspace, uid } from './state'

const navItems = [
  ['home', Home, 'Inicio'], ['agenda', CalendarDays, 'Agenda'], ['tasks', CheckSquare, 'Tareas'],
  ['projects', FolderKanban, 'Proyectos'], ['notes', FileText, 'Notas'], ['ideas', PenTool, 'Ideas'], ['files', Files, 'Archivos'],
]
const navGroups = [
  { label: 'Planificar', ids: ['home', 'agenda', 'tasks', 'projects'] },
  { label: 'Crear y compartir', ids: ['notes', 'ideas', 'files'] },
]
const priorityClass = { Alta: '', Media: 'medium', Baja: 'low' }
const colorNames = { blue: 'Azul', purple: 'Violeta', orange: 'Naranja', green: 'Verde' }

export default function App() {
  const [session, setSession] = useState(undefined)
  const legalPage = window.location.pathname === '/privacidad'
    ? 'privacy'
    : window.location.pathname === '/terminos' ? 'terms' : null

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (legalPage) return <LegalPage type={legalPage} />
  if (session === undefined) return <LoadingScreen label="Abriendo tu espacio…" />
  if (supabaseConfigured && !session) return <AuthScreen />
  return <Workspace session={session} />
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [pendingEmail, setPendingEmail] = useState('')

  function authErrorMessage(error) {
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') {
      return 'Se alcanzó el límite temporal de correos. Espera unos minutos o continúa con Google.'
    }
    if (error?.code === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión.'
    if (error?.code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.'
    return error?.message || 'No pudimos completar la solicitud. Inténtalo de nuevo.'
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    const result = mode === 'register'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthRedirectUrl() } })
      : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setMessage({ type: 'error', text: authErrorMessage(result.error) })
    else if (mode === 'register' && !result.data.session) { setPendingEmail(email); setMessage({ type: 'success', text: 'Revisa tu correo para confirmar la cuenta.' }) }
    setBusy(false)
  }

  async function resendConfirmation() {
    if (!pendingEmail) return
    setBusy(true); setMessage(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: getAuthRedirectUrl() } })
    setMessage(error ? { type: 'error', text: authErrorMessage(error) } : { type: 'success', text: 'Enviamos un nuevo enlace de confirmación.' })
    setBusy(false)
  }

  async function signInWithGoogle() {
    setBusy(true); setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() },
    })
    if (error) { setMessage({ type: 'error', text: authErrorMessage(error) }); setBusy(false) }
  }

  return <div className="auth-screen">
    <section className="auth-panel"><div className="auth-card">
      <div className="auth-brand"><span className="brand-mark">L</span>Luma Workspace</div>
      <h1>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu espacio'}</h1>
      <p>{mode === 'login' ? 'Entra para continuar donde lo dejaste.' : 'Tus tareas, proyectos, agenda y notas sincronizados.'}</p>
      <button type="button" className="auth-google" disabled={busy} onClick={signInWithGoogle}>
        <GoogleMark /> Continuar con Google
      </button>
      <div className="auth-divider"><span>o continúa con correo</span></div>
      <form className="auth-form" onSubmit={submit}>
        <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Contraseña</span><input name="password" type="password" minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        {message && <div className={message.type === 'error' ? 'auth-error' : 'auth-success'}>{message.text}</div>}
        {mode === 'register' && pendingEmail && <button type="button" className="auth-resend" disabled={busy} onClick={resendConfirmation}>Reenviar correo de confirmación</button>}
        <button className="primary" disabled={busy}>{busy ? 'Espera…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <div className="auth-switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(null); setPendingEmail('') }}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></div>
      <nav className="auth-legal" aria-label="Información legal">
        <a href="/privacidad">Privacidad</a><span>·</span><a href="/terminos">Términos</a>
      </nav>
    </div></section>
    <section className="auth-visual"><h2>Un lugar tranquilo para hacer avanzar tu trabajo.</h2><p>Planifica la semana, transforma ideas en tareas y mantén tus proyectos al día.</p></section>
  </div>
}

function LegalPage({ type }) {
  const privacy = type === 'privacy'
  return <main className="legal-page">
    <article className="legal-card">
      <a className="legal-brand" href="/"><span className="brand-mark">L</span>Luma Workspace</a>
      <p className="legal-kicker">Información legal</p>
      <h1>{privacy ? 'Política de privacidad' : 'Condiciones del servicio'}</h1>
      <p className="legal-updated">Última actualización: 29 de septiembre de 2026</p>
      {privacy ? <>
        <section><h2>Qué información tratamos</h2><p>Cuando creas una cuenta podemos tratar tu nombre, correo electrónico, identificador de usuario y foto de perfil. También guardamos el contenido que decides crear en Luma Workspace, como tareas, proyectos, notas, eventos, archivos y espacios compartidos.</p></section>
        <section><h2>Cómo usamos la información</h2><p>La utilizamos únicamente para autenticarte, sincronizar tu espacio de trabajo, habilitar la colaboración, mantener la seguridad y mejorar el funcionamiento del servicio. No vendemos tus datos personales.</p></section>
        <section><h2>Proveedores y almacenamiento</h2><p>La autenticación y la base de datos se gestionan mediante Supabase. Si eliges “Continuar con Google”, Google comparte con nosotros los datos básicos de perfil que autorices. Esos proveedores pueden procesar datos de acuerdo con sus propias políticas y medidas de seguridad.</p></section>
        <section><h2>Compartir y conservar</h2><p>El contenido de un espacio colaborativo es visible para sus miembros. Conservamos la información mientras tu cuenta o espacio permanezca activo y durante el tiempo razonablemente necesario para seguridad, copias de respaldo u obligaciones legales.</p></section>
        <section><h2>Tus opciones</h2><p>Puedes dejar de usar el servicio, cerrar sesión o solicitar acceso, corrección o eliminación de tus datos. También puedes revocar el acceso de Google desde la configuración de tu cuenta de Google.</p></section>
        <section><h2>Contacto</h2><p>Para preguntas de privacidad o solicitudes relacionadas con tus datos, escribe a <a href="mailto:zevallosronald836@gmail.com">zevallosronald836@gmail.com</a>.</p></section>
      </> : <>
        <section><h2>Uso del servicio</h2><p>Luma Workspace ofrece herramientas de productividad y colaboración. Debes usar el servicio de forma legal, proteger el acceso a tu cuenta y mantener información correcta al registrarte.</p></section>
        <section><h2>Tu contenido</h2><p>Conservas la titularidad de lo que creas. Nos autorizas a almacenar y procesar ese contenido únicamente para operar, sincronizar y mostrar el servicio a ti y a los miembros de los espacios con quienes lo compartas.</p></section>
        <section><h2>Colaboración</h2><p>Al invitar personas a un espacio, eres responsable de contar con autorización para compartir su información y el contenido correspondiente. Los miembros pueden ver o modificar los recursos según los permisos disponibles.</p></section>
        <section><h2>Conductas no permitidas</h2><p>No puedes intentar vulnerar el servicio, acceder a cuentas ajenas, distribuir contenido ilegal o dañino, ni utilizar la plataforma para abusar de otras personas o infringir sus derechos.</p></section>
        <section><h2>Disponibilidad y cambios</h2><p>El servicio se proporciona según disponibilidad y puede evolucionar. Procuraremos mantenerlo seguro y funcional, pero no garantizamos que esté libre de interrupciones. Los cambios importantes de estas condiciones se indicarán actualizando esta página.</p></section>
        <section><h2>Contacto</h2><p>Si tienes preguntas sobre estas condiciones, escribe a <a href="mailto:zevallosronald836@gmail.com">zevallosronald836@gmail.com</a>.</p></section>
      </>}
      <footer><a href="/">Volver a Luma Workspace</a><span>·</span><a href={privacy ? '/terminos' : '/privacidad'}>{privacy ? 'Condiciones del servicio' : 'Política de privacidad'}</a></footer>
    </article>
  </main>
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.53l3.35-2.61Z" />
    <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" />
  </svg>
}

function Workspace({ session }) {
  const [view, setView] = useState(() => localStorage.getItem('luma-react-view') || 'home')
  const [agendaMode, setAgendaMode] = useState('schedule')
  const [agendaDate, setAgendaDate] = useState(() => localDateKey(new Date()))
  const [workspace, setWorkspace] = useState(null)
  const [spaces, setSpaces] = useState([])
  const [activeSpaceId, setActiveSpaceId] = useState(() => localStorage.getItem('luma-active-space'))
  const [syncState, setSyncState] = useState('loading')
  const [modal, setModal] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pagesOpen, setPagesOpen] = useState(true)
  const saveTimer = useRef(null)
  const hydrated = useRef(false)
  const skipNextSave = useRef(false)
  const cacheKey = activeSpaceId ? `luma-space-${activeSpaceId}` : `luma-workspace-${session?.user.id || 'local'}`

  const loadSpaces = useCallback(async (preferredId) => {
    const { data, error } = await supabase.from('workspace_members')
      .select('role, joined_at, workspace_id, workspaces!inner(id,name,owner_id,state,updated_at)')
      .eq('user_id', session.user.id).order('joined_at')
    if (error) throw error
    const next = (data || []).map((membership) => ({ ...membership.workspaces, role: membership.role }))
    setSpaces(next)
    const selected = preferredId && next.some((space) => space.id === preferredId)
      ? preferredId : activeSpaceId && next.some((space) => space.id === activeSpaceId)
        ? activeSpaceId : next[0]?.id
    if (selected) { setActiveSpaceId(selected); localStorage.setItem('luma-active-space', selected) }
    return next
  }, [activeSpaceId, session.user.id])

  useEffect(() => {
    let alive = true
    async function hydrate() {
      try {
        let nextSpaces = await loadSpaces(activeSpaceId)
        const inviteCode = new URLSearchParams(window.location.search).get('invite')
        if (inviteCode) {
          const { data: joined, error: inviteError } = await supabase.rpc('accept_workspace_invite', { p_code: inviteCode })
          if (!inviteError) { nextSpaces = await loadSpaces(joined); window.history.replaceState({}, '', window.location.pathname) }
        }
        if (!nextSpaces.length) {
          const cached = localStorage.getItem(`luma-workspace-${session.user.id}`) || localStorage.getItem('luma-workspace-v2')
          let seed = cached ? migrateWorkspace(JSON.parse(cached)) : initialWorkspace()
          const { data: legacy } = await supabase.from('user_workspaces').select('state').eq('user_id', session.user.id).maybeSingle()
          if (legacy?.state) seed = migrateWorkspace(legacy.state)
          const { data: created, error } = await supabase.rpc('create_workspace', { p_name: 'Mi espacio', p_state: seed })
          if (error) throw error
          nextSpaces = await loadSpaces(created)
        }
        if (!alive) return
        const selected = nextSpaces.find((space) => space.id === (activeSpaceId || localStorage.getItem('luma-active-space'))) || nextSpaces[0]
        if (selected) { skipNextSave.current = true; hydrated.current = true; setWorkspace(migrateWorkspace(selected.state)); setSyncState('synced') }
      } catch (error) { console.error(error); if (alive) setSyncState('error') }
    }
    hydrate(); return () => { alive = false }
  }, [session.user.id])

  useEffect(() => {
    const selected = spaces.find((space) => space.id === activeSpaceId)
    if (!selected) return
    skipNextSave.current = true
    hydrated.current = true
    setWorkspace(migrateWorkspace(selected.state))
    localStorage.setItem('luma-active-space', selected.id)
  }, [activeSpaceId])

  const activeRole = spaces.find((space) => space.id === activeSpaceId)?.role
  useEffect(() => {
    if (!workspace || !hydrated.current) return
    localStorage.setItem(cacheKey, JSON.stringify(workspace))
    if (skipNextSave.current) { skipNextSave.current = false; return }
    if (activeRole === 'viewer') return
    setSyncState('saving'); clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('workspaces').update({ state: workspace }).eq('id', activeSpaceId)
      if (!error) setSpaces((current) => current.map((space) => space.id === activeSpaceId ? { ...space, state: workspace } : space))
      setSyncState(error ? 'error' : 'synced')
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [workspace, cacheKey, activeSpaceId, activeRole])

  useEffect(() => {
    if (!activeSpaceId) return
    const channel = supabase.channel(`workspace:${activeSpaceId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${activeSpaceId}`,
    }, ({ new: next }) => {
      const incoming = migrateWorkspace(next.state)
      skipNextSave.current = true; setWorkspace(incoming); setSyncState('synced')
      setSpaces((current) => current.map((space) => space.id === activeSpaceId ? { ...space, ...next } : space))
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSpaceId])

  const selectSpace = (id) => { hydrated.current = false; skipNextSave.current = true; setActiveSpaceId(id); setView('agenda'); setMobileOpen(false) }
  const createSpace = async (name) => {
    const { data, error } = await supabase.rpc('create_workspace', { p_name: name, p_state: initialWorkspace() })
    if (error) throw error
    await loadSpaces(data); selectSpace(data)
  }
  const joinSpace = async (code) => {
    const normalized = code.includes('invite=') ? new URL(code, window.location.origin).searchParams.get('invite') : code
    const { data, error } = await supabase.rpc('accept_workspace_invite', { p_code: normalized })
    if (error) throw error
    await loadSpaces(data); selectSpace(data)
  }

  const go = (next) => { setView(next); localStorage.setItem('luma-react-view', next); setMobileOpen(false) }
  if (!workspace) return <LoadingScreen label="Cargando tus datos…" />

  const pending = workspace.tasks.filter((task) => !task.done).length
  const activeSpace = spaces.find((space) => space.id === activeSpaceId)
  const canEdit = activeSpace?.role !== 'viewer'
  const update = (recipe) => { if (canEdit) setWorkspace((current) => recipe(structuredClone(current))) }
  const currentPage = view.startsWith('page:') ? workspace.pages.find((page) => page.id === view.slice(5)) : null
  const createPage = () => {
    if (!canEdit) return
    const page = { id: uid(), title: 'Sin título', icon: '📄', cover: '', blocks: [{ id: uid(), type: 'text', content: '' }], taskIds: [], projectIds: [] }
    update((draft) => { draft.pages.push(page); return draft })
    go(`page:${page.id}`)
  }
  const moveToTrash = (type, item) => update((draft) => {
    const key = type === 'task' ? 'tasks' : type === 'project' ? 'projects' : 'events'
    draft[key] = draft[key].filter((entry) => entry.id !== item.id)
    draft.trash.unshift({ id: uid(), type, item }); return draft
  })

  const createActions = [
    { icon: CheckSquare, label: 'Nueva tarea', hint: 'Añádela a tu lista', onSelect: () => setModal({ type: 'task' }) },
    { icon: CalendarDays, label: 'Bloque de agenda', hint: 'Reserva tiempo', onSelect: () => setModal({ type: 'event', draft: { date: agendaDate } }) },
    { icon: FolderKanban, label: 'Nuevo proyecto', hint: 'Agrupa tareas', onSelect: () => setModal({ type: 'project' }) },
    { icon: FileText, label: 'Página en blanco', hint: 'Escribe y conecta', onSelect: createPage },
  ]
  const workspaceActions = [
    { icon: Plus, label: 'Nuevo espacio', onSelect: () => setModal({ type: 'createSpace' }) },
    { icon: Users, label: 'Unirme a un espacio', onSelect: () => setModal({ type: 'joinSpace' }) },
    { icon: Share2, label: 'Compartir equipo', onSelect: () => setModal({ type: 'share' }) },
    { divider: true },
    { icon: Settings, label: 'Ajustes y cuenta', onSelect: () => setModal({ type: 'settings' }) },
  ]

  return <div className={`shell ${view === 'ideas' ? 'idea-mode' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark">L</span><div>Luma<small>Workspace</small></div></div>
      <div className="space-switcher compact"><select aria-label="Espacio de trabajo" value={activeSpaceId || ''} onChange={(e) => selectSpace(e.target.value)}>{spaces.map((space) => <option value={space.id} key={space.id}>{space.name}</option>)}</select><ActionMenu ariaLabel="Opciones del espacio" trigger={<MoreHorizontal size={17}/>} items={workspaceActions}/></div>
      <div className="quick"><ActionMenu className="create-menu" trigger={<><Plus size={16}/> Crear <ChevronDown size={14}/></>} items={createActions}/><button className="square" aria-label="Buscar en el espacio" title="Buscar" onClick={() => setSearchOpen(true)}><Search size={18}/></button></div>
      <div className="sidebar-nav-scroll">{navGroups.map((group) => <section className="nav-group" key={group.label}><div className="nav-label">{group.label}</div><nav className="nav">{group.ids.map((id) => { const [, Icon, label] = navItems.find((item) => item[0] === id); return <button key={id} className={`nav-btn ${view === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={17}/>{label}{id === 'tasks' && pending > 0 && <span className="nav-count">{pending}</span>}</button> })}</nav></section>)}
        <div className="nav-label pages-label"><button className="pages-toggle" onClick={() => setPagesOpen((value) => !value)}><ChevronRight className={pagesOpen ? 'rotated' : ''} size={14}/> Mis páginas</button><button aria-label="Nueva página" onClick={createPage}><Plus size={14}/></button></div>
        {pagesOpen && <nav className="nav page-nav">{workspace.pages.map((page) => <button key={page.id} className={`nav-btn ${view === `page:${page.id}` ? 'active' : ''}`} onClick={() => go(`page:${page.id}`)}><span className="page-icon">{page.icon || '📄'}</span><span className="page-nav-title">{page.title || 'Sin título'}</span></button>)}</nav>}
      </div>
      <div className="sidebar-foot"><button className={`nav-btn ${view === 'trash' ? 'active' : ''}`} onClick={() => go('trash')}><Trash2 size={17}/>Papelera{workspace.trash.length > 0 && <span className="nav-count">{workspace.trash.length}</span>}</button><div className="account-summary"><span>{session.user.email?.slice(0, 1).toUpperCase()}</span><div><strong>{session.user.email?.split('@')[0]}</strong><small>{activeSpace?.role === 'owner' ? 'Propietario' : activeSpace?.role === 'editor' ? 'Editor' : 'Lector'}</small></div></div></div>
    </aside>
    <div className={`mobile-backdrop ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
    <main className="main">
      <header className="topbar"><button className="ghost mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={18}/></button><div className="topbar-title"><span className="page-name">{currentPage ? `${currentPage.icon || '📄'} ${currentPage.title || 'Sin título'}` : viewTitle(view)}</span><span>{activeSpace?.name}</span></div><div className="top-actions"><SyncStatus state={syncState}/><button className={`ghost calendar-top ${view === 'agenda' && agendaMode === 'calendar' ? 'active' : ''}`} onClick={() => { go('agenda'); setAgendaMode(agendaMode === 'calendar' && view === 'agenda' ? 'schedule' : 'calendar') }}><CalendarDays size={15}/> {view === 'agenda' && agendaMode === 'calendar' ? 'Horario' : 'Calendario'}</button><button className="square top-search" aria-label="Buscar" title="Buscar" onClick={() => setSearchOpen(true)}><Search size={17}/></button>{canEdit && <ActionMenu align="right" className="top-create" trigger={<><Plus size={16}/> Crear <ChevronDown size={14}/></>} items={createActions}/>}<ActionMenu align="right" ariaLabel="Más opciones" trigger={<MoreHorizontal size={18}/>} items={[{ icon: Share2, label: 'Compartir espacio', onSelect: () => setModal({ type: 'share' }) }, { icon: Settings, label: 'Ajustes', onSelect: () => setModal({ type: 'settings' }) }]}/></div></header>
      <div className="content">
        {!supabaseConfigured && <div className="notice-banner">Modo local activo. Conecta Supabase para habilitar cuentas y sincronización entre dispositivos.</div>}
        {view === 'home' && <Dashboard workspace={workspace} go={go} update={update}/>} 
        {view === 'agenda' && <Agenda workspace={workspace} update={update} setModal={setModal} mode={agendaMode} setMode={setAgendaMode} selectedDate={agendaDate} setSelectedDate={setAgendaDate}/>}
        {view === 'tasks' && <Tasks workspace={workspace} update={update} setModal={setModal}/>} 
        {view === 'projects' && <Projects workspace={workspace} update={update} setModal={setModal}/>} 
        {view === 'notes' && <Notes key={`${activeSpaceId}:notes`} workspace={workspace} update={update}/>}
        {view === 'ideas' && <IdeasBoard workspace={workspace} update={update} go={go} syncState={syncState} setModal={setModal}/>}
        {view === 'files' && <WorkspaceFiles space={activeSpace} canEdit={canEdit} session={session}/>}
        {view === 'trash' && <Trash workspace={workspace} update={update}/>} 
        {currentPage && <Notes key={`${activeSpaceId}:${currentPage.id}`} workspace={workspace} update={update} pageId={currentPage.id}/>}
      </div>
    </main>
    {searchOpen && <SearchPalette workspace={workspace} go={go} close={() => setSearchOpen(false)}/>} 
    {modal && <ModalController modal={modal} close={() => setModal(null)} workspace={workspace} update={update} moveToTrash={moveToTrash} session={session} activeSpace={activeSpace} createSpace={createSpace} joinSpace={joinSpace} canEdit={canEdit}/>}
  </div>
}

function ActionMenu({ trigger, items, className = '', align = 'left', ariaLabel = 'Abrir menú' }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div ref={root} className={`action-menu ${className}`}>
    <button type="button" className="action-menu-trigger" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{trigger}</button>
    {open && <div className={`action-menu-popover ${align === 'right' ? 'align-right' : ''}`} role="menu">{items.map((item, index) => item.divider ? <div className="menu-divider" key={`divider-${index}`}/> : <button type="button" role="menuitem" className={item.danger ? 'danger' : ''} key={item.label} onClick={() => { setOpen(false); item.onSelect?.() }}>{item.icon && <item.icon size={16}/>}<span><strong>{item.label}</strong>{item.hint && <small>{item.hint}</small>}</span></button>)}</div>}
  </div>
}

function LoadingScreen({ label }) { return <div className="loading-screen"><div><div className="spinner"/>{label}</div></div> }
function SyncStatus({ state }) { const local = state === 'local'; const label = state === 'saving' ? 'Guardando…' : state === 'error' ? 'Error de sincronización' : local ? 'Guardado local' : 'Sincronizado'; return <span className="sync-pill" title={label}>{local ? <HardDrive size={13}/> : <Cloud size={13}/>}<i className={`sync-dot ${local ? 'local' : ''}`}/><span>{label}</span></span> }
function viewTitle(view) { return { home: 'Inicio', agenda: 'Agenda y calendario', tasks: 'Tareas', projects: 'Proyectos', notes: 'Notas', ideas: 'Ideas', files: 'Archivos compartidos', trash: 'Papelera' }[view] ?? 'Luma' }
function openContextModal(view, setModal) { if (view === 'agenda') setModal({ type: 'event' }); else if (view === 'projects') setModal({ type: 'project' }); else if (view === 'notes') setModal({ type: 'noteBlock' }); else setModal({ type: 'task' }) }

function Dashboard({ workspace, go, update }) {
  const todo = workspace.tasks.filter((task) => !task.done)
  const upcoming = [...workspace.events].filter((event) => event.date >= localDateKey(new Date())).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).slice(0, 4)
  const progress = workspace.projects.length ? Math.round(workspace.projects.reduce((sum, project) => sum + projectStats(project, workspace.tasks).progress, 0) / workspace.projects.length) : 0
  return <><ViewHead eyebrow="Resumen" title="Hoy" subtitle="Empieza por lo importante y abre los detalles solo cuando los necesites." action={<button className="ghost" onClick={() => go('agenda')}>Abrir agenda <ChevronRight size={15}/></button>}/><div className="metrics"><Metric value={todo.length} label="pendientes"/><Metric value={upcoming.length} label="próximos bloques"/><Metric value={`${progress}%`} label="progreso"/></div><div className="dashboard-grid"><section className="panel"><h2>Siguientes tareas</h2><div className="list">{todo.slice(0, 5).map((task) => <label className="list-row" key={task.id}><input className="check" type="checkbox" checked={task.done} onChange={(e) => update((draft) => { draft.tasks.find((x) => x.id === task.id).done = e.target.checked; return draft })}/><span>{task.title}</span><Priority value={task.priority}/></label>)}{!todo.length && <Empty text="No tienes tareas pendientes."/>}</div></section><section className="panel"><h2>Próximos bloques</h2><div className="list">{upcoming.map((event) => <button className="list-row result" key={event.id} onClick={() => go('agenda')}><span>{formatTinyDate(parseDate(event.date))}</span><div><strong>{event.title}</strong><div className="top-date">{clock(event.start)} · {event.duration} min</div></div><ChevronRight size={16}/></button>)}{!upcoming.length && <Empty text="No hay bloques próximos."/>}</div></section></div></>
}
function Metric({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }
function ViewHead({ eyebrow, title, subtitle, action }) { return <div className="view-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div> }

function Agenda({ workspace, update, setModal, mode, setMode, selectedDate, setSelectedDate }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const anchor = parseDate(selectedDate)
  const dates = weekDates(anchor)
  if (mode === 'calendar') return <CalendarView workspace={workspace} update={update} setModal={setModal} setMode={setMode} setSelectedDate={setSelectedDate}/>
  const shiftWeek = (amount) => setSelectedDate(localDateKey(addDays(anchor, amount * 7)))
  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(anchor)
  return <><ViewHead eyebrow="Planificación" title={capitalize(monthLabel)} subtitle="Horario completo de 24 horas. Arrastra bloques entre días y estira el borde inferior para cambiar la duración." action={<div className="agenda-actions"><button className="ghost" onClick={() => shiftWeek(-1)} aria-label="Semana anterior"><ChevronLeft size={16}/></button><button className="ghost" onClick={() => setSelectedDate(localDateKey(new Date()))}>Hoy</button><button className="ghost" onClick={() => shiftWeek(1)} aria-label="Semana siguiente"><ChevronRight size={16}/></button><button className="primary" onClick={() => setModal({ type: 'event', draft: { date: selectedDate } })}><Plus size={15}/> Bloque</button></div>}/><section className="agenda-shell"><div className="week-scroll"><div className="week expanded"><div className="week-head"><div/>{DAYS.map((day, index) => { const key = localDateKey(dates[index]); const count = workspace.tasks.filter((task) => task.date === key).length; return <button key={day} className={`day-head ${sameDay(dates[index], now) ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(key)}><span>{day}</span><strong>{dates[index].getDate()}</strong>{count > 0 && <small>{count} tarea{count === 1 ? '' : 's'}</small>}</button> })}</div><div className="week-body expanded"><div className="time-rail">{Array.from({ length: 25 }, (_, hour) => <span className="hour" style={{ top: hour * 60 }} key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="day-columns">{dates.map((date, day) => { const dateKey = localDateKey(date); const dayEvents = layoutCalendarEvents(workspace.events.filter((event) => event.date === dateKey)); const currentMinute = now.getHours() * 60 + now.getMinutes(); return <div key={dateKey} className={`day-col ${dateKey === selectedDate ? 'selected' : ''}`} onDoubleClick={(e) => { if (e.target.closest('.event')) return; const rect = e.currentTarget.getBoundingClientRect(); setModal({ type: 'event', draft: { date: dateKey, day, start: clamp(snap(e.clientY - rect.top), 0, 1410) } }) }}>{sameDay(date, now) && <div className="now-line" style={{ top: currentMinute }} aria-label={`Hora actual: ${clock(currentMinute)}`}><span/></div>}{dayEvents.map(({ event, column, columnCount }) => <EventBlock key={event.id} event={event} dates={dates} update={update} column={column} columnCount={columnCount} edit={() => setModal({ type: 'event', item: event })}/>)}</div> })}</div></div></div></div><div className="drag-hint">Doble clic en una hora libre para crear un bloque. Los eventos simultáneos se organizan automáticamente en columnas.</div></section></>
}

function CalendarView({ workspace, update, setModal, setMode, setSelectedDate }) {
  const today = startOfDay(new Date())
  const minDate = addDays(today, -15)
  const maxDate = addMonths(today, 2)
  const start = startOfWeek(minDate)
  const end = endOfWeek(maxDate)
  const days = dateRange(start, end)
  const [focusedDay, setFocusedDay] = useState(localDateKey(today))
  const lastTap = useRef({ key: '', at: 0 })
  const openDay = (date) => { setSelectedDate(localDateKey(date)); setMode('schedule') }
  const selectDay = (date) => {
    const key = localDateKey(date)
    if (!window.matchMedia('(max-width: 760px)').matches) { openDay(date); return }
    const tappedAt = Date.now()
    setFocusedDay(key); setSelectedDate(key)
    if (lastTap.current.key === key && tappedAt - lastTap.current.at < 360) {
      lastTap.current = { key: '', at: 0 }; setMode('schedule'); return
    }
    lastTap.current = { key, at: tappedAt }
  }
  const focusedDate = parseDate(focusedDay)
  const focusedTasks = workspace.tasks.filter((task) => task.date === focusedDay)
  const focusedEvents = workspace.events.filter((event) => event.date === focusedDay).sort((a, b) => a.start - b.start)
  const focusedLabel = capitalize(new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(focusedDate))
  return <><ViewHead eyebrow="Calendario" title="Tu actividad por días" subtitle="Consulta los últimos 15 días y planifica hasta dos meses. En móvil, toca un día para ver sus eventos y tócalo dos veces para abrir el horario." action={<button className="primary" onClick={() => { setSelectedDate(localDateKey(today)); setMode('schedule') }}><CalendarDays size={15}/> Ir a hoy</button>}/><div className="calendar-range"><span>{formatShortDate(minDate)}</span><div/><span>{formatShortDate(maxDate)}</span></div><section className="calendar-board"><div className="calendar-weekdays">{DAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((date) => { const key = localDateKey(date); const available = date >= minDate && date <= maxDate; const tasks = workspace.tasks.filter((task) => task.date === key); const events = workspace.events.filter((event) => event.date === key); const done = tasks.filter((task) => task.done).length; return <button key={key} disabled={!available} className={`calendar-day ${sameDay(date, today) ? 'today' : ''} ${key === focusedDay ? 'selected' : ''} ${!available ? 'outside' : ''}`} onClick={() => selectDay(date)} aria-label={`${formatShortDate(date)}. ${tasks.length} tareas y ${events.length} eventos`}><header><span>{date.getDate()}</span><small>{date.getDate() === 1 || date.getTime() === start.getTime() ? new Intl.DateTimeFormat('es', { month: 'short' }).format(date) : ''}</small></header><div className="calendar-items">{tasks.slice(0, 3).map((task) => <span key={task.id} className={task.done ? 'is-done' : ''}><i/>{task.title}</span>)}{events.slice(0, Math.max(0, 3 - tasks.length)).map((event) => <span key={event.id} className={`calendar-event ${event.color}`}><i/>{clock(event.start)} {event.title}</span>)}</div>{(tasks.length > 3 || events.length > Math.max(0, 3 - tasks.length)) && <small className="more-items">+{tasks.length + events.length - 3} más</small>}<footer>{tasks.length ? <><b>{tasks.length - done} por hacer</b><span>{done} hechas</span></> : events.length ? <span>{events.length} bloque{events.length === 1 ? '' : 's'}</span> : <span>Libre</span>}</footer></button> })}</div></section><section className="mobile-day-agenda" aria-live="polite"><header><div><span>{focusedDate.getDate()}</span><div><strong>{focusedLabel}</strong><small>{focusedTasks.length + focusedEvents.length ? `${focusedTasks.length} tarea${focusedTasks.length === 1 ? '' : 's'} · ${focusedEvents.length} bloque${focusedEvents.length === 1 ? '' : 's'}` : 'Sin actividad planificada'}</small></div></div><button className="ghost" onClick={() => { setSelectedDate(focusedDay); setMode('schedule') }}>Abrir horario <ChevronRight size={15}/></button></header><div className="mobile-day-list">{focusedEvents.map((event) => <button className={`mobile-agenda-event ${event.color || 'blue'}`} key={event.id} onClick={() => setModal({ type: 'event', item: event })}><time>{clock(event.start)}<small>{event.duration} min</small></time><span><strong>{event.title}</strong><small>Bloque de agenda</small></span><ChevronRight size={16}/></button>)}{focusedTasks.map((task) => <label className={`mobile-agenda-task ${task.done ? 'done' : ''}`} key={task.id}><input className="check" type="checkbox" checked={task.done} onChange={(event) => update((draft) => { draft.tasks.find((item) => item.id === task.id).done = event.target.checked; return draft })}/><span><strong>{task.title}</strong><small>{task.done ? 'Completada' : `${task.priority || 'Media'} prioridad`}</small></span></label>)}{!focusedTasks.length && !focusedEvents.length && <div className="mobile-day-empty"><CalendarDays size={22}/><span>Este día está libre.</span><button onClick={() => setModal({ type: 'event', draft: { date: focusedDay } })}>Añadir un bloque</button></div>}</div></section><div className="calendar-legend"><span><i className="pending"/>Pendiente</span><span><i className="complete"/>Completada</span><span><i className="event-dot"/>Bloque de agenda</span></div></>
}

function EventBlock({ event, dates, update, edit, column = 0, columnCount = 1 }) {
  const ref = useRef(null)
  const startDrag = (pointerEvent) => {
    if (pointerEvent.target.closest('button')) return
    pointerEvent.preventDefault()
    const resizing = Boolean(pointerEvent.target.closest('[data-resize]'))
    const origin = { x: pointerEvent.clientX, y: pointerEvent.clientY, day: Math.max(0, dates.findIndex((date) => localDateKey(date) === event.date)), start: event.start, duration: event.duration }
    const grid = ref.current.closest('.day-columns')
    const dayWidth = grid.getBoundingClientRect().width / 7
    let next = { ...event }
    const move = (e) => {
      if (resizing) next.duration = clamp(snap(origin.duration + e.clientY - origin.y), 30, 720)
      else { next.day = clamp(origin.day + Math.round((e.clientX - origin.x) / dayWidth), 0, 6); next.date = localDateKey(dates[next.day]); next.start = clamp(snap(origin.start + e.clientY - origin.y), 0, 1440 - next.duration) }
      ref.current.style.top = `${next.start}px`; ref.current.style.height = `${next.duration}px`
      ref.current.querySelector('.event-time').textContent = `${clock(next.start)}–${clock(next.start + next.duration)}`
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); update((draft) => { Object.assign(draft.events.find((x) => x.id === event.id), next); return draft }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
  }
  const width = 100 / columnCount
  return <article ref={ref} className={`event ${event.color} ${columnCount >= 3 ? 'compact' : ''}`} style={{ top: event.start, height: Math.max(30, event.duration), '--event-left': `${column * width}%`, '--event-width': `${width}%` }} onPointerDown={startDrag} title={`${event.title} · ${clock(event.start)}–${clock(event.start + event.duration)}`}><div className="event-actions"><button aria-label={`Editar ${event.title}`} onClick={edit}><MoreHorizontal size={14}/></button></div><div className="event-title">{event.title}</div><div className="event-time">{clock(event.start)}–{clock(event.start + event.duration)}</div><div className="resize" data-resize/></article>
}

function Tasks({ workspace, update, setModal }) {
  const [filter, setFilter] = useState('all')
  const tasks = workspace.tasks.filter((task) => filter === 'all' || (filter === 'open' ? !task.done : task.done))
  return <><ViewHead eyebrow="Ejecución" title="Tareas" subtitle="Cada tarea puede alimentar automáticamente el progreso de un proyecto." action={<button className="primary" onClick={() => setModal({ type: 'task' })}><Plus size={15}/> Tarea</button>}/><div className="task-toolbar"><select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todas</option><option value="open">Pendientes</option><option value="done">Completadas</option></select></div><section className="task-table"><div className="task-row header"><span/><span>Tarea</span><span>Fecha</span><span>Proyecto</span><span>Prioridad</span><span/></div>{tasks.map((task) => { const project = workspace.projects.find((item) => item.taskIds?.includes(task.id)); return <div className="task-row" key={task.id}><input className="check" type="checkbox" checked={task.done} onChange={(e) => update((draft) => { draft.tasks.find((x) => x.id === task.id).done = e.target.checked; return draft })}/><input className={`task-title ${task.done ? 'done' : ''}`} value={task.title} onChange={(e) => update((draft) => { draft.tasks.find((x) => x.id === task.id).title = e.target.value; return draft })}/><input className="date-input" type="date" value={task.date || ''} onChange={(e) => update((draft) => { draft.tasks.find((x) => x.id === task.id).date = e.target.value; return draft })}/><select className="project-select" value={project?.id || ''} onChange={(e) => update((draft) => { draft.projects.forEach((item) => { item.taskIds = (item.taskIds || []).filter((id) => id !== task.id) }); if (e.target.value) draft.projects.find((item) => item.id === e.target.value).taskIds.push(task.id); return draft })}><option value="">Sin proyecto</option>{workspace.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Priority value={task.priority}/><button className="icon-action" aria-label="Eliminar" onClick={() => setModal({ type: 'delete', itemType: 'task', item: task })}><Trash2 size={15}/></button></div>})}{!tasks.length && <Empty text="No hay tareas en esta vista."/>}</section></>
}
function Priority({ value }) { return <span className={`badge ${priorityClass[value]}`}>{value}</span> }

function Projects({ workspace, update, setModal }) {
  return <><ViewHead eyebrow="Progreso real" title="Proyectos" subtitle="El avance se calcula con las tareas vinculadas, no con un porcentaje manual." action={<button className="primary" onClick={() => setModal({ type: 'project' })}><Plus size={15}/> Proyecto</button>}/><section className="projects">{workspace.projects.map((project) => { const stats = projectStats(project, workspace.tasks); const linked = workspace.tasks.filter((task) => project.taskIds?.includes(task.id)); return <article className="project" key={project.id}><div className="project-top"><span className="project-symbol">{project.symbol}</span><button className="icon-action" onClick={() => setModal({ type: 'delete', itemType: 'project', item: project })}><Trash2 size={15}/></button></div><h3>{project.name}</h3><p>{project.description}</p><div className="progress-line"><span style={{ width: `${stats.progress}%` }}/></div><div className="project-meta"><span>{stats.total ? `${stats.done} de ${stats.total} tareas` : 'Sin tareas vinculadas'}</span><strong>{stats.progress}%</strong></div><div className="project-tasks">{linked.map((task) => <label key={task.id}><input className="check" type="checkbox" checked={task.done} onChange={(e) => update((draft) => { draft.tasks.find((item) => item.id === task.id).done = e.target.checked; return draft })}/><span className={task.done ? 'done' : ''}>{task.title}</span><button aria-label="Desvincular" onClick={(e) => { e.preventDefault(); update((draft) => { const target = draft.projects.find((item) => item.id === project.id); target.taskIds = target.taskIds.filter((id) => id !== task.id); return draft }) }}><X size={13}/></button></label>)}<select value="" onChange={(e) => { const taskId = e.target.value; if (!taskId) return; update((draft) => { draft.projects.find((item) => item.id === project.id).taskIds.push(taskId); return draft }); e.target.value = '' }}><option value="">＋ Vincular tarea</option>{workspace.tasks.filter((task) => !workspace.projects.some((item) => item.taskIds?.includes(task.id))).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div></article> })}{!workspace.projects.length && <Empty text="Crea tu primer proyecto."/>}</section></>
}

function IdeasBoard({ workspace, update, go, syncState, setModal }) {
  const [selectedId, setSelectedId] = useState(null)
  const [connectFrom, setConnectFrom] = useState(null)
  const [zoom, setZoom] = useState(0.85)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [tool, setTool] = useState('select')
  const [snap, setSnap] = useState(true)
  const viewport = useRef(null)
  const board = workspace.ideaBoard
  const selected = board.nodes.find((node) => node.id === selectedId)

  const addNode = useCallback((type, position = null) => {
    let url = ''
    if (type === 'image') { url = prompt('Pega la URL de la imagen:', 'https://') || ''; if (!/^https?:\/\//i.test(url)) return }
    const view = viewport.current
    const x = position?.x ?? Math.round((view.scrollLeft + view.clientWidth / 2) / zoom - 140)
    const y = position?.y ?? Math.round((view.scrollTop + view.clientHeight / 2) / zoom - 90)
    const node = { id: uid(), type, x: Math.max(20, x), y: Math.max(20, y), width: type === 'image' ? 340 : 280, height: type === 'image' ? 250 : 180, title: type === 'image' ? 'Referencia visual' : type === 'text' ? 'Texto' : 'Nueva idea', content: type === 'text' ? 'Escribe aquí…' : '', url, color: type === 'note' ? 'yellow' : 'blue', taskIds: [], projectIds: [] }
    update((draft) => { draft.ideaBoard.nodes.push(node); return draft })
    setSelectedId(node.id); setInspectorOpen(true)
  }, [update, zoom])

  const chooseNode = (node) => {
    if (connectFrom && connectFrom !== node.id) {
      update((draft) => { const exists = draft.ideaBoard.connections.some((line) => line.from === connectFrom && line.to === node.id); if (!exists) draft.ideaBoard.connections.push({ id: uid(), from: connectFrom, to: node.id }); return draft })
      setConnectFrom(null)
    }
    setSelectedId(node.id)
  }

  const dragNode = (event, node) => {
    if (tool === 'hand') return
    if (event.target.closest('button,input,textarea,select')) return
    event.preventDefault(); chooseNode(node)
    const element = event.currentTarget
    const origin = { x: event.clientX, y: event.clientY, left: node.x, top: node.y }
    let nextX = node.x; let nextY = node.y
    const move = (pointer) => { nextX = Math.max(0, origin.left + (pointer.clientX - origin.x) / zoom); nextY = Math.max(0, origin.top + (pointer.clientY - origin.y) / zoom); element.style.left = `${nextX}px`; element.style.top = `${nextY}px` }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); update((draft) => { const target = draft.ideaBoard.nodes.find((item) => item.id === node.id); if (target) { target.x = snap ? Math.round(nextX / 10) * 10 : Math.round(nextX); target.y = snap ? Math.round(nextY / 10) * 10 : Math.round(nextY) } return draft }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
  }

  const patchNode = (changes) => update((draft) => { Object.assign(draft.ideaBoard.nodes.find((node) => node.id === selectedId), changes); return draft })
  const toggleRelation = (key, id) => update((draft) => { const node = draft.ideaBoard.nodes.find((item) => item.id === selectedId); node[key] = node[key].includes(id) ? node[key].filter((value) => value !== id) : [...node[key], id]; return draft })
  const removeNode = useCallback(() => {
    if (!selectedId) return
    const targetId = selectedId; setSelectedId(null); setConnectFrom(null)
    update((draft) => { draft.ideaBoard.nodes = draft.ideaBoard.nodes.filter((node) => node.id !== targetId); draft.ideaBoard.connections = draft.ideaBoard.connections.filter((line) => line.from !== targetId && line.to !== targetId); return draft })
  }, [selectedId, update])
  const duplicateNode = useCallback(() => {
    if (!selectedId) return
    const source = board.nodes.find((node) => node.id === selectedId)
    if (!source) return
    const copy = { ...structuredClone(source), id: uid(), x: source.x + 32, y: source.y + 32, title: `${source.title} copia` }
    update((draft) => { draft.ideaBoard.nodes.push(copy); return draft }); setSelectedId(copy.id)
  }, [board.nodes, selectedId, update])
  const clearConnections = () => update((draft) => { draft.ideaBoard.connections = draft.ideaBoard.connections.filter((line) => line.from !== selectedId && line.to !== selectedId); return draft })
  const centerBoard = useCallback(() => {
    const view = viewport.current
    if (!view) return
    if (!board.nodes.length) { view.scrollTo({ left: 0, top: 0, behavior: 'smooth' }); return }
    const minX = Math.min(...board.nodes.map((node) => node.x)); const maxX = Math.max(...board.nodes.map((node) => node.x + node.width))
    const minY = Math.min(...board.nodes.map((node) => node.y)); const maxY = Math.max(...board.nodes.map((node) => node.y + node.height))
    view.scrollTo({ left: Math.max(0, ((minX + maxX) / 2) * zoom - view.clientWidth / 2), top: Math.max(0, ((minY + maxY) / 2) * zoom - view.clientHeight / 2), behavior: 'smooth' })
  }, [board.nodes, zoom])
  const exportBoard = () => {
    const lines = board.connections.map((line) => { const from = board.nodes.find((node) => node.id === line.from); const to = board.nodes.find((node) => node.id === line.to); return from && to ? `<path d="M ${from.x + from.width / 2} ${from.y + from.height / 2} C ${from.x + from.width / 2 + 100} ${from.y + from.height / 2}, ${to.x + to.width / 2 - 100} ${to.y + to.height / 2}, ${to.x + to.width / 2} ${to.y + to.height / 2}" fill="none" stroke="#6f716b" stroke-width="3"/>` : '' }).join('')
    const nodes = board.nodes.map((node) => `<g><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" fill="${node.type === 'note' ? '#fff2ad' : '#ffffff'}" stroke="#d7d7d1"/>${node.type === 'image' && node.url ? `<image href="${escapeXml(node.url)}" x="${node.x + 8}" y="${node.y + 8}" width="${node.width - 16}" height="${node.height - 55}" preserveAspectRatio="xMidYMid slice"/>` : ''}<text x="${node.x + 16}" y="${node.y + (node.type === 'image' ? node.height - 20 : 32)}" font-family="Arial" font-size="18" font-weight="700" fill="#24251f">${escapeXml(node.title)}</text>${node.content ? `<text x="${node.x + 16}" y="${node.y + 62}" font-family="Arial" font-size="14" fill="#62645d">${escapeXml(node.content.slice(0, 80))}</text>` : ''}</g>`).join('')
    downloadText(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1100" viewBox="0 0 1800 1100"><rect width="100%" height="100%" fill="#f7f7f5"/>${lines}${nodes}</svg>`, 'luma-ideas.svg', 'image/svg+xml')
  }

  useEffect(() => {
    const keys = (event) => {
      if (event.target.closest('input,textarea,[contenteditable=true]')) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) { event.preventDefault(); removeNode() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedId) { event.preventDefault(); duplicateNode() }
      if (event.key === 'Escape') { setConnectFrom(null); setSelectedId(null) }
      if (event.key.toLowerCase() === 'v') setTool('select')
      if (event.key.toLowerCase() === 'h') setTool('hand')
      if (event.key.toLowerCase() === 'n') addNode('note')
      if (event.key.toLowerCase() === 't') addNode('text')
    }
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys)
  }, [addNode, duplicateNode, removeNode, selectedId])

  useEffect(() => {
    const view = viewport.current
    if (!view) return
    const pan = (event) => {
      if (tool !== 'hand' || event.button !== 0 || event.target.closest('.idea-node,button,input,textarea')) return
      event.preventDefault()
      const origin = { x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop }
      const move = (pointer) => { view.scrollLeft = origin.left - (pointer.clientX - origin.x); view.scrollTop = origin.top - (pointer.clientY - origin.y) }
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
    }
    const wheel = (event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); setZoom((value) => clamp(value + (event.deltaY < 0 ? .1 : -.1), .4, 1.4)) }
    view.addEventListener('pointerdown', pan); view.addEventListener('wheel', wheel, { passive: false })
    return () => { view.removeEventListener('pointerdown', pan); view.removeEventListener('wheel', wheel) }
  }, [tool])

  const addItems = [
    { icon: StickyNote, label: 'Nota adhesiva', hint: 'Captura una idea rápida', onSelect: () => addNode('note') },
    { icon: Type, label: 'Bloque de texto', hint: 'Desarrolla un concepto', onSelect: () => addNode('text') },
    { icon: ImageIcon, label: 'Imagen por enlace', hint: 'Añade una referencia visual', onSelect: () => addNode('image') },
  ]
  const syncedLabel = syncState === 'saving' ? 'Guardando cambios…' : syncState === 'error' ? 'Error al sincronizar' : 'Equipo sincronizado'

  return <div className="creative-studio" data-tool={tool}>
    <header className="studio-bar">
      <div className="studio-identity"><button className="studio-back" onClick={() => go('home')} aria-label="Volver al espacio"><ChevronLeft size={18}/></button><span className="brand-mark">L</span><div><strong>Sala de ideas</strong><small>{workspace.name || 'Lienzo del equipo'}</small></div></div>
      <div className="studio-status"><i className={syncState === 'error' ? 'error' : ''}/><span>{syncedLabel}</span></div>
      <div className="studio-actions"><ActionMenu className="studio-add" align="right" trigger={<><Plus size={16}/> Añadir <ChevronDown size={14}/></>} items={addItems}/><button className={`studio-tool ${connectFrom ? 'active' : ''}`} disabled={!selectedId} onClick={() => setConnectFrom(connectFrom ? null : selectedId)}><Link2 size={16}/><span>{connectFrom ? 'Cancelar conexión' : 'Conectar'}</span></button><ActionMenu align="right" ariaLabel="Más herramientas" trigger={<MoreHorizontal size={18}/>} items={[{ icon: Copy, label: 'Duplicar selección', onSelect: duplicateNode }, { icon: Download, label: 'Exportar como SVG', onSelect: exportBoard }, { icon: Trash2, label: 'Eliminar selección', danger: true, onSelect: removeNode }]}/><button className="studio-share" onClick={() => setModal({ type: 'share' })}><Users size={16}/> Equipo</button></div>
    </header>
    <div className={`studio-workspace ${inspectorOpen ? 'with-inspector' : ''}`}>
      <div className="studio-rail"><button className={tool === 'select' ? 'active' : ''} title="Seleccionar (V)" onClick={() => setTool('select')}><MousePointer2 size={18}/></button><button className={tool === 'hand' ? 'active' : ''} title="Mover lienzo (H)" onClick={() => setTool('hand')}><Hand size={18}/></button><span/><ActionMenu className="rail-add" trigger={<Plus size={19}/>} ariaLabel="Añadir al lienzo" items={addItems}/><button title="Nota (N)" onClick={() => addNode('note')}><StickyNote size={18}/></button><button title="Texto (T)" onClick={() => addNode('text')}><Type size={18}/></button><button title="Imagen" onClick={() => addNode('image')}><ImageIcon size={18}/></button><span/><button className={snap ? 'active' : ''} title="Ajustar a cuadrícula" onClick={() => setSnap((value) => !value)}><Grid3X3 size={18}/></button><button title="Centrar tablero" onClick={centerBoard}><PenTool size={18}/></button></div>
      <div className="studio-viewport" ref={viewport} onPointerDown={(event) => { if (event.target === event.currentTarget || event.target.classList.contains('studio-stage')) { setSelectedId(null); setConnectFrom(null) } }}>
        <div className="studio-stage" style={{ transform: `scale(${zoom})` }} onDoubleClick={(event) => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); addNode('note', { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }) }}>
          <svg className="idea-lines" viewBox="0 0 2200 1400">{board.connections.map((line) => { const from = board.nodes.find((node) => node.id === line.from); const to = board.nodes.find((node) => node.id === line.to); if (!from || !to) return null; return <path key={line.id} d={`M ${from.x + from.width / 2} ${from.y + from.height / 2} C ${from.x + from.width / 2 + 120} ${from.y + from.height / 2}, ${to.x + to.width / 2 - 120} ${to.y + to.height / 2}, ${to.x + to.width / 2} ${to.y + to.height / 2}`}/> })}</svg>
          {board.nodes.map((node) => <article key={node.id} className={`idea-node ${node.type} ${selectedId === node.id ? 'selected' : ''} ${connectFrom === node.id ? 'connecting' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onPointerDown={(event) => dragNode(event, node)} onClick={(event) => { event.stopPropagation(); chooseNode(node) }}><div className="node-grip"><GripVertical size={14}/></div>{node.type === 'image' && <img src={node.url} alt=""/>}<div className="idea-node-body"><strong>{node.title}</strong>{node.content && <p>{node.content}</p>}</div>{(node.taskIds.length > 0 || node.projectIds.length > 0) && <div className="idea-links"><CheckSquare size={12}/>{node.taskIds.length}<FolderKanban size={12}/>{node.projectIds.length}</div>}</article>)}
          {!board.nodes.length && <button className="studio-empty" onClick={() => addNode('note')}><Plus size={22}/><strong>Crea la primera idea</strong><span>También puedes hacer doble clic en cualquier parte.</span></button>}
        </div>
        <div className="studio-help">V seleccionar · H desplazar · N nota · T texto · Ctrl/⌘ + rueda: zoom</div>
        <div className="zoom-controls"><button aria-label="Alejar" onClick={() => setZoom((value) => clamp(value - .1, .4, 1.4))}>−</button><button className="zoom-value" onClick={centerBoard}>{Math.round(zoom * 100)}%</button><button aria-label="Acercar" onClick={() => setZoom((value) => clamp(value + .1, .4, 1.4))}>＋</button></div>
      </div>
      {inspectorOpen && <aside className="studio-inspector">{selected ? <><div className="inspector-head"><div><small>Selección</small><strong>Propiedades</strong></div><button className="icon-action" onClick={() => setInspectorOpen(false)} aria-label="Cerrar inspector"><X size={16}/></button></div><Field label="Título"><input value={selected.title} onChange={(e) => patchNode({ title: e.target.value })}/></Field>{selected.type === 'image' && <Field label="Imagen"><input value={selected.url || ''} onChange={(e) => patchNode({ url: e.target.value })}/></Field>}<Field label="Contenido"><textarea rows="5" value={selected.content || ''} onChange={(e) => patchNode({ content: e.target.value })}/></Field><div className="inspector-actions"><button onClick={duplicateNode}><Copy size={15}/> Duplicar</button><button className="danger" onClick={removeNode}><Trash2 size={15}/> Eliminar</button></div><details className="inspector-section" open><summary>Tareas conectadas <span>{selected.taskIds.length}</span></summary>{workspace.tasks.map((task) => <label key={task.id}><input type="checkbox" checked={selected.taskIds.includes(task.id)} onChange={() => toggleRelation('taskIds', task.id)}/><span className={task.done ? 'done' : ''}>{task.title}</span></label>)}</details><details className="inspector-section" open><summary>Proyectos conectados <span>{selected.projectIds.length}</span></summary>{workspace.projects.map((project) => <label key={project.id}><input type="checkbox" checked={selected.projectIds.includes(project.id)} onChange={() => toggleRelation('projectIds', project.id)}/><span>{project.symbol} {project.name}</span></label>)}</details><button className="unlink-button" onClick={clearConnections}><Unlink size={15}/> Quitar líneas de esta idea</button></> : <div className="inspector-empty"><PenTool size={28}/><strong>Selecciona un elemento</strong><p>Edita su contenido y relaciónalo con el trabajo del equipo.</p><button onClick={() => setInspectorOpen(false)}>Cerrar panel</button></div>}</aside>}
      {!inspectorOpen && <button className="open-inspector" onClick={() => setInspectorOpen(true)}><Settings size={17}/><span>Propiedades</span></button>}
    </div>
  </div>
}

function IdeasBoardLegacy({ workspace, update }) {
  const [selectedId, setSelectedId] = useState(null)
  const [connectFrom, setConnectFrom] = useState(null)
  const [zoom, setZoom] = useState(0.85)
  const viewport = useRef(null)
  const board = workspace.ideaBoard
  const selected = board.nodes.find((node) => node.id === selectedId)
  const addNode = (type) => {
    let url = ''
    if (type === 'image') { url = prompt('Pega la URL de la imagen:', 'https://') || ''; if (!/^https?:\/\//i.test(url)) return }
    const node = { id: uid(), type, x: 260 + viewport.current.scrollLeft / zoom, y: 180 + viewport.current.scrollTop / zoom, width: type === 'image' ? 330 : 270, height: type === 'image' ? 240 : 170, title: type === 'image' ? 'Referencia visual' : type === 'text' ? 'Texto' : 'Nueva idea', content: type === 'text' ? 'Escribe aquí…' : '', url, color: type === 'note' ? 'yellow' : 'blue', taskIds: [], projectIds: [] }
    update((draft) => { draft.ideaBoard.nodes.push(node); return draft }); setSelectedId(node.id)
  }
  const chooseNode = (node) => {
    if (connectFrom && connectFrom !== node.id) {
      update((draft) => { const exists = draft.ideaBoard.connections.some((line) => line.from === connectFrom && line.to === node.id); if (!exists) draft.ideaBoard.connections.push({ id: uid(), from: connectFrom, to: node.id }); return draft })
      setConnectFrom(null)
    } else setSelectedId(node.id)
  }
  const dragNode = (event, node) => {
    if (event.target.closest('button,input,textarea')) return
    event.preventDefault(); chooseNode(node)
    const element = event.currentTarget
    const origin = { x: event.clientX, y: event.clientY, left: node.x, top: node.y }
    let nextX = node.x; let nextY = node.y
    const move = (pointer) => { nextX = Math.max(0, origin.left + (pointer.clientX - origin.x) / zoom); nextY = Math.max(0, origin.top + (pointer.clientY - origin.y) / zoom); element.style.left = `${nextX}px`; element.style.top = `${nextY}px` }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); update((draft) => { const target = draft.ideaBoard.nodes.find((item) => item.id === node.id); target.x = Math.round(nextX); target.y = Math.round(nextY); return draft }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
  }
  const patchNode = (changes) => update((draft) => { Object.assign(draft.ideaBoard.nodes.find((node) => node.id === selectedId), changes); return draft })
  const toggleRelation = (key, id) => update((draft) => { const node = draft.ideaBoard.nodes.find((item) => item.id === selectedId); node[key] = node[key].includes(id) ? node[key].filter((value) => value !== id) : [...node[key], id]; return draft })
  const removeNode = () => { const targetId = selectedId; setSelectedId(null); update((draft) => { draft.ideaBoard.nodes = draft.ideaBoard.nodes.filter((node) => node.id !== targetId); draft.ideaBoard.connections = draft.ideaBoard.connections.filter((line) => line.from !== targetId && line.to !== targetId); return draft }) }
  const clearConnections = () => update((draft) => { draft.ideaBoard.connections = draft.ideaBoard.connections.filter((line) => line.from !== selectedId && line.to !== selectedId); return draft })
  const exportBoard = () => {
    const lines = board.connections.map((line) => { const from = board.nodes.find((node) => node.id === line.from); const to = board.nodes.find((node) => node.id === line.to); return from && to ? `<path d="M ${from.x + from.width / 2} ${from.y + from.height / 2} C ${from.x + from.width / 2 + 100} ${from.y + from.height / 2}, ${to.x + to.width / 2 - 100} ${to.y + to.height / 2}, ${to.x + to.width / 2} ${to.y + to.height / 2}" fill="none" stroke="#6f716b" stroke-width="3"/>` : '' }).join('')
    const nodes = board.nodes.map((node) => `<g><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" fill="${node.type === 'note' ? '#fff2ad' : '#ffffff'}" stroke="#d7d7d1"/>${node.type === 'image' && node.url ? `<image href="${escapeXml(node.url)}" x="${node.x + 8}" y="${node.y + 8}" width="${node.width - 16}" height="${node.height - 55}" preserveAspectRatio="xMidYMid slice"/>` : ''}<text x="${node.x + 16}" y="${node.y + (node.type === 'image' ? node.height - 20 : 32)}" font-family="Arial" font-size="18" font-weight="700" fill="#24251f">${escapeXml(node.title)}</text>${node.content ? `<text x="${node.x + 16}" y="${node.y + 62}" font-family="Arial" font-size="14" fill="#62645d">${escapeXml(node.content.slice(0, 80))}</text>` : ''}</g>`).join('')
    downloadText(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1100" viewBox="0 0 1800 1100"><rect width="100%" height="100%" fill="#f7f7f5"/>${lines}${nodes}</svg>`, 'luma-ideas.svg', 'image/svg+xml')
  }
  return <div className="ideas-view"><ViewHead eyebrow="Lienzo creativo" title="Mapa de ideas" subtitle="Combina texto e imágenes, conecta conceptos y conviértelos en tareas o proyectos." action={<div className="idea-toolbar"><button className="ghost" onClick={() => addNode('note')}><StickyNote size={15}/> Nota</button><button className="ghost" onClick={() => addNode('text')}><Type size={15}/> Texto</button><button className="ghost" onClick={() => addNode('image')}><ImageIcon size={15}/> Imagen</button><button className={`ghost ${connectFrom ? 'active' : ''}`} onClick={() => { setConnectFrom(selectedId || null); if (!selectedId) setConnectFrom(null) }}><Link2 size={15}/> {connectFrom ? 'Elige destino' : 'Conectar'}</button><button className="primary" onClick={exportBoard}><Download size={15}/> Exportar SVG</button></div>}/><div className="idea-layout"><div className="idea-viewport" ref={viewport} onPointerDown={(e) => { if (e.target === e.currentTarget || e.target.closest('.idea-stage') === e.target) setSelectedId(null) }}><div className="idea-stage" style={{ transform: `scale(${zoom})` }}><svg className="idea-lines" viewBox="0 0 1800 1100">{board.connections.map((line) => { const from = board.nodes.find((node) => node.id === line.from); const to = board.nodes.find((node) => node.id === line.to); if (!from || !to) return null; return <path key={line.id} d={`M ${from.x + from.width / 2} ${from.y + from.height / 2} C ${from.x + from.width / 2 + 100} ${from.y + from.height / 2}, ${to.x + to.width / 2 - 100} ${to.y + to.height / 2}, ${to.x + to.width / 2} ${to.y + to.height / 2}`}/> })}</svg>{board.nodes.map((node) => <article key={node.id} className={`idea-node ${node.type} ${selectedId === node.id ? 'selected' : ''} ${connectFrom === node.id ? 'connecting' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onPointerDown={(event) => dragNode(event, node)} onClick={(event) => { event.stopPropagation(); chooseNode(node) }}>{node.type === 'image' && <img src={node.url} alt=""/>}<div className="idea-node-body"><strong>{node.title}</strong>{node.content && <p>{node.content}</p>}</div>{(node.taskIds.length > 0 || node.projectIds.length > 0) && <div className="idea-links"><CheckSquare size={12}/>{node.taskIds.length}<FolderKanban size={12}/>{node.projectIds.length}</div>}</article>)}</div><div className="zoom-controls"><button onClick={() => setZoom((value) => clamp(value - .1, .4, 1.3))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => clamp(value + .1, .4, 1.3))}>＋</button></div></div><aside className="idea-inspector">{selected ? <><div className="inspector-head"><strong>Propiedades</strong><button className="icon-action danger" onClick={removeNode}><Trash2 size={15}/></button></div><Field label="Título"><input value={selected.title} onChange={(e) => patchNode({ title: e.target.value })}/></Field>{selected.type === 'image' && <Field label="Imagen"><input value={selected.url || ''} onChange={(e) => patchNode({ url: e.target.value })}/></Field>}<Field label="Contenido"><textarea rows="5" value={selected.content || ''} onChange={(e) => patchNode({ content: e.target.value })}/></Field><div className="inspector-section"><strong>Tareas conectadas</strong>{workspace.tasks.map((task) => <label key={task.id}><input type="checkbox" checked={selected.taskIds.includes(task.id)} onChange={() => toggleRelation('taskIds', task.id)}/><span className={task.done ? 'done' : ''}>{task.title}</span></label>)}</div><div className="inspector-section"><strong>Proyectos conectados</strong>{workspace.projects.map((project) => <label key={project.id}><input type="checkbox" checked={selected.projectIds.includes(project.id)} onChange={() => toggleRelation('projectIds', project.id)}/><span>{project.symbol} {project.name}</span></label>)}</div><button className="ghost danger" onClick={clearConnections}><Unlink size={15}/> Quitar conexiones visuales</button></> : <div className="inspector-empty"><PenTool size={28}/><strong>Selecciona una idea</strong><p>Desde aquí podrás editarla y conectarla con tareas y proyectos.</p></div>}</aside></div></div>
}

function WorkspaceFiles({ space, canEdit, session }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const input = useRef(null)
  const load = useCallback(async () => {
    if (!space?.id) return
    const { data, error } = await supabase.from('workspace_files').select('*').eq('workspace_id', space.id).order('created_at', { ascending: false })
    if (error) setMessage(error.message); else { setFiles(data || []); setMessage('') }
  }, [space?.id])
  useEffect(() => { load() }, [load])
  async function upload(event) {
    const selected = event.target.files?.[0]; event.target.value = ''
    if (!selected || !canEdit) return
    setBusy(true); setMessage('')
    const safeName = selected.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${space.id}/${uid()}-${safeName}`
    const stored = await supabase.storage.from('workspace-files').upload(storagePath, selected, { contentType: selected.type || 'application/octet-stream' })
    if (stored.error) { setMessage(stored.error.message); setBusy(false); return }
    const { error } = await supabase.from('workspace_files').insert({ workspace_id: space.id, name: selected.name, storage_path: storagePath, mime_type: selected.type, size_bytes: selected.size, uploaded_by: session.user.id })
    if (error) { await supabase.storage.from('workspace-files').remove([storagePath]); setMessage(error.message) } else await load()
    setBusy(false)
  }
  async function download(file) {
    const { data, error } = await supabase.storage.from('workspace-files').createSignedUrl(file.storage_path, 60)
    if (error) setMessage(error.message); else window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function remove(file) {
    if (!canEdit || !confirm(`¿Eliminar ${file.name}?`)) return
    setBusy(true)
    const stored = await supabase.storage.from('workspace-files').remove([file.storage_path])
    if (stored.error) setMessage(stored.error.message)
    else { const { error } = await supabase.from('workspace_files').delete().eq('id', file.id); if (error) setMessage(error.message); else await load() }
    setBusy(false)
  }
  return <><ViewHead eyebrow="Equipo" title="Archivos compartidos" subtitle="Documentos privados para todas las personas de este espacio." action={canEdit && <><input ref={input} hidden type="file" onChange={upload}/><button className="primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={15}/>{busy ? ' Subiendo…' : ' Subir archivo'}</button></>}/>{message && <div className="notice-banner">{message}</div>}<section className="panel"><div className="file-list">{files.map((file) => <div className="file-row" key={file.id}><span className="file-icon"><FileText size={18}/></span><div><strong>{file.name}</strong><small>{formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString('es')}</small></div><button className="ghost" onClick={() => download(file)}><Download size={15}/> Descargar</button>{canEdit && <button className="icon-action" title="Eliminar" onClick={() => remove(file)}><Trash2 size={15}/></button>}</div>)}{!files.length && <Empty text="Aún no hay archivos. Sube el primero para compartirlo con el equipo."/>}</div></section></>
}

function Notes({ workspace, update, pageId = null }) {
  const [menu, setMenu] = useState(null)
  const [coverOpen, setCoverOpen] = useState(false)
  const activeBlock = useRef(null)
  useEffect(() => { setCoverOpen(false); setMenu(null) }, [pageId])
  const doc = pageId ? workspace.pages.find((page) => page.id === pageId) : workspace.document
  if (!doc) return <Empty text="Esta página ya no existe."/>
  const blocks = doc.blocks
  const getDocument = (draft) => pageId ? draft.pages.find((page) => page.id === pageId) : draft.document
  const addBlock = (type, after = menu?.after) => {
    const block = { id: uid(), type, content: '' }
    if (type === 'todo') block.checked = false
    if (type === 'table') block.rows = [['', ''], ['', '']]
    update((draft) => { const target = getDocument(draft); const index = after ? target.blocks.findIndex((x) => x.id === after) + 1 : target.blocks.length; const slash = target.blocks.find((x) => x.id === after); if (slash?.content?.trim() === '/') { slash.content = ''; slash.html = '' } target.blocks.splice(index, 0, block); return draft })
    setMenu(null); setTimeout(() => document.querySelector(`[data-rich-block="${block.id}"]`)?.focus(), 0)
  }
  const format = (command) => {
    const element = document.querySelector(`[data-rich-block="${activeBlock.current}"]`)
    if (!element) return
    if (command === 'createLink') { const url = prompt('Dirección del enlace:', 'https://'); if (!url) return; document.execCommand(command, false, url) } else document.execCommand(command)
    const html = sanitizeRich(element.innerHTML); update((draft) => { const block = getDocument(draft).blocks.find((x) => x.id === activeBlock.current); block.html = html; block.content = element.innerText; return draft })
  }
  const coverStyle = doc.cover?.startsWith('http') ? { backgroundImage: `url("${doc.cover.replaceAll('"', '')}")` } : undefined
  return <div className={pageId ? 'workspace-page' : ''}>
    {!pageId && <ViewHead eyebrow="Documento" title="Editor por bloques" subtitle="Escribe / para insertar títulos, listas, avisos, enlaces y tablas."/>}
    {pageId && <>
      {doc.cover ? <div className={`page-cover cover-${doc.cover}`} style={coverStyle}><button onClick={() => setCoverOpen(!coverOpen)}>Cambiar portada</button></div> : <button className="add-cover" onClick={() => setCoverOpen(true)}>＋ Añadir portada</button>}
      {coverOpen && (
        <CoverPicker value={doc.cover} close={() => setCoverOpen(false)} setValue={(cover) => { update((draft) => { getDocument(draft).cover = cover; return draft }); setCoverOpen(false) }}/>
      )}
    </>}
    <article className={`note-paper ${pageId ? 'page-paper' : ''}`}>
      {pageId && <input className="page-emoji" aria-label="Icono de página" maxLength="3" value={doc.icon || '📄'} onChange={(e) => update((draft) => { getDocument(draft).icon = e.target.value; return draft })}/>}
      <input className="note-title" placeholder="Sin título" value={doc.title} onChange={(e) => update((draft) => { getDocument(draft).title = e.target.value; return draft })}/>
      {pageId && (
        <PageRelations page={doc} workspace={workspace} update={update}/>
      )}
      <div className="format-bar"><FormatButton title="Negrita" onClick={() => format('bold')}><Bold size={15}/></FormatButton><FormatButton title="Cursiva" onClick={() => format('italic')}><Italic size={15}/></FormatButton><FormatButton title="Subrayado" onClick={() => format('underline')}><Underline size={15}/></FormatButton><FormatButton title="Enlace" onClick={() => format('createLink')}><LinkIcon size={15}/> Enlace</FormatButton><button className="insert-main" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY + 12, after: null })}><Plus size={14}/> Insertar bloque</button></div>
      <div className="notion-editor">{blocks.map((block) => <RichBlock key={block.id} block={block} update={update} activeBlock={activeBlock} getDocument={getDocument} openMenu={(element) => { const rect = element.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom + 6, after: block.id }) }}/>)}</div>
      <button className="add-last" onClick={() => addBlock('text', blocks.at(-1)?.id)}><Plus size={14}/> Añadir bloque</button>
    </article>{menu && <BlockMenu position={menu} add={addBlock} close={() => setMenu(null)}/>}</div>
}

function CoverPicker({ value, setValue, close }) { const [url, setUrl] = useState(value?.startsWith('http') ? value : ''); return <div className="cover-picker"><div className="cover-picker-head"><strong>Elegir portada</strong><button className="icon-action" aria-label="Cerrar selector de portada" onClick={close}><X size={16}/></button></div><div className="cover-swatches"><button className="cover-swatch sunset" aria-label="Portada atardecer" onClick={() => setValue('sunset')}/><button className="cover-swatch ocean" aria-label="Portada océano" onClick={() => setValue('ocean')}/><button className="cover-swatch forest" aria-label="Portada bosque" onClick={() => setValue('forest')}/></div><div className="cover-url"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega la URL de una imagen…"/><button className="ghost" disabled={!/^https?:\/\//i.test(url)} onClick={() => setValue(url)}>Usar imagen</button>{value && <button className="ghost danger" onClick={() => setValue('')}>Quitar</button>}</div></div> }

function PageRelations({ page, workspace, update }) {
  const addRelation = (key, value) => { if (!value) return; update((draft) => { const target = draft.pages.find((x) => x.id === page.id); if (!target[key].includes(value)) target[key].push(value); return draft }) }
  const unlink = (key, id) => update((draft) => { const target = draft.pages.find((x) => x.id === page.id); target[key] = target[key].filter((value) => value !== id); return draft })
  const linkedTasks = workspace.tasks.filter((task) => page.taskIds.includes(task.id))
  const linkedProjects = workspace.projects.filter((project) => page.projectIds.includes(project.id))
  return <section className="page-relations"><div className="relation-row"><span>✓ Tareas</span><div className="relation-chips">{linkedTasks.map((task) => <span className="relation-chip" key={task.id}><input type="checkbox" checked={task.done} onChange={(e) => update((draft) => { draft.tasks.find((x) => x.id === task.id).done = e.target.checked; return draft })}/>{task.title}<button aria-label="Desvincular tarea" onClick={() => unlink('taskIds', task.id)}>×</button></span>)}<select aria-label="Vincular tarea" defaultValue="" onChange={(e) => { addRelation('taskIds', e.target.value); e.target.value = '' }}><option value="">＋ Vincular tarea</option>{workspace.tasks.filter((task) => !page.taskIds.includes(task.id)).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div></div><div className="relation-row"><span>◇ Proyectos</span><div className="relation-chips">{linkedProjects.map((project) => <span className="relation-chip project-chip" key={project.id}>{project.symbol} {project.name}<em>{projectStats(project, workspace.tasks).progress}%</em><button aria-label="Desvincular proyecto" onClick={() => unlink('projectIds', project.id)}>×</button></span>)}<select aria-label="Vincular proyecto" defaultValue="" onChange={(e) => { addRelation('projectIds', e.target.value); e.target.value = '' }}><option value="">＋ Vincular proyecto</option>{workspace.projects.filter((project) => !page.projectIds.includes(project.id)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div></div></section>
}

function FormatButton({ title, onClick, children }) { return <button title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button> }
function RichBlock({ block, update, activeBlock, openMenu, getDocument }) {
  const updateContent = (element) => update((draft) => { const target = getDocument(draft).blocks.find((x) => x.id === block.id); target.content = element.innerText; target.html = sanitizeRich(element.innerHTML); return draft })
  const remove = () => update((draft) => { const doc = getDocument(draft); doc.blocks = doc.blocks.length === 1 ? [{ id: uid(), type: 'text', content: '' }] : doc.blocks.filter((x) => x.id !== block.id); return draft })
  const move = (amount) => update((draft) => { const blocks = getDocument(draft).blocks; const index = blocks.findIndex((item) => item.id === block.id); const next = clamp(index + amount, 0, blocks.length - 1); if (next !== index) blocks.splice(next, 0, blocks.splice(index, 1)[0]); return draft })
  const duplicate = () => update((draft) => { const blocks = getDocument(draft).blocks; const index = blocks.findIndex((item) => item.id === block.id); blocks.splice(index + 1, 0, { ...structuredClone(block), id: uid() }); return draft })
  const controls = <div className="block-controls"><button title="Subir bloque" onClick={() => move(-1)}><ArrowUp size={13}/></button><button title="Bajar bloque" onClick={() => move(1)}><ArrowDown size={13}/></button><button title="Duplicar bloque" onClick={duplicate}><Copy size={13}/></button><button className="danger" title="Eliminar bloque" onClick={remove}><Trash2 size={13}/></button></div>
  if (block.type === 'divider') return <div className="note-block divider-block"><GripVertical className="block-grip" size={15}/><hr/>{controls}</div>
  if (block.type === 'table') return <div className="note-block table-block"><GripVertical className="block-grip" size={15}/><table><tbody>{(block.rows || [['', ''], ['', '']]).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} contentEditable suppressContentEditableWarning onBlur={(e) => update((draft) => { getDocument(draft).blocks.find((x) => x.id === block.id).rows[rowIndex][cellIndex] = e.currentTarget.innerText; return draft })}>{cell}</td>)}</tr>)}</tbody></table><button className="table-add" onClick={() => update((draft) => { const target = getDocument(draft).blocks.find((x) => x.id === block.id); target.rows.push(Array(target.rows[0].length).fill('')); return draft })}>＋ fila</button>{controls}</div>
  const Tag = block.type === 'h1' ? 'h2' : block.type === 'h2' ? 'h3' : 'div'
  return <div className={`note-block type-${block.type}`}><GripVertical className="block-grip" size={15}/>{block.type === 'bullet' && <span className="bullet">•</span>}{block.type === 'todo' && <input className="check" type="checkbox" checked={Boolean(block.checked)} onChange={(e) => update((draft) => { getDocument(draft).blocks.find((x) => x.id === block.id).checked = e.target.checked; return draft })}/>} {block.type === 'callout' && <span className="callout-icon">💡</span>}<Tag data-rich-block={block.id} className="block-content" contentEditable suppressContentEditableWarning data-placeholder="Escribe / para insertar…" dangerouslySetInnerHTML={{ __html: block.html ? sanitizeRich(block.html) : escapeHtml(block.content || '') }} onFocus={() => { activeBlock.current = block.id }} onInput={(e) => { if (e.currentTarget.innerText.trim() === '/') openMenu(e.currentTarget) }} onBlur={(e) => updateContent(e.currentTarget)}/>{controls}</div>
}

const blockOptions = [
  ['text', '¶', 'Texto', 'Párrafo sencillo'], ['h1', 'H1', 'Título', 'Encabezado principal'], ['h2', 'H2', 'Subtítulo', 'Encabezado secundario'], ['bullet', '•', 'Lista', 'Lista con viñetas'], ['todo', '☐', 'Tarea', 'Casilla dentro del documento'], ['quote', '❝', 'Cita', 'Destaca una frase'], ['callout', '💡', 'Aviso', 'Bloque destacado'], ['table', '▦', 'Tabla', 'Tabla editable 2 × 2'], ['divider', '―', 'Separador', 'Divide secciones'],
]
function BlockMenu({ position, add, close }) { useEffect(() => { const handler = (e) => { if (!e.target.closest('.editor-popover')) close() }; setTimeout(() => document.addEventListener('pointerdown', handler), 0); return () => document.removeEventListener('pointerdown', handler) }, [close]); return <div className="editor-popover" style={{ left: Math.min(position.x, innerWidth - 310), top: Math.min(position.y, innerHeight - 420) }}>{blockOptions.map(([type, icon, label, help]) => <button key={type} onClick={() => add(type)}><span>{icon}</span><b>{label}</b><small>{help}</small></button>)}</div> }

function Trash({ workspace, update }) { const restore = (entry) => update((draft) => { const key = entry.type === 'task' ? 'tasks' : entry.type === 'project' ? 'projects' : 'events'; draft[key].push(entry.item); draft.trash = draft.trash.filter((x) => x.id !== entry.id); return draft }); return <><ViewHead eyebrow="Archivo" title="Papelera" subtitle="Restaura lo eliminado o vacía definitivamente." action={workspace.trash.length ? <button className="ghost danger" onClick={() => update((draft) => { draft.trash = []; return draft })}>Vaciar</button> : null}/><section className="panel"><div className="list">{workspace.trash.map((entry) => <div className="list-row" key={entry.id}><Trash2 size={16}/><div><strong>{entry.item.title || entry.item.name}</strong><div className="top-date">{entry.type}</div></div><button className="ghost" onClick={() => restore(entry)}>Restaurar</button></div>)}{!workspace.trash.length && <Empty text="La papelera está vacía."/>}</div></section></> }
function Empty({ text }) { return <div className="empty">{text}</div> }

function SearchPalette({ workspace, go, close }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => [...workspace.tasks.map((x) => ({ label: x.title, type: 'Tarea', view: 'tasks' })), ...workspace.projects.map((x) => ({ label: x.name, type: 'Proyecto', view: 'projects' })), ...workspace.events.map((x) => ({ label: x.title, type: `${DAYS[x.day]} · ${clock(x.start)}`, view: 'agenda' })), ...workspace.pages.map((x) => ({ label: x.title || 'Sin título', type: 'Página', view: `page:${x.id}` })), { label: workspace.document.title, type: 'Nota', view: 'notes' }].filter((x) => !query || x.label.toLowerCase().includes(query.toLowerCase())).slice(0, 15), [workspace, query])
  return <div className="search-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}><div className="palette"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tareas, proyectos, notas y bloques…"/><div className="results">{results.map((result, index) => <button className="result" key={`${result.view}-${index}`} onClick={() => { go(result.view); close() }}><Search size={15}/><strong>{result.label}</strong><small>{result.type}</small></button>)}{!results.length && <Empty text="No hay resultados."/>}</div></div></div>
}

function ModalController({ modal, close, workspace, update, moveToTrash, session, activeSpace, createSpace, joinSpace, canEdit }) {
  if (modal.type === 'task') return <FormModal title="Nueva tarea" close={close} onSubmit={(form) => { update((draft) => { const task = { id: uid(), title: form.get('title'), date: form.get('date'), priority: form.get('priority'), done: false }; draft.tasks.unshift(task); const projectId = form.get('project'); if (projectId) draft.projects.find((project) => project.id === projectId).taskIds.push(task.id); return draft }); close() }}><Field label="Título"><input name="title" required autoFocus placeholder="¿Qué necesitas hacer?"/></Field><div className="field-row"><Field label="Fecha"><input name="date" type="date" defaultValue={modal.draft?.date || iso()}/></Field><Field label="Prioridad"><select name="priority" defaultValue="Media"><option>Alta</option><option>Media</option><option>Baja</option></select></Field></div><Field label="Proyecto"><select name="project" defaultValue=""><option value="">Sin proyecto</option>{workspace.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field></FormModal>
  if (modal.type === 'project') return <FormModal title="Nuevo proyecto" close={close} onSubmit={(form) => { update((draft) => { draft.projects.unshift({ id: uid(), name: form.get('name'), description: form.get('description'), symbol: form.get('symbol'), taskIds: [] }); return draft }); close() }}><Field label="Nombre"><input name="name" required autoFocus/></Field><Field label="Descripción"><textarea name="description" rows="3"/></Field><Field label="Símbolo"><select name="symbol"><option>◎</option><option>◇</option><option>↗</option><option>✦</option></select></Field></FormModal>
  if (modal.type === 'event') { const item = modal.item ?? modal.draft ?? {}; return <FormModal title={modal.item ? 'Editar bloque' : 'Nuevo bloque'} close={close} onSubmit={(form) => { const date = form.get('date'); const values = { title: form.get('title'), date, day: dayIndex(parseDate(date)), color: form.get('color'), start: toMinutes(form.get('start')), duration: Number(form.get('duration')) }; update((draft) => { if (modal.item) Object.assign(draft.events.find((x) => x.id === modal.item.id), values); else draft.events.push({ id: uid(), ...values }); return draft }); close() }} extra={modal.item && <button type="button" className="ghost danger" onClick={() => { close(); setTimeout(() => {}, 0); moveToTrash('event', modal.item) }}>Mover a papelera</button>}><Field label="Título"><input name="title" required autoFocus defaultValue={item.title || ''}/></Field><div className="field-row"><Field label="Fecha"><input type="date" name="date" defaultValue={item.date || iso()} required/></Field><Field label="Color"><select name="color" defaultValue={item.color || 'blue'}>{COLORS.map((color) => <option key={color} value={color}>{colorNames[color]}</option>)}</select></Field></div><div className="field-row"><Field label="Inicio"><input type="time" name="start" defaultValue={clock(item.start ?? 540)} required/></Field><Field label="Duración"><select name="duration" defaultValue={item.duration ?? 60}><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hora</option><option value="90">1 h 30</option><option value="120">2 horas</option><option value="180">3 horas</option><option value="240">4 horas</option></select></Field></div></FormModal> }
  if (modal.type === 'delete') return <ConfirmModal close={close} confirm={() => { moveToTrash(modal.itemType, modal.item); close() }} title="Mover a la papelera">¿Quieres mover <strong>{modal.item.title || modal.item.name}</strong> a la papelera?</ConfirmModal>
  if (modal.type === 'noteBlock') return <FormModal title="Nuevo bloque" close={close} onSubmit={(form) => { const type = form.get('type'); const block = { id: uid(), type, content: '' }; if (type === 'todo') block.checked = false; if (type === 'table') block.rows = [['', ''], ['', '']]; update((draft) => { draft.document.blocks.push(block); return draft }); close() }}><Field label="Tipo de bloque"><select name="type" autoFocus>{blockOptions.map(([type, icon, label]) => <option key={type} value={type}>{icon} {label}</option>)}</select></Field></FormModal>
  if (modal.type === 'createSpace') return <WorkspaceActionModal title="Nuevo espacio de trabajo" submitLabel="Crear espacio" close={close} onSubmit={async (value) => createSpace(value)} label="Nombre del espacio" placeholder="Ej. Equipo de marketing"/>
  if (modal.type === 'joinSpace') return <WorkspaceActionModal title="Unirme a un espacio" submitLabel="Unirme" close={close} onSubmit={joinSpace} label="Código o enlace de invitación" placeholder="Pega aquí el código o el enlace"/>
  if (modal.type === 'share') return <ShareModal close={close} space={activeSpace} session={session} canEdit={canEdit}/>
  if (modal.type === 'settings') return <SettingsModal close={close} workspace={workspace} update={update} session={session}/>
  return null
}

function WorkspaceActionModal({ title, submitLabel, close, onSubmit, label, placeholder }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <div className="react-modal-backdrop"><form className="react-modal" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await onSubmit(new FormData(event.currentTarget).get('value').trim()); close() } catch (reason) { setError(reason.message || 'No se pudo completar la acción.'); setBusy(false) } }}><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-action" onClick={close}><X size={17}/></button></div><div className="modal-body"><Field label={label}><input name="value" required autoFocus placeholder={placeholder}/></Field>{error && <div className="auth-error">{error}</div>}</div><div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Espera…' : submitLabel}</button></div></form></div>
}

function ShareModal({ close, space, session, canEdit }) {
  const [members, setMembers] = useState([]); const [invites, setInvites] = useState([])
  const [role, setRole] = useState('editor'); const [duration, setDuration] = useState('90'); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [copied, setCopied] = useState('')
  const load = useCallback(async () => {
    if (!space?.id) return
    const membersResult = await supabase.from('workspace_members').select('user_id,email,role,joined_at').eq('workspace_id', space.id).order('joined_at')
    if (membersResult.error) setError(membersResult.error.message); else setMembers(membersResult.data || [])
    if (canEdit) { const inviteResult = await supabase.from('workspace_invites').select('*').eq('workspace_id', space.id).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }); if (!inviteResult.error) setInvites(inviteResult.data || []) }
  }, [space?.id, canEdit])
  useEffect(() => { load() }, [load])
  async function createInvite() {
    setBusy(true); setError('')
    const expiresAt = duration === 'never' ? null : new Date(Date.now() + Number(duration) * 86400000).toISOString()
    const { data, error: inviteError } = await supabase.from('workspace_invites').insert({ workspace_id: space.id, role, expires_at: expiresAt, created_by: session.user.id }).select().single()
    if (inviteError) setError(inviteError.message); else setInvites((current) => [data, ...current])
    setBusy(false)
  }
  async function copyInvite(invite) {
    const link = `${window.location.origin}${window.location.pathname}?invite=${invite.code}`
    await navigator.clipboard.writeText(link); setCopied(invite.id); setTimeout(() => setCopied(''), 1800)
  }
  return <div className="react-modal-backdrop"><div className="react-modal share-modal"><div className="modal-head"><div><h2>Compartir “{space?.name}”</h2><p>Horario, eventos, tareas, páginas y archivos se sincronizan para todo el equipo.</p></div><button className="icon-action" onClick={close}><X size={17}/></button></div><div className="modal-body">{canEdit && <section className="invite-maker"><div><strong>Invitar mediante enlace</strong><small>Elige cuánto tiempo estará disponible. El espacio del equipo no vence.</small></div><label><span>Permiso</span><select value={role} onChange={(e) => setRole(e.target.value)}><option value="editor">Puede editar</option><option value="viewer">Solo lectura</option></select></label><label><span>Duración</span><select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="30">30 días</option><option value="90">90 días</option><option value="365">1 año</option><option value="never">Sin vencimiento</option></select></label><button className="primary" disabled={busy} onClick={createInvite}><Share2 size={15}/> Crear enlace</button></section>}{error && <div className="auth-error">{error}</div>}{invites.length > 0 && <section><h3>Enlaces activos</h3><div className="invite-list">{invites.map((invite) => <div className="invite-row" key={invite.id}><code>{invite.code}</code><span>{invite.role === 'editor' ? 'Editor' : 'Lector'} · {invite.expires_at ? `vence ${new Date(invite.expires_at).toLocaleDateString('es')}` : 'sin vencimiento'} · {invite.uses}/{invite.max_uses} usos</span><button className="ghost" onClick={() => copyInvite(invite)}>{copied === invite.id ? <Check size={15}/> : <Copy size={15}/>} {copied === invite.id ? 'Copiado' : 'Copiar'}</button></div>)}</div></section>}<section><h3>Personas con acceso</h3><div className="member-list">{members.map((member) => <div className="member-row" key={member.user_id}><span className="user-avatar">{member.email.slice(0, 2).toUpperCase()}</span><div><strong>{member.email}</strong><small>{member.user_id === session.user.id ? 'Tú' : 'Miembro'}</small></div><span className="role-pill">{member.role === 'owner' ? 'Propietario' : member.role === 'editor' ? 'Editor' : 'Lector'}</span></div>)}</div></section></div><div className="modal-actions"><button className="primary" onClick={close}>Listo</button></div></div></div>
}

function FormModal({ title, close, onSubmit, children, extra }) { return <div className="react-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}><form className="react-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)) }}><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-action" onClick={close}><X size={17}/></button></div><div className="modal-body">{children}{extra}</div><div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary">Guardar</button></div></form></div> }
function ConfirmModal({ close, confirm, title, children }) { return <div className="react-modal-backdrop"><div className="react-modal"><div className="modal-head"><h2>{title}</h2><button className="icon-action" onClick={close}><X size={17}/></button></div><div className="modal-body"><p>{children}</p></div><div className="modal-actions"><button className="ghost" onClick={close}>Cancelar</button><button className="primary danger-fill" onClick={confirm}>Mover a la papelera</button></div></div></div> }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function SettingsModal({ close, workspace, update, session }) { const exportData = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'luma-workspace.json'; a.click(); URL.revokeObjectURL(url) }; return <div className="react-modal-backdrop"><div className="react-modal"><div className="modal-head"><h2>Ajustes</h2><button className="icon-action" onClick={close}><X size={17}/></button></div><div className="modal-body"><button className="ghost" onClick={exportData}>Descargar copia de datos</button><button className="ghost danger" onClick={() => update(() => initialWorkspace())}>Restaurar datos de ejemplo</button>{session && <button className="ghost" onClick={() => supabase.auth.signOut()}><LogOut size={15}/> Cerrar sesión</button>}</div><div className="modal-actions"><button className="primary" onClick={close}>Listo</button></div></div></div> }

function clock(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
function toMinutes(value) { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes }
function snap(value) { return Math.round(value / 15) * 15 }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
function parseDate(value) { const [year, month, day] = String(value).split('-').map(Number); const date = new Date(year, month - 1, day, 12); return Number.isNaN(date.getTime()) ? new Date() : date }
function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
function addMonths(date, amount) { const next = new Date(date); next.setMonth(next.getMonth() + amount); return next }
function startOfDay(date) { const next = new Date(date); next.setHours(0, 0, 0, 0); return next }
function startOfWeek(date) { const next = startOfDay(date); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return next }
function endOfWeek(date) { return addDays(startOfWeek(date), 6) }
function dateRange(start, end) { const days = []; for (let date = new Date(start); date <= end; date = addDays(date, 1)) days.push(date); return days }
function weekDates(anchor = new Date()) { const monday = startOfWeek(anchor); return DAYS.map((_, index) => addDays(monday, index)) }
function sameDay(a, b) { return a.toDateString() === b.toDateString() }
function dayIndex(date) { return (date.getDay() + 6) % 7 }
function formatShortDate(date) { return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) }
function formatTinyDate(date) { return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date) }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1) }
function projectStats(project, tasks) { const linked = tasks.filter((task) => project.taskIds?.includes(task.id)); const done = linked.filter((task) => task.done).length; return { total: linked.length, done, progress: linked.length ? Math.round(done / linked.length * 100) : 0 } }
function downloadText(content, filename, type) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }
function escapeXml(value = '') { return String(value).replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]) }
function formatBytes(bytes) { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}` }
function escapeHtml(text = '') { return String(text).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]) }
function sanitizeRich(html = '') { const template = document.createElement('template'); template.innerHTML = html; const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'BR', 'DIV', 'P', 'SPAN']); [...template.content.querySelectorAll('*')].reverse().forEach((element) => { if (!allowed.has(element.tagName)) { element.replaceWith(document.createTextNode(element.textContent || '')); return } [...element.attributes].forEach((attribute) => { if (element.tagName === 'A' && attribute.name === 'href' && /^https?:\/\//i.test(attribute.value)) return; element.removeAttribute(attribute.name) }); if (element.tagName === 'A' && element.hasAttribute('href')) { element.target = '_blank'; element.rel = 'noopener' } }); return template.innerHTML }

