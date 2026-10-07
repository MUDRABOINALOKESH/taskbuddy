import { createServer } from 'node:http'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCallback)
const serverDirectory = dirname(fileURLToPath(import.meta.url))
const dataDirectory = join(serverDirectory, '..', 'data')
const databasePath = join(dataDirectory, 'store.json')
const port = Number(process.env.PORT || 3001)
const sessionDuration = 30 * 24 * 60 * 60 * 1000

async function readDatabase() {
  try {
    return JSON.parse(await readFile(databasePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { users: [], tasks: [], sessions: [] }
  }
}

async function writeDatabase(database) {
  await mkdir(dataDirectory, { recursive: true })
  await writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`, { mode: 0o600 })
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > 16_384) throw Object.assign(new Error('Request is too large.'), { status: 413 })
  }
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
}

async function authenticatedUser(request, database) {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const session = database.sessions.find((entry) => entry.tokenHash === tokenHash && entry.expiresAt > Date.now())
  return session ? database.users.find((user) => user.id === session.userId) || null : null
}

async function issueSession(database, user) {
  const token = randomBytes(32).toString('base64url')
  database.sessions = database.sessions.filter((session) => session.expiresAt > Date.now())
  database.sessions.push({ tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: Date.now() + sessionDuration })
  await writeDatabase(database)
  return { token, user: { id: user.id, name: user.name, email: user.email } }
}

async function handle(request, response) {
  response.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || 'http://localhost:5173')
  response.setHeader('Vary', 'Origin')
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' })
    return response.end()
  }

  const database = await readDatabase()
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const route = url.pathname.replace(/\/$/, '')
  const body = ['POST', 'PATCH', 'PUT'].includes(request.method) ? await readBody(request) : {}

  if (request.method === 'POST' && (route === '/api/auth/register' || route === '/api/auth/login')) {
    const isRegister = route.endsWith('/register')
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 256) {
      return send(response, 400, { error: 'Enter a valid email and a password between 8 and 256 characters.' })
    }
    let user = database.users.find((entry) => entry.email === email)
    if (isRegister) {
      if (user) return send(response, 409, { error: 'An account with that email already exists.' })
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
      if (!name) return send(response, 400, { error: 'Enter your name to create an account.' })
      const salt = randomBytes(16).toString('hex')
      const passwordHash = (await scrypt(password, salt, 64)).toString('hex')
      user = { id: randomBytes(16).toString('hex'), name, email, salt, passwordHash }
      database.users.push(user)
    } else {
      if (!user) return send(response, 401, { error: 'Email or password is incorrect.' })
      const passwordHash = await scrypt(password, user.salt, 64)
      const expectedHash = Buffer.from(user.passwordHash, 'hex')
      if (expectedHash.length !== passwordHash.length || !timingSafeEqual(expectedHash, passwordHash)) {
        return send(response, 401, { error: 'Email or password is incorrect.' })
      }
    }
    return send(response, 200, await issueSession(database, user))
  }

  if (request.method === 'POST' && route === '/api/auth/logout') {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      database.sessions = database.sessions.filter((session) => session.tokenHash !== tokenHash)
      await writeDatabase(database)
    }
    return send(response, 200, { success: true })
  }

  if (!route.startsWith('/api/')) return send(response, 404, { error: 'Not found.' })
  const user = await authenticatedUser(request, database)
  if (!user) return send(response, 401, { error: 'Please sign in again.' })

  if (request.method === 'GET' && route === '/api/tasks') {
    return send(response, 200, { tasks: database.tasks.filter((task) => task.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
  }

  if (request.method === 'POST' && route === '/api/tasks') {
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > 160) return send(response, 400, { error: 'Task names must contain between 1 and 160 characters.' })
    const task = {
      id: randomBytes(12).toString('hex'), userId: user.id, text,
      priority: ['Low', 'Medium', 'High'].includes(body.priority) ? body.priority : 'Medium',
      category: ['General', 'Work', 'Personal'].includes(body.category) ? body.category : 'General',
      dueDate: typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : '',
      completed: false, createdAt: new Date().toISOString(),
    }
    database.tasks.push(task)
    await writeDatabase(database)
    return send(response, 201, { task })
  }

  const taskMatch = route.match(/^\/api\/tasks\/([a-f\d]{24})$/i)
  if (taskMatch) {
    const index = database.tasks.findIndex((task) => task.id === taskMatch[1] && task.userId === user.id)
    if (index === -1) return send(response, 404, { error: 'Task not found.' })
    if (request.method === 'DELETE') {
      database.tasks.splice(index, 1)
      await writeDatabase(database)
      return send(response, 200, { success: true })
    }
    if (request.method === 'PATCH') {
      const task = database.tasks[index]
      if (typeof body.text === 'string') {
        const text = body.text.trim()
        if (!text || text.length > 160) return send(response, 400, { error: 'Task names must contain between 1 and 160 characters.' })
        task.text = text
      }
      if (['Low', 'Medium', 'High'].includes(body.priority)) task.priority = body.priority
      if (['General', 'Work', 'Personal'].includes(body.category)) task.category = body.category
      if (typeof body.dueDate === 'string' && (!body.dueDate || /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) task.dueDate = body.dueDate
      if (typeof body.completed === 'boolean') task.completed = body.completed
      await writeDatabase(database)
      return send(response, 200, { task })
    }
  }

  return send(response, 404, { error: 'Not found.' })
}

createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error(error)
    if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : 'The server could not complete the request.' })
    else response.destroy()
  })
}).listen(port, () => console.log(`TaskBuddy API listening on http://localhost:${port}`))