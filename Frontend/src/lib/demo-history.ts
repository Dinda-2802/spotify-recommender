import { getDemoSession } from './demo-auth'

export type DemoTrack = {
  index: number
  name: string
  artists: string
  cluster: number
}
export type DemoRecommendedTrack = DemoTrack & { rank: number; similarity: number }
export type DemoSearchEntry = {
  id: string
  at: string
  query: string
  track: DemoTrack
}
export type DemoRecommendationEntry = {
  id: string
  at: string
  seed: DemoTrack
  mode: 'cluster' | 'all'
  requested: number
  results: DemoRecommendedTrack[]
}
export type DemoActivityKind = 'register' | 'login' | 'logout' | 'search' | 'recommendation' | 'profile'
export type DemoActivityEntry = {
  id: string
  at: string
  kind: DemoActivityKind
  title: string
  detail: string
}
export type DemoHistory = {
  searches: DemoSearchEntry[]
  recommendations: DemoRecommendationEntry[]
  activities: DemoActivityEntry[]
}
export type DemoHistorySection = keyof DemoHistory

const PREFIX = 'spotify-analytics.preview-history.v1:'
const MAX_SEARCHES = 100
const MAX_RECOMMENDATIONS = 50
const MAX_ACTIVITIES = 200
const KINDS: DemoActivityKind[] = ['register', 'login', 'logout', 'search', 'recommendation', 'profile']

export function emptyDemoHistory(): DemoHistory {
  return { searches: [], recommendations: [], activities: [] }
}

function storageKey(): string | null {
  if (typeof window === 'undefined') return null
  const user = getDemoSession()
  return user ? PREFIX + encodeURIComponent(user.email.trim().toLowerCase()) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isTrack(value: unknown): value is DemoTrack {
  return isRecord(value) && typeof value.index === 'number' &&
    typeof value.name === 'string' && typeof value.artists === 'string' &&
    typeof value.cluster === 'number'
}

function isRecommended(value: unknown): value is DemoRecommendedTrack {
  if (!isRecord(value)) return false

  const validRecommendation =
    typeof value.rank === 'number' &&
    typeof value.similarity === 'number'

  return validRecommendation && isTrack(value)
}
function isSearch(value: unknown): value is DemoSearchEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.at === 'string' &&
    typeof value.query === 'string' && isTrack(value.track)
}
function isRecommendation(value: unknown): value is DemoRecommendationEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.at === 'string' &&
    isTrack(value.seed) && (value.mode === 'cluster' || value.mode === 'all') &&
    typeof value.requested === 'number' && Array.isArray(value.results) &&
    value.results.every(isRecommended)
}
function isActivity(value: unknown): value is DemoActivityEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.at === 'string' &&
    KINDS.includes(value.kind as DemoActivityKind) &&
    typeof value.title === 'string' && typeof value.detail === 'string'
}

export function getDemoHistory(): DemoHistory {
  const key = storageKey()
  if (!key) return emptyDemoHistory()
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null')
    if (!isRecord(stored)) return emptyDemoHistory()
    return {
      searches: Array.isArray(stored.searches) ? stored.searches.filter(isSearch).slice(0, MAX_SEARCHES) : [],
      recommendations: Array.isArray(stored.recommendations) ? stored.recommendations.filter(isRecommendation).slice(0, MAX_RECOMMENDATIONS) : [],
      activities: Array.isArray(stored.activities) ? stored.activities.filter(isActivity).slice(0, MAX_ACTIVITIES) : [],
    }
  } catch {
    return emptyDemoHistory()
  }
}

function save(history: DemoHistory): boolean {
  const key = storageKey()
  if (!key) return false
  try {
    window.localStorage.setItem(key, JSON.stringify(history))
    window.dispatchEvent(new Event('spotify-analytics-demo-history-updated'))
    return true
  } catch {
    return false // Penyimpanan diblokir atau kuota browser penuh
  }
}
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
function activity(kind: DemoActivityKind, title: string, detail: string): DemoActivityEntry {
  return { id: uid(), at: new Date().toISOString(), kind, title, detail }
}

export function recordDemoActivity(kind: DemoActivityKind, title: string, detail = ''): boolean {
  if (!storageKey()) return false
  const history = getDemoHistory()
  history.activities.unshift(activity(kind, title, detail))
  history.activities = history.activities.slice(0, MAX_ACTIVITIES)
  return save(history)
}

export function recordDemoSearch(query: string, track: DemoTrack): boolean {
  if (!storageKey()) return false
  const history = getDemoHistory()
  history.searches.unshift({
    id: uid(), at: new Date().toISOString(), query: query.trim().slice(0, 200),
    track: { index: track.index, name: track.name, artists: track.artists, cluster: track.cluster },
  })
  history.searches = history.searches.slice(0, MAX_SEARCHES)
  history.activities.unshift(activity('search', 'Memilih lagu dari pencarian', `${track.name} — ${track.artists}`))
  history.activities = history.activities.slice(0, MAX_ACTIVITIES)
  return save(history)
}

export function recordDemoRecommendation(input: {
  seed: DemoTrack
  mode: 'cluster' | 'all'
  requested: number
  results: DemoRecommendedTrack[]
}): boolean {
  if (!storageKey()) return false
  const history = getDemoHistory()
  history.recommendations.unshift({
    id: uid(), at: new Date().toISOString(),
    seed: { index: input.seed.index, name: input.seed.name, artists: input.seed.artists, cluster: input.seed.cluster },
    mode: input.mode, requested: input.requested,
    results: input.results.slice(0, 20).map(item => ({
      index: item.index, name: item.name, artists: item.artists, cluster: item.cluster,
      rank: item.rank, similarity: item.similarity,
    })),
  })
  history.recommendations = history.recommendations.slice(0, MAX_RECOMMENDATIONS)
  history.activities.unshift(activity('recommendation', 'Menjalankan rekomendasi',
    `${input.seed.name} — ${input.results.length} lagu (${input.mode === 'cluster' ? 'Filter cluster' : 'Semua lagu'})`))
  history.activities = history.activities.slice(0, MAX_ACTIVITIES)
  return save(history)
}

export function deleteDemoHistoryEntry(section: DemoHistorySection, id: string): boolean {
  if (!storageKey()) return false
  const history = getDemoHistory()
  if (section === 'searches') history.searches = history.searches.filter(item => item.id !== id)
  else if (section === 'recommendations') history.recommendations = history.recommendations.filter(item => item.id !== id)
  else history.activities = history.activities.filter(item => item.id !== id)
  return save(history)
}

export function clearDemoHistorySection(section: DemoHistorySection): boolean {
  if (!storageKey()) return false
  const history = getDemoHistory()
  if (section === 'searches') history.searches = []
  else if (section === 'recommendations') history.recommendations = []
  else history.activities = []
  return save(history)
}
