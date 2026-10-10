
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import LiquidBackground from './LiquidBackground'
import './App.css'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
type PageName = 'Overview' | 'My Tasks' | 'Insights'

interface Task {
  id: number
  title: string
  description?: string | null
  Description?: string | null
  status: TaskStatus
  createdAt: string
}

interface TaskPage {
  content: Task[]
  totalPages: number
  totalElements: number
}

const PAGE_SIZE = 100

const statusLabels: Record<TaskStatus, string> = {
  TODO: 'Queued',
  IN_PROGRESS: 'In motion',
  DONE: 'Complete',
}

function getDescription(task: Task) {
  return task.description ?? task.Description ?? ''
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed: ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function App() {
  const [pageName, setPageName] = useState<PageName>('Overview')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [clock, setClock] = useState(() => new Date())
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadTasks() {
      setLoading(true)

      try {
        const params = new URLSearchParams({
          page: '0',
          size: String(PAGE_SIZE),
          sort: 'createdAt,desc',
        })

        const result = await api<TaskPage>(`/api/tasks?${params}`)

        if (!cancelled) {
          setTasks(result.content ?? [])
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load tasks.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTasks()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const counts = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((task) => task.status === 'TODO').length,
    progress: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    done: tasks.filter((task) => task.status === 'DONE').length,
  }), [tasks])

  const completion = counts.total
      ? Math.round((counts.done / counts.total) * 100)
      : 0

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchesSearch =
          task.title.toLowerCase().includes(query) ||
          getDescription(task).toLowerCase().includes(query)

      const matchesStatus = filter === 'ALL' || task.status === filter

      return matchesSearch && matchesStatus
    })
  }, [tasks, search, filter])

  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / 8))
  const visibleTasks = filteredTasks.slice(page * 8, (page + 1) * 8)

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null

  function navigate(name: PageName) {
    setPageName(name)
    setPage(0)
    if (name !== 'My Tasks') {
      setSearch('')
      setFilter('ALL')
    }
  }

  function goToTasks(status: TaskStatus | 'ALL' = 'ALL') {
    setFilter(status)
    setSearch('')
    setPage(0)
    setPageName('My Tasks')
  }

  function openCreate() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditingId(task.id)
    setTitle(task.title)
    setDescription(getDescription(task))
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setFormError('')
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()

    if (!cleanTitle) {
      setFormError('Give this task a title first.')
      return
    }

    if (cleanTitle.length > 100 || cleanDescription.length > 500) {
      setFormError('Title limit: 100 characters. Description limit: 500.')
      return
    }

    setSaving(true)

    try {
      const body = JSON.stringify({
        title: cleanTitle,
        description: cleanDescription,
      })

      if (editingId !== null) {
        await api(`/api/tasks/${editingId}`, { method: 'PUT', body })
      } else {
        await api('/api/tasks', { method: 'POST', body })
      }

      setModalOpen(false)
      setEditingId(null)
      setPage(0)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save task.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    const previousTasks = tasks

    setTasks((current) =>
        current.map((item) => item.id === task.id ? { ...item, status } : item),
    )

    try {
      await api(`/api/tasks/status/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setTasks(previousTasks)
      setError(err instanceof Error ? err.message : 'Could not update status.')
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return

    try {
      await api<void>(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (activeTaskId === task.id) setActiveTaskId(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete task.')
    }
  }

  function taskList(items: Task[]) {
    if (items.length === 0) {
      return (
          <div className="empty-state">
            <div className="empty-orbit"><span>✳</span></div>
            <p className="eyebrow">CLEAR SKIES</p>
            <h3>Nothing orbiting here.</h3>
            <p>Every big thing starts as a tiny task. Add your next one.</p>
            <button className="primary-button" onClick={openCreate}>
              <span>＋</span> Create a task
            </button>
          </div>
      )
    }

    return (
        <div className="task-list">
          {items.map((task, index) => (
              <article
                  className={`task-row ${task.status === 'DONE' ? 'task-row-done' : ''}`}
                  key={task.id}
                  style={{ '--row-index': index } as CSSProperties}
              >
                <button
                    className={`task-check ${task.status === 'DONE' ? 'checked' : ''}`}
                    aria-label={`Mark ${task.title} as ${task.status === 'DONE' ? 'to do' : 'completed'}`}
                    onClick={() => void updateStatus(task, task.status === 'DONE' ? 'TODO' : 'DONE')}
                >
                  {task.status === 'DONE' ? '✓' : ''}
                </button>

                <button
                    className="task-main"
                    onClick={() => setActiveTaskId(task.id)}
                    title="Open task details"
                >
                  <span className="task-title">{task.title}</span>
                  {getDescription(task) && (
                      <span className="task-description">{getDescription(task)}</span>
                  )}
                  <span className="task-date">
                ID / {String(task.id).padStart(4, '0')} · Added{' '}
                    {task.createdAt
                        ? new Date(task.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                        : 'recently'}
              </span>
                </button>

                <span className={`status-pill status-${task.status.toLowerCase()}`}>
              <span className="status-indicator" />
                  {statusLabels[task.status]}
            </span>

                <select
                    className="task-status-select"
                    aria-label={`Change status of ${task.title}`}
                    value={task.status}
                    onChange={(event) => void updateStatus(task, event.target.value as TaskStatus)}
                >
                  <option value="TODO">Queued</option>
                  <option value="IN_PROGRESS">In motion</option>
                  <option value="DONE">Complete</option>
                </select>

                <div className="task-actions">
                  <button className="icon-button" title="Edit task" onClick={() => openEdit(task)}>↗</button>
                  <button className="icon-button delete-action" title="Delete task" onClick={() => void deleteTask(task)}>×</button>
                </div>
              </article>
          ))}
        </div>
    )
  }

  return (
      <>
        <LiquidBackground />

        <div className="app-layout">
          <aside className="sidebar glass-panel">
            <button className="brand" onClick={() => navigate('Overview')} aria-label="Daymark home">
              <span className="brand-icon">d<span>✳</span></span>
              <span className="brand-name">daymark<span className="brand-dot">.</span></span>
            </button>

            <div className="workspace-chip">
              <span className="workspace-avatar">V</span>
              <span><strong>Personal space</strong><small>Local workspace</small></span>
              <span className="live-dot" />
            </div>

            <div className="sidebar-label">NAVIGATE <span>01—03</span></div>
            <nav className="nav-list">
              <button className={pageName === 'Overview' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Overview')}>
                <span className="nav-icon">⌘</span> Overview
                <span className="nav-arrow">↗</span>
              </button>
              <button className={pageName === 'My Tasks' ? 'nav-item active' : 'nav-item'} onClick={() => goToTasks()}>
                <span className="nav-icon">◫</span> All missions
                <span className="nav-count">{counts.total}</span>
              </button>
              <button className={pageName === 'Insights' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Insights')}>
                <span className="nav-icon">◌</span> Intelligence
                <span className="nav-arrow">↗</span>
              </button>
            </nav>

            <div className="sidebar-label filter-label">MISSION STATUS <span>LIVE</span></div>
            <nav className="nav-list quick-filters">
              <button className="nav-item" onClick={() => goToTasks('TODO')}>
                <span className="filter-dot dot-todo" /> Queued
                <span className="nav-count">{counts.todo}</span>
              </button>
              <button className="nav-item" onClick={() => goToTasks('IN_PROGRESS')}>
                <span className="filter-dot dot-progress" /> In motion
                <span className="nav-count">{counts.progress}</span>
              </button>
              <button className="nav-item" onClick={() => goToTasks('DONE')}>
                <span className="filter-dot dot-done" /> Complete
                <span className="nav-count">{counts.done}</span>
              </button>
            </nav>

            <div className="sidebar-bottom">
              <div className="sidebar-motto">
                <div className="motto-glyph">↗</div>
                <span className="eyebrow">FIELD NOTE / 001</span>
                <p>Make a dent in the universe. Start with one thing.</p>
                <div className="motto-line"><span /></div>
              </div>
              <div className="sidebar-footer">
                <span className="footer-pulse" />
                SYSTEM OPERATIONAL
                <span className="footer-version">v.01</span>
              </div>
            </div>
          </aside>

          <main className="main-area">
            <header className="topbar">
              <div className="breadcrumbs">
                <span className="crumb-mark">✳</span>
                DAYMARK <span className="crumb-slash">/</span>
                <strong>{pageName.toUpperCase()}</strong>
              </div>
              <div className="topbar-right">
                <div className="clock-block">
                  <span className="live-dot" />
                  <span>{clock.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}</span>
                </div>
                <button className="primary-button top-add" onClick={openCreate}>
                  <span className="add-cross">＋</span> New mission
                </button>
              </div>
            </header>

            <div className="content">
              {error && (
                  <div className="error-banner">
                    <span>⚠</span> {error}
                    <button onClick={() => setError('')} aria-label="Dismiss error">×</button>
                  </div>
              )}

              {pageName === 'Overview' && (
                  <>
                    <section className="hero">
                      <div className="hero-copy">
                        <div className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> YOUR SPACE. YOUR PACE.</div>
                        <h1>Make it<br /> <em>happen.</em><span className="hero-period">✳</span></h1>
                        <p className="hero-description">A clearer head starts here. Pick a direction, make a little progress, and let the rest unfold.</p>
                        <div className="hero-actions">
                          <button className="primary-button" onClick={openCreate}>＋ Start something</button>
                          <button className="text-button" onClick={() => goToTasks('ALL')}>Explore missions <span>↗</span></button>
                        </div>
                        <div className="hero-footnote"><span className="tiny-star">✳</span> BUILT FOR THE NEXT VERSION OF YOU</div>
                      </div>

                      <div className="hero-visual" aria-label="Animated progress illustration">
                        <div className="visual-topline"><span>PERSONAL TELEMETRY</span><span>LIVE / 001</span></div>
                        <div className="orbit-scene">
                          <div className="orbit orbit-one" />
                          <div className="orbit orbit-two" />
                          <div className="orbit orbit-three" />
                          <div className="planet planet-main"><span>✳</span></div>
                          <div className="planet planet-small" />
                          <div className="planet planet-lime" />
                          <div className="orbit-label orbit-label-top">INTENTION<br /><strong>→ ACTION</strong></div>
                          <div className="orbit-label orbit-label-bottom">KEEP MOVING<span>●</span></div>
                          <span className="scene-star scene-star-one">✳</span>
                          <span className="scene-star scene-star-two">✦</span>
                          <span className="scene-star scene-star-three">·</span>
                        </div>
                        <div className="visual-bottomline"><span>FIG. 01 — THE MOMENTUM ENGINE</span><span>∞</span></div>
                      </div>
                    </section>

                    <section className="section-heading">
                      <div><span className="section-index">01 /</span><h2>At a glance<span className="lime-period">.</span></h2></div>
                      <span className="section-caption">YOUR CURRENT MOMENTUM</span>
                    </section>

                    <section className="stats-grid">
                      <article className="metric-card metric-total">
                        <div className="metric-top"><span>ALL MISSIONS</span><span className="metric-icon">↗</span></div>
                        <strong>{loading ? '—' : String(counts.total).padStart(2, '0')}</strong>
                        <div className="metric-foot"><span className="metric-mini-bar"><i style={{ width: `${counts.total ? 100 : 0}%` }} /></span><span>IN YOUR ORBIT</span></div>
                      </article>
                      <article className="metric-card metric-progress">
                        <div className="metric-top"><span>IN MOTION</span><span className="metric-icon">◉</span></div>
                        <strong>{loading ? '—' : String(counts.progress).padStart(2, '0')}</strong>
                        <div className="metric-foot"><span className="metric-status-dot" /> KEEP THE ENERGY</div>
                      </article>
                      <article className="metric-card metric-done">
                        <div className="metric-top"><span>COMPLETED</span><span className="metric-icon">✳</span></div>
                        <strong>{loading ? '—' : String(counts.done).padStart(2, '0')}</strong>
                        <div className="metric-foot"><span className="metric-mini-bar"><i style={{ width: `${completion}%` }} /></span><span>{completion}% OF TOTAL</span></div>
                      </article>
                      <article className="metric-card metric-rate">
                        <div className="metric-top"><span>COMPLETION RATE</span><span className="metric-icon">◎</span></div>
                        <strong>{loading ? '—' : `${completion}%`}</strong>
                        <div className="metric-foot"><span>SMALL WINS. REAL CHANGE.</span></div>
                      </article>
                    </section>

                    <section className="dashboard-grid">
                      <article className="glass-panel recent-panel">
                        <div className="panel-heading">
                          <div><span className="section-index">02 / ACTIVITY</span><h2>Latest missions<span className="lime-period">.</span></h2></div>
                          <button className="round-link" onClick={() => goToTasks('ALL')} aria-label="View all missions">↗</button>
                        </div>
                        <p className="panel-subtitle">The next small thing is usually the big thing.</p>
                        {loading ? <p className="loading-state"><span className="loading-spinner" /> Synchronising missions…</p> : taskList(tasks.slice(0, 5))}
                      </article>

                      <article className="glass-panel progress-panel">
                        <div className="panel-heading">
                          <div><span className="section-index">03 / MOMENTUM</span><h2>Your trajectory<span className="lime-period">.</span></h2></div>
                        </div>
                        <div className="progress-orb-wrap">
                          <div className="progress-orb" style={{ '--progress': `${completion}%` } as CSSProperties}>
                            <div className="progress-orb-inner"><span>YOU'RE</span><strong>{completion}<small>%</small></strong><span>THERE</span></div>
                          </div>
                          <span className="orb-caption orb-caption-one">CURRENT<br />POSITION</span>
                          <span className="orb-caption orb-caption-two">TARGET / 100</span>
                        </div>
                        <div className="progress-detail">
                          <span><i className="legend-dot dot-done" /> Completed</span><strong>{counts.done}</strong>
                        </div>
                        <div className="progress-detail">
                          <span><i className="legend-dot dot-progress" /> In motion</span><strong>{counts.progress}</strong>
                        </div>
                        <div className="progress-detail">
                          <span><i className="legend-dot dot-todo" /> Queued</span><strong>{counts.todo}</strong>
                        </div>
                        <button className="wide-outline-button" onClick={() => navigate('Insights')}>Open intelligence <span>↗</span></button>
                      </article>
                    </section>

                    <section className="quote-strip">
                      <span className="quote-symbol">“</span>
                      <p>You don't need to see the whole staircase. Just take the first step.</p>
                      <span className="quote-credit">A REMINDER TO BEGIN</span>
                    </section>
                  </>
              )}

              {pageName === 'My Tasks' && (
                  <>
                    <section className="page-hero compact-hero">
                      <div>
                        <p className="eyebrow"><span className="eyebrow-line" /> MISSION CONTROL / ALL TASKS</p>
                        <h1>Get into<br /><em>the details.</em></h1>
                        <p className="hero-description">Every open loop, every tiny win. It's all here.</p>
                      </div>
                      <div className="page-hero-number"><span>ACTIVE<br />DATABASE</span><strong>{String(filteredTasks.length).padStart(2, '0')}</strong><small>RECORDS FOUND</small></div>
                    </section>

                    <section className="glass-panel all-tasks-panel">
                      <div className="panel-heading">
                        <div><span className="section-index">01 / TASK DATABASE</span><h2>All missions<span className="lime-period">.</span></h2></div>
                        <span className="database-live"><i /> DATABASE LIVE</span>
                      </div>

                      <div className="task-toolbar">
                        <div className="search-box">
                          <span>⌕</span>
                          <input
                              value={search}
                              onChange={(event) => { setSearch(event.target.value); setPage(0) }}
                              placeholder="Search by mission or details…"
                              aria-label="Search tasks"
                          />
                          {search && <button onClick={() => { setSearch(''); setPage(0) }} aria-label="Clear search">×</button>}
                        </div>
                        <select value={filter} onChange={(event) => { setFilter(event.target.value as TaskStatus | 'ALL'); setPage(0) }} aria-label="Filter by status">
                          <option value="ALL">All statuses</option>
                          <option value="TODO">Queued</option>
                          <option value="IN_PROGRESS">In motion</option>
                          <option value="DONE">Complete</option>
                        </select>
                      </div>

                      <div className="list-meta"><span>SHOWING {visibleTasks.length} OF {filteredTasks.length} RECORDS</span><span>ORDER / NEWEST FIRST</span></div>
                      {loading ? <p className="loading-state"><span className="loading-spinner" /> Loading task database…</p> : taskList(visibleTasks)}

                      {!loading && filteredTasks.length > 0 && (
                          <div className="pagination">
                            <span>PAGE <strong>{String(page + 1).padStart(2, '0')}</strong> / {String(pageCount).padStart(2, '0')}</span>
                            <div>
                              <button className="page-button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>←</button>
                              <button className="page-button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>→</button>
                            </div>
                          </div>
                      )}
                    </section>
                  </>
              )}

              {pageName === 'Insights' && (
                  <>
                    <section className="page-hero compact-hero">
                      <div>
                        <p className="eyebrow"><span className="eyebrow-line" /> SIGNAL OVER NOISE</p>
                        <h1>Look how far<br /><em>you've come.</em></h1>
                        <p className="hero-description">A little perspective on the things you're moving forward.</p>
                      </div>
                      <div className="page-hero-number insights-number"><span>OVERALL<br />COMPLETION</span><strong>{completion}<small>%</small></strong><small>BASED ON LOADED TASKS</small></div>
                    </section>

                    <section className="stats-grid insights-stats">
                      <article className="metric-card metric-total"><div className="metric-top"><span>TOTAL RECORDS</span><span className="metric-icon">↗</span></div><strong>{counts.total}</strong><div className="metric-foot">ALL LOADED TASKS</div></article>
                      <article className="metric-card metric-done"><div className="metric-top"><span>COMPLETED</span><span className="metric-icon">✳</span></div><strong>{counts.done}</strong><div className="metric-foot">FINISHED MISSIONS</div></article>
                      <article className="metric-card metric-progress"><div className="metric-top"><span>IN MOTION</span><span className="metric-icon">◉</span></div><strong>{counts.progress}</strong><div className="metric-foot">CURRENTLY UNDERWAY</div></article>
                      <article className="metric-card metric-rate"><div className="metric-top"><span>STILL TO DO</span><span className="metric-icon">◎</span></div><strong>{counts.todo}</strong><div className="metric-foot">YOUR NEXT OPPORTUNITY</div></article>
                    </section>

                    <section className="dashboard-grid insights-dashboard">
                      <article className="glass-panel breakdown-panel">
                        <div className="panel-heading"><div><span className="section-index">01 / DISTRIBUTION</span><h2>Mission mix<span className="lime-period">.</span></h2></div></div>
                        <p className="panel-subtitle">Where your attention currently lives.</p>
                        {([
                          ['Complete', counts.done, 'bar-green'],
                          ['In motion', counts.progress, 'bar-amber'],
                          ['Queued', counts.todo, 'bar-gray'],
                        ] as const).map(([label, value, className]) => (
                            <div className="bar-row" key={label}>
                              <div><span>{label}</span><strong>{value} <small>/ {counts.total}</small></strong></div>
                              <div className="bar-track"><div className={className} style={{ width: `${counts.total ? (value / counts.total) * 100 : 0}%` }} /></div>
                              <span className="bar-percentage">{counts.total ? Math.round((value / counts.total) * 100) : 0}%</span>
                            </div>
                        ))}
                        <div className="insight-note"><span>✳</span> The goal isn't a perfect chart. It's consistent movement.</div>
                      </article>

                      <article className="glass-panel intelligence-panel">
                        <span className="section-index">02 / SYSTEM READOUT</span>
                        <div className="intelligence-glyph">◎</div>
                        <p className="eyebrow">YOUR CURRENT SIGNAL</p>
                        <h2>{completion === 100 && counts.total > 0 ? 'All systems complete.' : completion >= 60 ? 'Momentum looks good.' : completion > 0 ? 'Progress is taking shape.' : 'Your story starts here.'}</h2>
                        <p className="intelligence-copy">
                          {counts.total === 0
                              ? 'Create your first mission and give your momentum somewhere to go.'
                              : completion === 100
                                  ? 'Every loaded task is complete. Celebrate the finish, then decide what comes next.'
                                  : `${counts.done} of ${counts.total} tasks are complete. Every finished task gives you room to focus on the next one.`}
                        </p>
                        <button className="primary-button" onClick={() => goToTasks('TODO')}>Find the next move <span>↗</span></button>
                      </article>
                    </section>
                    <p className="insights-note">READOUT LIMITATION / Insights reflect tasks loaded from your backend. They do not represent historical activity or weekly trends.</p>
                  </>
              )}
            </div>

            <footer className="main-footer">
              <span>DAYMARK® <span className="footer-separator">/</span> MAKE SPACE FOR WHAT MATTERS</span>
              <span>DESIGNED FOR FORWARD MOTION <span className="footer-spark">✳</span></span>
            </footer>
          </main>
        </div>

        {activeTask && (
            <div className="modal-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setActiveTaskId(null)
            }}>
              <section className="task-modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
                <div className="modal-heading">
                  <div><p className="eyebrow">MISSION RECORD / {String(activeTask.id).padStart(4, '0')}</p><h2 id="detail-title">{activeTask.title}</h2></div>
                  <button className="modal-close" onClick={() => setActiveTaskId(null)} aria-label="Close">×</button>
                </div>
                <span className={`status-pill status-${activeTask.status.toLowerCase()}`}><span className="status-indicator" />{statusLabels[activeTask.status]}</span>
                <p className="detail-description">{getDescription(activeTask) || 'No details have been added to this mission.'}</p>
                <div className="detail-date">CREATED / {activeTask.createdAt ? new Date(activeTask.createdAt).toLocaleString('en-IN') : 'DATE UNAVAILABLE'}</div>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={() => setActiveTaskId(null)}>Close</button>
                  <button className="secondary-button" onClick={() => { setActiveTaskId(null); openEdit(activeTask) }}>Edit mission ↗</button>
                  <button className="primary-button" onClick={() => { setActiveTaskId(null); void updateStatus(activeTask, activeTask.status === 'DONE' ? 'TODO' : 'DONE') }}>
                    {activeTask.status === 'DONE' ? 'Reopen mission' : 'Mark complete ✓'}
                  </button>
                </div>
              </section>
            </div>
        )}

        {modalOpen && (
            <div className="modal-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal()
            }}>
              <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div className="modal-heading">
                  <div>
                    <p className="eyebrow">{editingId === null ? 'CREATE / NEW RECORD' : `EDIT / RECORD ${editingId}`}</p>
                    <h2 id="modal-title">{editingId === null ? 'Make it real.' : 'Refine the plan.'}</h2>
                  </div>
                  <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
                </div>
                <p className="modal-intro">{editingId === null ? 'One intention, given a place to begin.' : 'A small adjustment can change the whole trajectory.'}</p>
                <form onSubmit={saveTask}>
                  <label htmlFor="task-title">MISSION TITLE <span>REQUIRED</span></label>
                  <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="e.g. Ship the next big thing" autoFocus required />
                  <label htmlFor="task-description">MISSION NOTES <span>OPTIONAL</span></label>
                  <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="Leave a note for the future you…" />
                  <div className="character-count">{title.length}/100 TITLE CHARACTERS <span>{description.length}/500 NOTES</span></div>
                  {formError && <p className="form-error">⚠ {formError}</p>}
                  <div className="modal-actions">
                    <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>Cancel</button>
                    <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : editingId === null ? 'Launch mission ↗' : 'Save changes ↗'}</button>
                  </div>
                </form>
              </section>
            </div>
        )}
      </>
  )
}

export default App
