import { useEffect, useMemo, useState } from 'react'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import ProgressTracker from './components/ProgressTracker'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const SESSION_KEY = 'taskbuddy-session'
const filters = ['All tasks', 'Today', 'Upcoming', 'Completed']

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Something went wrong.')
  return result
}

function AuthScreen({ onSignIn }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await request(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      })
      onSignIn(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="#home"><span className="brand-mark">t.</span> taskbuddy</a>
        <div className="story-copy">
          <span className="eyebrow">A little more focus</span>
          <h1>Make room for<br /><em>meaningful work.</em></h1>
          <p>A calm place to gather your tasks, find your rhythm, and see what you’ve made progress on.</p>
          <div className="story-note"><span className="note-check">✓</span><span><strong>Small steps count.</strong><br />Your day, one thoughtful thing at a time.</span></div>
        </div>
        <span className="story-footer">A clearer day starts here.</span>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h2>{mode === 'login' ? 'Welcome back.' : 'Let’s get started.'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Pick up where you left off.' : 'Create an account to keep your tasks together.'}</p>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" required maxLength={60} /></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        </div>
        <span className="auth-privacy">Your workspace is private to your account.</span>
      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const [tasks, setTasks] = useState([])
  const [activeFilter, setActiveFilter] = useState('All tasks')
  const [category, setCategory] = useState('All categories')
  const [query, setQuery] = useState('')
  const [editingTask, setEditingTask] = useState(null)
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.token) return
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    request('/tasks', { token: session.token })
      .then((result) => setTasks(result.tasks))
      .catch((err) => {
        setError(err.message)
        if (err.message === 'Please sign in again.') signOut()
      })
      .finally(() => setLoading(false))
  }, [session])

  function signOut() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setTasks([])
  }

  function signIn(result) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(result))
    setSession(result)
    setTasks(result.tasks || [])
    setLoading(false)
  }

  async function saveTask(task) {
    const isEditing = Boolean(task.id)
    const result = await request(isEditing ? `/tasks/${task.id}` : '/tasks', {
      token: session.token,
      method: isEditing ? 'PATCH' : 'POST',
      body: JSON.stringify(task),
    })
    setTasks((current) => isEditing ? current.map((item) => item.id === result.task.id ? result.task : item) : [result.task, ...current])
    setEditingTask(null)
  }

  async function updateTask(task) {
    const result = await request(`/tasks/${task.id}`, { token: session.token, method: 'PATCH', body: JSON.stringify(task) })
    setTasks((current) => current.map((item) => item.id === task.id ? result.task : item))
  }

  async function deleteTask(id) {
    await request(`/tasks/${id}`, { token: session.token, method: 'DELETE' })
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const visibleTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return tasks.filter((task) => {
      const filterMatch = activeFilter === 'All tasks'
        || (activeFilter === 'Today' && task.dueDate === today && !task.completed)
        || (activeFilter === 'Upcoming' && task.dueDate > today && !task.completed)
        || (activeFilter === 'Completed' && task.completed)
      const categoryMatch = category === 'All categories' || task.category === category
      return filterMatch && categoryMatch && task.text.toLowerCase().includes(query.toLowerCase())
    })
  }, [tasks, activeFilter, category, query])

  const completedCount = tasks.filter((task) => task.completed).length
  const todayCount = tasks.filter((task) => task.dueDate === new Date().toISOString().slice(0, 10) && !task.completed).length

  if (!session) return <AuthScreen onSignIn={signIn} />

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="#home"><span className="brand-mark">t.</span> taskbuddy</a>
        <div className="side-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Task views">
          {filters.map((filter, index) => (
            <button key={filter} className={`nav-item ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}>
              <span className="nav-symbol">{['▦', '◷', '↗', '✓'][index]}</span><span>{filter}</span>
              {filter === 'Today' && todayCount > 0 && <span className="nav-count">{todayCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ProgressTracker tasks={tasks} />
          <div className="profile-row"><span className="avatar">{session.user.name.charAt(0).toUpperCase()}</span><span className="profile-name">{session.user.name}</span><button className="signout-button" onClick={signOut} aria-label="Sign out" title="Sign out">↗</button></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><span className="breadcrumb">My workspace <span>/</span> {activeFilter}</span><span className="today-date">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></header>
        <section className="page-heading"><div><span className="eyebrow">A GOOD DAY TO BEGIN</span><h1>{activeFilter === 'All tasks' ? 'Your tasks' : activeFilter}</h1><p>{completedCount === tasks.length && tasks.length > 0 ? 'Everything is wrapped up. Enjoy the breathing room.' : `${tasks.length - completedCount} things in motion. Take them one at a time.`}</p></div><div className="day-stamp"><span>FOCUS</span><strong>{String(todayCount).padStart(2, '0')}</strong><span>TODAY</span></div></section>
        <section className="task-compose"><div className="compose-topline"><span className="compose-icon">＋</span><div><h2>{editingTask ? 'A small adjustment' : 'What needs your attention?'}</h2><p>{editingTask ? 'Update the details below.' : 'Get it out of your head and onto the list.'}</p></div></div><TaskForm key={editingTask?.id || 'new'} initialTask={editingTask} onSave={saveTask} onCancel={() => setEditingTask(null)} /></section>
        <section className="list-section"><div className="list-toolbar"><div><h2>{activeFilter === 'All tasks' ? 'The list' : activeFilter}</h2><span className="task-count">{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</span></div><div className="list-controls"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a task" /></label><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Work</option><option>Personal</option><option>General</option></select></div></div>
          {error && <p className="inline-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></p>}
          {loading ? <div className="empty-state"><span className="empty-mark">…</span><h3>Opening your workspace</h3></div> : <TaskList tasks={visibleTasks} onUpdate={updateTask} onDelete={deleteTask} onEdit={setEditingTask} />}
        </section>
        <footer className="page-footer"><span>Made for the work that matters.</span>{tasks.length > 0 && <button className="clear-button" onClick={async () => { if (window.confirm('Delete every task in your workspace?')) { await Promise.all(tasks.map((task) => deleteTask(task.id))) } }}>Clear all tasks</button>}</footer>
      </main>
    </div>
  )
}
