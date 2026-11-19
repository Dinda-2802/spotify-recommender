export type DemoUser = {
  displayName: string
  email: string
  bio: string
  createdAt: string
}

const USERS_KEY = 'spotify-analytics.preview-users.v1'
const SESSION_KEY = 'spotify-analytics.preview-session.v1'

function hasBrowserStorage(): boolean { return typeof window !== 'undefined' }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readUsers(): DemoUser[] {
  if (!hasBrowserStorage()) return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(USERS_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is DemoUser =>
      typeof item === 'object' && item !== null &&
      typeof item.email === 'string' && typeof item.displayName === 'string' &&
      typeof item.createdAt === 'string' && typeof item.bio === 'string',
    )
  } catch { return [] }
}

export function getDemoSession(): DemoUser | null {
  if (!hasBrowserStorage()) return null
  try {
    const email = window.sessionStorage.getItem(SESSION_KEY)
    if (!email) return null
    const found = readUsers().find((item) => item.email === email)
    if (!found) window.sessionStorage.removeItem(SESSION_KEY)
    return found ?? null
  } catch { return null }
}

/** Pendaftaran simulasi (hanya profil publik lokal, tanpa password). */
export function registerDemo(displayName: string, email: string): DemoUser {
  if (!hasBrowserStorage()) throw new Error('Pratinjau memerlukan browser.')
  const normalized = normalizeEmail(email)
  if (readUsers().some((item) => item.email === normalized)) {
    throw new Error('Email ini sudah terdaftar dalam pratinjau. Silakan pilih Login.')
  }
  const user: DemoUser = {
    displayName: displayName.trim(), email: normalized, bio: '',
    createdAt: new Date().toISOString(),
  }
  window.localStorage.setItem(USERS_KEY, JSON.stringify([...readUsers(), user]))
  window.sessionStorage.setItem(SESSION_KEY, user.email)
  return user
}

/** Login simulasi: hanya mengenali email yang terdaftar di browser ini. */
export function loginDemo(email: string): DemoUser {
  if (!hasBrowserStorage()) throw new Error('Pratinjau memerlukan browser.')
  const user = readUsers().find((item) => item.email === normalizeEmail(email))
  if (!user) {
    throw new Error('Email ini belum didaftarkan dalam pratinjau. Pilih Daftar Sekarang.')
  }
  window.sessionStorage.setItem(SESSION_KEY, user.email)
  return user
}

export function updateDemoProfile(displayName: string, bio: string): DemoUser {
  const current = getDemoSession()
  if (!current || !hasBrowserStorage()) throw new Error('Silakan login terlebih dahulu.')
  const updated = { ...current, displayName: displayName.trim(), bio: bio.trim() }
  const users = readUsers().map((item) => item.email === updated.email ? updated : item)
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return updated
}

export function logoutDemo(): void {
  if (!hasBrowserStorage()) return
  window.sessionStorage.removeItem(SESSION_KEY)
}
