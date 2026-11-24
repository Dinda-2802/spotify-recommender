
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'

export type DemoTrack = {
  index: number
  name: string
  artists: string
  cluster: number
}

export type DemoRecommendedTrack = DemoTrack & {
  rank: number
  similarity: number
}

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

export type DemoActivityKind =
  | 'register'
  | 'login'
  | 'logout'
  | 'search'
  | 'recommendation'
  | 'profile'

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

const MAX_SEARCHES = 100
const MAX_RECOMMENDATIONS = 50
const MAX_ACTIVITIES = 200

const cache = new Map<string, DemoHistory>()

export function emptyDemoHistory(): DemoHistory {
  return {
    searches: [],
    recommendations: [],
    activities: [],
  }
}

function currentUid() {
  return auth.currentUser?.uid ?? null
}

function id() {
  return crypto.randomUUID()
}

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new Event('spotify-analytics-demo-history-updated')
    )
  }
}

function reportError(error: unknown) {
  console.error('Firebase history error:', error)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('spotify-history-error', {
        detail: error instanceof Error
          ? error.message
          : 'Gagal menyinkronkan riwayat Firebase.',
      })
    )
  }
}

function getCache(uid: string): DemoHistory {
  if (!cache.has(uid)) {
    cache.set(uid, emptyDemoHistory())
  }
  return cache.get(uid)!
}

function store(
  section: DemoHistorySection,
  entry: DemoSearchEntry | DemoRecommendationEntry | DemoActivityEntry
) {
  const uid = currentUid()
  if (!uid) return false

  const history = getCache(uid)
  const maximum = {
    searches: MAX_SEARCHES,
    recommendations: MAX_RECOMMENDATIONS,
    activities: MAX_ACTIVITIES,
  }[section]

  // Update tampilan sementara
  ;(history[section] as Array<typeof entry>).unshift(entry)
  ;(history[section] as Array<typeof entry>).splice(maximum)
  notify()

  // Simpan permanen ke Firestore
  void setDoc(
    doc(db, 'users', uid, section, entry.id),
    entry
  ).catch(reportError)

  return true
}

export function getDemoHistory(): DemoHistory {
  const uid = currentUid()
  if (!uid) return emptyDemoHistory()

  return {
    searches: [...getCache(uid).searches],
    recommendations: [...getCache(uid).recommendations],
    activities: [...getCache(uid).activities],
  }
}

export function recordDemoActivity(
  kind: DemoActivityKind,
  title: string,
  detail = ''
): boolean {
  return store('activities', {
    id: id(),
    at: new Date().toISOString(),
    kind,
    title,
    detail,
  })
}

export function recordDemoSearch(
  searchQuery: string,
  track: DemoTrack
): boolean {
  const saved = store('searches', {
    id: id(),
    at: new Date().toISOString(),
    query: searchQuery.trim().slice(0, 200),
    track: {
      index: track.index,
      name: track.name,
      artists: track.artists,
      cluster: track.cluster,
    },
  })

  if (saved) {
    recordDemoActivity(
      'search',
      'Memilih lagu dari pencarian',
      `${track.name} — ${track.artists}`
    )
  }

  return saved
}

export function recordDemoRecommendation(input: {
  seed: DemoTrack
  mode: 'cluster' | 'all'
  requested: number
  results: DemoRecommendedTrack[]
}): boolean {
  const saved = store('recommendations', {
    id: id(),
    at: new Date().toISOString(),
    seed: {
      index: input.seed.index,
      name: input.seed.name,
      artists: input.seed.artists,
      cluster: input.seed.cluster,
    },
    mode: input.mode,
    requested: input.requested,
    results: input.results.slice(0, 20).map(item => ({
      index: item.index,
      name: item.name,
      artists: item.artists,
      cluster: item.cluster,
      rank: item.rank,
      similarity: item.similarity,
    })),
  })

  if (saved) {
    recordDemoActivity(
      'recommendation',
      'Menjalankan rekomendasi',
      `${input.seed.name} — ${input.results.length} lagu`
    )
  }

  return saved
}

export function deleteDemoHistoryEntry(
  section: DemoHistorySection,
  entryId: string
): boolean {
  const uid = currentUid()
  if (!uid) return false

  const history = getCache(uid)
  ;(history[section] as Array<{ id: string }>) =
    history[section].filter(item => item.id !== entryId)

  notify()

  void deleteDoc(
    doc(db, 'users', uid, section, entryId)
  ).catch(reportError)

  return true
}

export function clearDemoHistorySection(
  section: DemoHistorySection
): boolean {
  const uid = currentUid()
  if (!uid) return false

  const entries = [...getCache(uid)[section]]
  getCache(uid)[section] = [] as never
  notify()

  void Promise.all(
    entries.map(entry =>
      deleteDoc(doc(db, 'users', uid, section, entry.id))
    )
  ).catch(reportError)

  return true
}

// Sinkronisasi langsung Firestore ke tampilan dashboard
export function subscribeDemoHistory(
  onUpdate: (history: DemoHistory) => void,
  onError?: (message: string) => void
): Unsubscribe {
  let listeners: Unsubscribe[] = []

  const stopListeners = () => {
    listeners.forEach(stop => stop())
    listeners = []
  }

  const stopAuth = onAuthStateChanged(auth, user => {
    stopListeners()

    if (!user) {
      onUpdate(emptyDemoHistory())
      return
    }

    const uid = user.uid
    onUpdate(getDemoHistory())

    const sections: DemoHistorySection[] = [
      'searches',
      'recommendations',
      'activities',
    ]

    sections.forEach(section => {
      const maximum = {
        searches: MAX_SEARCHES,
        recommendations: MAX_RECOMMENDATIONS,
        activities: MAX_ACTIVITIES,
      }[section]

      const historyQuery = query(
        collection(db, 'users', uid, section),
        orderBy('at', 'desc'),
        limit(maximum)
      )

      const unsubscribe = onSnapshot(
        historyQuery,
        snapshot => {
          const items = snapshot.docs.map(snapshotDoc => ({
            ...snapshotDoc.data(),
            id: snapshotDoc.id,
          }))

          const history = getCache(uid)
          ;(history as Record<string, unknown>)[section] = items

          if (currentUid() === uid) {
            onUpdate(getDemoHistory())
            notify()
          }
        },
        error => {
          reportError(error)
          onError?.(error.message)
        }
      )

      listeners.push(unsubscribe)
    })
  })

  return () => {
    stopAuth()
    stopListeners()
  }
}
