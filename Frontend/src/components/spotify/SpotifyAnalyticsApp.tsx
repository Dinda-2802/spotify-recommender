'use client'

import {
  Activity,
  AudioLines,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  Layers3,
  ListMusic,
  Menu,
  Music2,
  PanelLeftClose,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Users,
  X,
  Zap,
  Smile,
  Wind,
  CloudRain,
  UserRound,
  History,
  LogOut,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getDemoSession, logoutDemo, type DemoUser } from '@/lib/demo-auth'
import { recordDemoActivity, recordDemoSearch, recordDemoRecommendation } from '@/lib/demo-history'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AUDIO_FEATURES,
  type EvaluationData,
  type OverviewData,
  type RecommendationResponse,
  type SearchResult,
} from '@/lib/spotify-types'
import {
  BarChart,
  Heatmap,
  Histogram,
  LineChart,
  MoodProfileChart,
  ScatterChart,
  TimingChart,
} from './charts'
import {
  UserProfilePage,
  RecommendationHistoryPage,
  SearchHistoryPage,
  UserActivityPage,
} from './UserWorkspacePages'
import EvaluationDetailQueryModal from './EvaluationDetailQueryModal'

type PageKey =
  | 'dashboard'
  | 'cluster'
  | 'recommendation'
  | 'mood'
  | 'evaluation'
  | 'profile'
  | 'recommendationHistory'
  | 'searchHistory'
  | 'userActivity'

type ClusterSampleResponse = {
  cluster: number
  description: string
  total: number
  songs: SearchResult[]
  source: 'dataset' | 'demo'
}

const ANALYTICS_NAVIGATION = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
  { key: 'cluster' as const, label: 'Cluster Analysis', icon: Layers3 },
  { key: 'recommendation' as const, label: 'Music Recommendation', icon: ListMusic },
  { key: 'mood' as const, label: 'Music Mood Explorer', icon: AudioLines },
  { key: 'evaluation' as const, label: 'Evaluation', icon: Gauge },
]

const USER_NAVIGATION = [
  { key: 'profile' as const, label: 'Profil Pengguna', icon: UserRound },
  { key: 'recommendationHistory' as const, label: 'Riwayat Rekomendasi', icon: History },
  { key: 'searchHistory' as const, label: 'Riwayat Pencarian', icon: Search },
  { key: 'userActivity' as const, label: 'Aktivitas Pengguna', icon: Activity },
]

const PAGE_META: Record<PageKey, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Workspace overview',
    title: 'Ritmelika Dashboard',
    description:
      'Ringkasan katalog, distribusi fitur audio, dan hasil clustering dalam satu workspace.',
  },
  cluster: {
    eyebrow: 'K-Means intelligence',
    title: 'Cluster Analysis',
    description:
      'Pahami komposisi setiap cluster dan karakter audio yang membedakannya.',
  },
  recommendation: {
    eyebrow: 'Similarity engine',
    title: 'Music Recommendation',
    description:
      'Cari lagu dan temukan rekomendasi berdasarkan kemiripan sembilan fitur audio.',
  },
  mood: {
    eyebrow: 'Audio mood intelligence',
    title: 'Music Mood Explorer',
    description:
      'Jelajahi lagu berdasarkan karakter Happy, Calm, Energetic, dan Sad dari profil fitur audio.',
  },
  evaluation: {
    eyebrow: 'System quality',
    title: 'Model Evaluation',
    description:
      'Tinjau kualitas cluster, waktu pencarian, dan hasil pengujian sistem.',
  },
  profile: {
    eyebrow: 'User workspace',
    title: 'Profil Pengguna',
    description: 'Identitas pengguna dan informasi akun yang akan terhubung ke Firebase.',
  },
  recommendationHistory: {
    eyebrow: 'User workspace',
    title: 'Riwayat Rekomendasi',
    description: 'Rekomendasi yang pernah dihasilkan untuk pengguna setelah login.',
  },
  searchHistory: {
    eyebrow: 'User workspace',
    title: 'Riwayat Pencarian',
    description: 'Daftar pencarian lagu yang akan disimpan di Firestore.',
  },
  userActivity: {
    eyebrow: 'User workspace',
    title: 'Aktivitas Pengguna',
    description: 'Ringkasan aktivitas pengguna selama menggunakan aplikasi.',
  },
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value)
}

function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-zinc-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function StatusBadge({ overview }: { overview: OverviewData }) {
  const dataset = overview.source === 'dataset'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
        dataset
          ? 'border-[#CBD9FF] bg-[#E8F0FF] text-[#344FA1]'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          dataset ? 'bg-[#5278E8]' : 'bg-amber-500',
        )}
      />
      {overview.sourceLabel}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <div className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-white"
            key={index}
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-zinc-200 bg-white" />
    </div>
  )
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <CircleHelp size={20} />
      </div>
      <h2 className="mt-4 text-base font-semibold text-zinc-900">Data gagal dimuat</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
      <button
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#5278E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#344FA1]"
        onClick={retry}
        type="button"
      >
        <RefreshCw size={15} />
        Coba lagi
      </button>
    </Card>
  )
}

function PageIntro({
  page,
  overview,
}: {
  page: PageKey
  overview: OverviewData
}) {
  const meta = PAGE_META[page]
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5278E8]">
          {meta.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-zinc-950 sm:text-[30px]">
          {meta.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {meta.description}
        </p>
      </div>
      <StatusBadge overview={overview} />
    </div>
  )
}

function DemoNotice({ overview }: { overview: OverviewData }) {
  if (!overview.warning) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <Database className="mt-0.5 shrink-0 text-amber-700" size={17} />
      <div>
        <p className="font-semibold">Preview mode aktif</p>
        <p className="mt-0.5 text-xs leading-5 text-amber-800">{overview.warning}</p>
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#5278E8]">
          {icon}
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Live
        </span>
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-zinc-950">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </Card>
  )
}

function DashboardPage({ overview }: { overview: OverviewData }) {
  const evaluationSummary = overview.evaluation.available ? 'Available' : 'Not available'
  return (
    <div className="space-y-6">
      <PageIntro overview={overview} page="dashboard" />
      <DemoNotice overview={overview} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          hint="Lagu berhasil dianalisis"
          icon={<Music2 size={18} />}
          label="Total songs"
          value={formatNumber(overview.kpis.songs)}
        />
        <KpiCard
          hint="Nama artis unik"
          icon={<Users size={18} />}
          label="Unique artists"
          value={formatNumber(overview.kpis.artists)}
        />
        <KpiCard
          hint="Hasil K-Means aktif"
          icon={<Layers3 size={18} />}
          label="Total clusters"
          value={String(overview.kpis.clusters)}
        />
        <KpiCard
          hint="Pilihan per permintaan"
          icon={<ListMusic size={18} />}
          label="Recommendations"
          value="5–20"
        />
        <KpiCard
          hint="File hasil evaluasi"
          icon={<CheckCircle2 size={18} />}
          label="Evaluation"
          value={evaluationSummary}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            description="Jumlah lagu berdasarkan dekade rilis dari tracks_clean.csv"
            title="Release timeline"
          />
          <div className="p-5">
            <BarChart
              data={overview.decades}
              labelKey="decade"
              valueKey="count"
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            description="Proporsi katalog pada setiap cluster"
            title="Cluster distribution"
          />
          <div className="space-y-4 p-5">
            {overview.clusterCounts.map((cluster, index) => (
              <div key={cluster.cluster}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700">
                    Cluster {cluster.cluster}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {formatNumber(cluster.count)} · {cluster.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      index % 2 ? 'bg-[#A78BFA]' : 'bg-[#5278E8]',
                    )}
                    style={{ width: `${cluster.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ['energy', 'Energy', 'Intensitas dan aktivitas audio'],
            ['danceability', 'Danceability', 'Kesesuaian ritme untuk menari'],
            ['valence', 'Valence', 'Nuansa positif pada lagu'],
          ] as const
        ).map(([feature, title, description]) => (
          <Card key={feature}>
            <CardHeader description={description} title={title} />
            <div className="p-4">
              <Histogram data={overview.histograms[feature]} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            description="Karakter audio dominan dari nilai fitur terstandarisasi"
            title="Clustering summary"
          />
          <div className="divide-y divide-zinc-100">
            {overview.clusterProfiles.map((profile) => (
              <div
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={profile.cluster}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#344FA1] text-xs font-bold text-white">
                    {profile.cluster}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Cluster {profile.cluster}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-zinc-500">
                      {profile.description}
                    </p>
                  </div>
                </div>
                <span className="text-xs tabular-nums text-zinc-500">
                  {formatNumber(
                    overview.clusterCounts.find(
                      (item) => item.cluster === profile.cluster,
                    )?.count || 0,
                  )}{' '}
                  lagu
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader
            description="Sumber yang dipakai oleh dashboard"
            title="Dataset information"
          />
          <dl className="divide-y divide-zinc-100 px-5">
            {[
              ['Sumber data', overview.sourceLabel],
              ['Spark part files', String(overview.dataset.clusterFiles)],
              ['Audio features', String(overview.dataset.features)],
              [
                'Release years',
                overview.kpis.yearMin && overview.kpis.yearMax
                  ? `${overview.kpis.yearMin}–${overview.kpis.yearMax}`
                  : 'Tidak tersedia',
              ],
              [
                'Evaluation files',
                overview.dataset.evaluationAvailable ? 'Tersedia' : 'Belum tersedia',
              ],
            ].map(([term, detail]) => (
              <div className="flex justify-between gap-4 py-3.5 text-xs" key={term}>
                <dt className="text-zinc-500">{term}</dt>
                <dd className="text-right font-semibold text-zinc-800">{detail}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}

function ClusterPage({ overview }: { overview: OverviewData }) {
  const [cluster, setCluster] = useState(overview.clusterProfiles[0]?.cluster ?? 0)
  const [seed, setSeed] = useState(Date.now())
  const [samples, setSamples] = useState<ClusterSampleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/spotify/cluster?cluster=${cluster}&seed=${seed}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Gagal memuat sampel cluster')
        return body as ClusterSampleResponse
      })
      .then(setSamples)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [cluster, seed])

  return (
    <div className="space-y-6">
      <PageIntro overview={overview} page="cluster" />
      <DemoNotice overview={overview} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            description="Danceability dan energy, diwarnai berdasarkan cluster"
            title="Cluster scatter"
          />
          <div className="p-5">
            <ScatterChart points={overview.scatter} />
            <div className="mt-3 flex flex-wrap gap-3 border-t border-zinc-100 pt-4">
              {overview.clusterCounts.map((item, index) => (
                <span
                  className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600"
                  key={item.cluster}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: ['#5278E8', '#A78BFA', '#75C9E7', '#7C6AE8', '#8CB6F5'][
                        index % 5
                      ],
                    }}
                  />
                  Cluster {item.cluster}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader
            description="Jumlah anggota aktual setiap cluster"
            title="Songs per cluster"
          />
          <div className="p-5">
            <BarChart
              data={overview.clusterCounts.map((item) => ({
                label: `Cluster ${item.cluster}`,
                value: item.count,
              }))}
              horizontal
              labelKey="label"
              valueKey="value"
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          description="Biru menunjukkan nilai di bawah rata-rata; hijau menunjukkan nilai di atas rata-rata"
          title="Standardized audio profile"
        />
        <div className="p-5">
          <Heatmap features={AUDIO_FEATURES} profiles={overview.clusterProfiles} />
        </div>
      </Card>

      <Card>
        <CardHeader
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Pilih cluster"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-[#5278E8] focus:ring-2 focus:ring-[#DCE6FF]"
                onChange={(event) => setCluster(Number(event.target.value))}
                value={cluster}
              >
                {overview.clusterCounts.map((item) => (
                  <option key={item.cluster} value={item.cluster}>
                    Cluster {item.cluster}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                onClick={() => setSeed(Date.now())}
                type="button"
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
                Acak ulang
              </button>
            </div>
          }
          description="Maksimal 30 lagu dari cluster yang dipilih"
          title="Cluster samples"
        />
        <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Karakteristik:{' '}
            <span className="font-semibold capitalize text-zinc-800">
              {samples?.description || 'Memuat profil...'}
            </span>
          </p>
          {samples && (
            <span className="text-xs font-medium text-zinc-500">
              {formatNumber(samples.total)} lagu dalam cluster
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {error ? (
            <p className="p-5 text-sm text-red-600">{error}</p>
          ) : (
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-white text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  <th className="w-16 px-5 py-3">#</th>
                  <th className="px-5 py-3">Judul lagu</th>
                  <th className="px-5 py-3">Artis</th>
                  <th className="w-28 px-5 py-3">Cluster</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(samples?.songs || []).map((song, index) => (
                  <tr className="text-sm transition hover:bg-zinc-50" key={song.index}>
                    <td className="px-5 py-3.5 tabular-nums text-zinc-400">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-zinc-900">{song.name}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{song.artists}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-[#E8F0FF] px-2 py-1 text-xs font-bold text-[#344FA1]">
                        C{song.cluster}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

function RecommendationPage({ overview }: { overview: OverviewData }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [amount, setAmount] = useState(10)
  const [mode, setMode] = useState<'cluster' | 'all'>('cluster')
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(
    null,
  )
  const [searching, setSearching] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [error, setError] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const searchBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((body) => setResults(body.results || []))
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') setError(requestError.message)
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const runRecommendation = async () => {
    if (!selected) return
    setRecommending(true)
    setError('')
    setHistoryWarning('')
    try {
      const response = await fetch('/api/spotify/recommend', {
        body: JSON.stringify({ index: selected.index, amount, mode }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Rekomendasi gagal')
      setRecommendation(body)
      if (!recordDemoRecommendation({ seed: selected, mode, requested: amount, results: body.results })) {
        setHistoryWarning('Rekomendasi berhasil, tetapi riwayat gagal disimpan. Periksa penyimpanan browser atau sesi login demo.')
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Rekomendasi gagal dihitung',
      )
    } finally {
      setRecommending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro overview={overview} page="recommendation" />
      <DemoNotice overview={overview} />
      {historyWarning && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{historyWarning}</p>}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative" >
          <CardHeader
            description="Cari berdasarkan judul lagu atau nama artis, minimal dua karakter"
            title="Select a seed track"
          />
          <div className="p-5" ref={searchBoxRef}>
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                size={17}
              />
              <input
                className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-10 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#5278E8] focus:ring-4 focus:ring-[#E8F0FF]"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(null)
                  setRecommendation(null)
                }}
                placeholder="Contoh: nama lagu atau artis"
                value={query}
              />
              {searching && (
                <RefreshCw
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-zinc-400"
                  size={15}
                />
              )}
            </label>
            {query.trim().length > 0 && query.trim().length < 2 && (
              <p className="mt-2 text-xs text-amber-700">
                Ketik minimal dua karakter untuk memulai pencarian.
              </p>
            )}
            {results.length > 0 && !selected && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                {results.map((song) => (
                  <button
                    className="flex w-full items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3 text-left last:border-0 hover:bg-zinc-50"
                    key={song.index}
                    onClick={() => {
                      const saved = recordDemoSearch(query, song)
                      setHistoryWarning(saved ? '' : 'Pilihan lagu berhasil, tetapi riwayat pencarian gagal disimpan di browser.')
                      setSelected(song)
                      setQuery(song.name)
                      setResults([])
                    }}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        {song.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {song.artists}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600">
                      C{song.cluster}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && !searching && !results.length && !selected && (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-xs text-zinc-500">
                Tidak ada lagu yang cocok. Coba kata kunci lain.
              </div>
            )}
            {selected && (
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-[#D8CCFA] bg-[#F0EAFF] p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#5278E8] text-white">
                  <Music2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-900">{selected.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-600">{selected.artists}</p>
                </div>
                <span className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-[#5E46A6] shadow-sm">
                  Cluster {selected.cluster}
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            description="Atur jumlah hasil dan ruang pencarian"
            title="Search settings"
          />
          <div className="space-y-5 p-5">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">Jumlah rekomendasi</span>
              <select
                className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#5278E8]"
                onChange={(event) => setAmount(Number(event.target.value))}
                value={amount}
              >
                {[5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    {value} lagu
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="text-xs font-semibold text-zinc-700">Mode pencarian</legend>
              <div className="mt-2 grid gap-2">
                {[
                  {
                    value: 'cluster' as const,
                    title: 'Filter cluster',
                    detail: 'Lebih cepat, cluster yang sama',
                  },
                  {
                    value: 'all' as const,
                    title: 'Semua lagu',
                    detail: 'Cakupan seluruh katalog',
                  },
                ].map((option) => (
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                      mode === option.value
                        ? 'border-[#BFCFFF] bg-[#E8F0FF]'
                        : 'border-zinc-200 hover:bg-zinc-50',
                    )}
                    key={option.value}
                  >
                    <input
                      checked={mode === option.value}
                      className="mt-0.5 accent-[#5278E8]"
                      name="mode"
                      onChange={() => setMode(option.value)}
                      type="radio"
                    />
                    <span>
                      <span className="block text-xs font-bold text-zinc-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-zinc-500">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5278E8] px-4 text-sm font-bold text-white transition hover:bg-[#344FA1] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
              disabled={!selected || recommending}
              onClick={runRecommendation}
              type="button"
            >
              {recommending ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {recommending ? 'Menghitung kemiripan...' : 'Cari Rekomendasi'}
            </button>
          </div>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {recommendation ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Mode aktif',
                value: recommendation.mode === 'cluster' ? 'Filter cluster' : 'Semua lagu',
              },
              {
                label: 'Cluster search',
                value: `${recommendation.timing.clusterMs.toFixed(2)} ms`,
              },
              {
                label: 'All songs search',
                value: `${recommendation.timing.allMs.toFixed(2)} ms`,
              },
              {
                label: 'Top result overlap',
                value: `${recommendation.timing.overlap}/${amount}`,
              },
            ].map((item) => (
              <Card className="px-5 py-4" key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-zinc-900">
                  {item.value}
                </p>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader
              action={
                <span className="rounded-full bg-[#F0EAFF] px-3 py-1 text-xs font-bold text-[#6848B8]">
                  {recommendation.results.length} hasil
                </span>
              }
              description={`Dihitung dari ${recommendation.selected.name} · ${recommendation.selected.artists}`}
              title="Recommendation results"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    <th className="w-20 px-5 py-3">Rank</th>
                    <th className="px-5 py-3">Judul lagu</th>
                    <th className="px-5 py-3">Artis</th>
                    <th className="w-24 px-5 py-3">Cluster</th>
                    <th className="w-64 px-5 py-3">Cosine similarity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recommendation.results.map((song) => {
                    const score = Math.max(0, Math.min(1, (song.similarity + 1) / 2))
                    return (
                      <tr className="text-sm transition hover:bg-zinc-50" key={song.index}>
                        <td className="px-5 py-4">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#344FA1] text-xs font-bold text-white">
                            {song.rank}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-zinc-900">{song.name}</td>
                        <td className="px-5 py-4 text-zinc-500">{song.artists}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-[#E8F0FF] px-2 py-1 text-xs font-bold text-[#344FA1]">
                            C{song.cluster}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-[#5278E8]"
                                style={{ width: `${score * 100}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-bold tabular-nums text-zinc-700">
                              {song.similarity.toFixed(3)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <ListMusic size={21} />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-zinc-900">
            Belum ada rekomendasi
          </h2>
          <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
            Cari dan pilih satu lagu, tentukan mode pencarian, lalu jalankan proses
            rekomendasi.
          </p>
        </Card>
      )}
    </div>
  )
}

const MOOD_STYLE = {
  Happy: {
    color: '#A78BFA',
    soft: '#F0EAFF',
    icon: Smile,
    label: 'Bright & uplifting',
  },
  Calm: {
    color: '#75C9E7',
    soft: '#E8F7FC',
    icon: Wind,
    label: 'Soft & reflective',
  },
  Energetic: {
    color: '#5278E8',
    soft: '#E8F0FF',
    icon: Zap,
    label: 'Active & powerful',
  },
  Sad: {
    color: '#7C6AE8',
    soft: '#EEEAFE',
    icon: CloudRain,
    label: 'Low-valence & mellow',
  },
} as const

function MoodExplorerPage({ overview }: { overview: OverviewData }) {
  const [selectedMood, setSelectedMood] = useState(
    overview.moods[0]?.mood || 'Happy',
  )
  const [showGuide, setShowGuide] = useState(false)
  const selected =
    overview.moods.find((mood) => mood.mood === selectedMood) ||
    overview.moods[0]
  if (!selected) return null

  const style = MOOD_STYLE[selected.mood]
  const SelectedIcon = style.icon
  const featureRows = [
    ['acousticness', 'Acousticness'],
    ['danceability', 'Danceability'],
    ['valence', 'Valence'],
    ['energy', 'Energy'],
    ['instrumentalness', 'Instrumentalness'],
    ['liveness', 'Liveness'],
    ['speechiness', 'Speechiness'],
  ] as const
  const profileData = featureRows.map(([feature, label]) => ({
    label,
    mood: selected.values[feature],
    catalog: overview.catalogProfile[feature],
  }))

  return (
    <div className="space-y-6">
      <PageIntro overview={overview} page="mood" />
      <DemoNotice overview={overview} />

      <section className="overflow-hidden rounded-2xl border border-[#26285B] bg-[#111233] shadow-[0_18px_50px_rgba(32,42,68,0.14)]">
        <div className="flex flex-col gap-4 border-b border-[#282A5B] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2C66] text-[#B9A8FB]">
              <AudioLines size={19} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Mood analytics studio</p>
              <p className="mt-0.5 text-xs text-[#929CC8]">
                Profil fitur aktual untuk setiap kelompok mood
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Pilih mood</span>
              <select
                className="h-10 min-w-40 appearance-none rounded-lg border border-[#5041A8] bg-[#29205D] pl-10 pr-9 text-xs font-bold text-white outline-none focus:border-[#A78BFA]"
                onChange={(event) =>
                  setSelectedMood(
                    event.target.value as (typeof overview.moods)[number]['mood'],
                  )
                }
                value={selectedMood}
              >
                {overview.moods.map((mood) => (
                  <option key={mood.mood} value={mood.mood}>
                    {mood.mood}
                  </option>
                ))}
              </select>
              <SelectedIcon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B9A8FB]"
                size={15}
              />
              <ChevronRight
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#929CC8]"
                size={14}
              />
            </label>
            <button
              className="h-10 rounded-lg bg-[#6E3DE0] px-4 text-xs font-bold text-white transition hover:bg-[#8155E8]"
              onClick={() => setShowGuide((current) => !current)}
              type="button"
            >
              {showGuide ? 'Tutup panduan' : 'How it works'}
            </button>
          </div>
        </div>

        {showGuide && (
          <div className="grid gap-3 border-b border-[#282A5B] bg-[#171842] px-5 py-4 text-xs leading-5 text-[#C2C8E8] md:grid-cols-4">
            {[
              ['Happy', 'Valence dan danceability memberi bobot terbesar.'],
              ['Calm', 'Energi rendah, acousticness, dan tempo tenang.'],
              ['Energetic', 'Energy, danceability, tempo, dan liveness tinggi.'],
              ['Sad', 'Valence rendah dengan energi dan danceability lebih lembut.'],
            ].map(([mood, explanation]) => (
              <div className="rounded-lg border border-[#303269] bg-[#1E2050] p-3" key={mood}>
                <p className="font-bold text-white">{mood}</p>
                <p className="mt-1 text-[#9EA8D2]">{explanation}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 p-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            {featureRows.map(([feature, label]) => {
              const value = Math.max(0, Math.min(1, selected.values[feature]))
              return (
                <div
                  className="rounded-xl border border-[#292B60] bg-[#1C1D4A] px-4 py-3.5"
                  key={feature}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{label}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-[#B6BFE2]">
                      {value.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#303366]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        background: `linear-gradient(90deg, ${style.color}, #75C9E7)`,
                        width: `${value * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] font-medium text-[#717BA8]">
                    <span>0</span>
                    <span>1</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Songs', formatNumber(selected.count)],
                ['Avg. tempo', `${selected.averageTempo.toFixed(1)} BPM`],
                ['Avg. loudness', `${selected.averageLoudness.toFixed(1)} dB`],
                ['Dominant cluster', `Cluster ${selected.dominantCluster}`],
              ].map(([label, value]) => (
                <div
                  className="rounded-xl border border-[#292B60] bg-[#1C1D4A] px-4 py-4 text-center"
                  key={label}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8993C0]">
                    {label}
                  </p>
                  <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#292B60] bg-[#1C1D4A]">
              <div className="flex flex-col gap-3 border-b border-[#292B60] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {selected.mood} feature profile
                  </h2>
                  <p className="mt-1 text-xs text-[#8F99C4]">
                    Dibandingkan dengan rata-rata seluruh katalog
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-semibold text-[#B4BCDE]">
                  <span className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-[#A78BFA]" />
                    Selected mood
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t-2 border-dashed border-[#75C9E7]" />
                    Catalog
                  </span>
                </div>
              </div>
              <div className="p-3">
                <MoodProfileChart data={profileData} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.moods.map((mood) => {
          const moodStyle = MOOD_STYLE[mood.mood]
          const Icon = moodStyle.icon
          const active = mood.mood === selected.mood
          return (
            <button
              className={cn(
                'rounded-xl border bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.025)] transition',
                active
                  ? 'border-[#A78BFA] ring-2 ring-[#F0EAFF]'
                  : 'border-zinc-200 hover:border-[#CBD2F4]',
              )}
              key={mood.mood}
              onClick={() => setSelectedMood(mood.mood)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: moodStyle.soft, color: moodStyle.color }}
                >
                  <Icon size={18} />
                </span>
                <span className="text-xs font-bold tabular-nums text-zinc-500">
                  {mood.percentage.toFixed(1)}%
                </span>
              </div>
              <p className="mt-4 text-base font-bold text-zinc-900">{mood.mood}</p>
              <p className="mt-1 text-xs text-zinc-500">{moodStyle.label}</p>
              <p className="mt-3 text-xl font-bold tracking-[-0.03em] text-[#344FA1]">
                {formatNumber(mood.count)}
              </p>
              <p className="text-[11px] text-zinc-400">lagu terkelompok</p>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader
          action={
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: style.soft, color: style.color }}
            >
              {selected.mood}
            </span>
          }
          description={selected.description}
          title={`Songs in ${selected.mood} mood`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                <th className="w-16 px-5 py-3">#</th>
                <th className="px-5 py-3">Judul lagu</th>
                <th className="px-5 py-3">Artis</th>
                <th className="w-28 px-5 py-3">Cluster</th>
                <th className="w-28 px-5 py-3">Mood</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {selected.songs.map((song, index) => (
                <tr className="text-sm transition hover:bg-[#F8F9FE]" key={song.index}>
                  <td className="px-5 py-3.5 tabular-nums text-zinc-400">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{song.name}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{song.artists}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-[#E8F0FF] px-2 py-1 text-xs font-bold text-[#344FA1]">
                      C{song.cluster}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="rounded-md px-2 py-1 text-xs font-bold"
                      style={{ background: style.soft, color: style.color }}
                    >
                      {selected.mood}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function EvaluationPage({
  overview,
  setOverview,
}: {
  overview: OverviewData
  setOverview: (data: OverviewData) => void
}) {
  const [evaluation, setEvaluation] = useState<EvaluationData>(overview.evaluation)
  const [refreshing, setRefreshing] = useState(false)
  const [detailRows, setDetailRows] = useState<Array<Record<string, string>> | null>(null)
  const [error, setError] = useState('')

  const refresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [evaluationResponse, overviewResponse] = await Promise.all([
        fetch('/api/spotify/evaluation?refresh=1'),
        fetch('/api/spotify/overview?refresh=1'),
      ])
      const evaluationBody = await evaluationResponse.json()
      const overviewBody = await overviewResponse.json()
      if (!evaluationResponse.ok || !overviewResponse.ok) {
        throw new Error(evaluationBody.error || overviewBody.error || 'Gagal memuat ulang')
      }
      setEvaluation(evaluationBody)
      setOverview(overviewBody)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal memuat ulang')
    } finally {
      setRefreshing(false)
    }
  }

  const loadDetail = async () => {
    setError('')
    try {
      const response = await fetch('/api/spotify/evaluation-detail', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Detail query gagal dimuat')
      if (!Array.isArray(body.rows)) throw new Error('Respons tabel query tidak valid')
      setDetailRows(body.rows)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Detail query gagal dimuat',
      )
    }
  }

  const highlightMetrics = [
    'waktu_rata2_semua_ms',
    'waktu_rata2_cluster_ms',
    'percepatan_kali',
    'recall_top10_persen',
  ].map((key) => evaluation.metrics.find((metric) => metric.metric === key))

  return (
    <div className="space-y-6">
      <PageIntro overview={overview} page="evaluation" />
      <DemoNotice overview={overview} />
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#5278E8]">
            <FileSearch size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Evaluation workspace</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {evaluation.available
                ? 'Metrik dibaca dari file CSV hasil evaluasi.'
                : evaluation.message}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={loadDetail}
            type="button"
          >
            <TableProperties size={14} />
            Lihat Tabel Query
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#5278E8] px-3 text-xs font-semibold text-white hover:bg-[#344FA1]"
            onClick={refresh}
            type="button"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} size={14} />
            Muat Ulang Hasil
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {highlightMetrics.map((metric, index) => (
          <Card className="p-5" key={index}>
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                {index < 2 ? <Clock3 size={16} /> : <Activity size={16} />}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-bold uppercase',
                  metric
                    ? 'bg-[#E8F0FF] text-[#344FA1]'
                    : 'bg-zinc-100 text-zinc-500',
                )}
              >
                {metric ? 'Available' : 'No data'}
              </span>
            </div>
            <p className="mt-4 break-words text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
              {metric?.metric || [
                'waktu_rata2_semua_ms',
                'waktu_rata2_cluster_ms',
                'percepatan_kali',
                'recall_top10_persen',
              ][index]}
            </p>
            <p className="mt-2 text-xl font-bold tracking-[-0.02em] text-zinc-900">
              {metric?.value ?? '—'}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            description="Semakin tinggi, semakin baik"
            title="Silhouette Score"
          />
          <div className="p-5">
            <LineChart
              data={evaluation.points}
              field="silhouette"
              selectedK={evaluation.selectedK}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            description="Semakin rendah, semakin baik"
            title="Davies-Bouldin Index"
          />
          <div className="p-5">
            <LineChart
              color="#A78BFA"
              data={evaluation.points}
              field="daviesBouldin"
              selectedK={evaluation.selectedK}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          description="Waktu rata-rata pencarian semua lagu dan satu cluster"
          title="Search time comparison"
        />
        <div className="mx-auto max-w-3xl p-5">
          <TimingChart
            allMs={evaluation.timing.allMs}
            clusterMs={evaluation.timing.clusterMs}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="Nilai aktual dan keterangan dari ringkasan_evaluasi.csv"
          title="Evaluation summary"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                <th className="px-5 py-3">Metrik</th>
                <th className="w-40 px-5 py-3">Nilai</th>
                <th className="px-5 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {evaluation.metrics.length ? (
                evaluation.metrics.map((metric) => (
                  <tr className="text-sm hover:bg-zinc-50" key={metric.metric}>
                    <td className="px-5 py-4 font-semibold text-zinc-900">
                      {metric.metric}
                    </td>
                    <td className="px-5 py-4 font-bold tabular-nums text-[#5278E8]">
                      {metric.value}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">{metric.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-zinc-500" colSpan={3}>
                    Ringkasan evaluasi belum tersedia. Tidak ada nilai yang dibuat secara
                    otomatis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {detailRows && <EvaluationDetailQueryModal close={() => setDetailRows(null)} rows={detailRows} />}
    </div>
  )
}

function Sidebar({
  activePage,
  mobileOpen,
  setActivePage,
  closeMobile,
  onLogout,
  displayName,
}: {
  activePage: PageKey
  mobileOpen: boolean
  setActivePage: (page: PageKey) => void
  closeMobile: () => void
  onLogout: () => void
  displayName: string
}) {
  const content = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-[#35405F] px-5">
        <button
          className="flex items-center gap-3"
          onClick={() => setActivePage('dashboard')}
          type="button"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            <Image
              alt="Music Analytics logo"
              className="h-full w-full object-cover"
              height={44}
              priority
              src="/music-analytics-logo.jpeg"
              width={44}
            />
          </span>
          <span className="text-left">
            <span className="block text-sm font-bold tracking-[-0.02em] text-white">
              Ritmelika
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Big Data Spark
            </span>
          </span>
        </button>
        <button
          aria-label="Tutup navigasi"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B7C3EA] hover:bg-[#2A3556] lg:hidden"
          onClick={closeMobile}
          type="button"
        >
          <X size={17} />
        </button>
      </div>
      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        {[
          { title: 'ANALYTICS', items: ANALYTICS_NAVIGATION },
          { title: 'USER MANAGEMENT', items: USER_NAVIGATION },
        ].map((group, groupIndex) => (
          <div className={groupIndex ? 'mt-6' : ''} key={group.title}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8DA0CB]">
              {group.title}
            </p>
            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = activePage === item.key
                return (
                  <button
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition',
                      active
                        ? 'bg-[#344FA1] text-white'
                        : 'text-[#B7C3EA] hover:bg-[#2A3556] hover:text-white',
                    )}
                    key={item.key}
                    onClick={() => {
                      setActivePage(item.key)
                      closeMobile()
                    }}
                    type="button"
                  >
                    <Icon
                      className={active ? 'text-[#C4B5FD]' : 'text-[#90A1CB] group-hover:text-white'}
                      size={17}
                    />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="text-white/70" size={14} />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[#35405F] p-4">
        <div className="mb-3 truncate px-2 text-xs font-semibold text-[#B7C3EA]" title={displayName}>
          Akun pratinjau: {displayName || 'Pengguna'}
        </div>
        <button
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5278E8] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#6588EE]"
          onClick={onLogout}
          type="button"
        >
          <LogOut size={16} /> Logout
        </button>
        <div className="rounded-lg border border-[#435078] bg-[#293556] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <SlidersHorizontal className="text-[#A78BFA]" size={14} />
            Recommendation engine
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">
            Z-score · Vector normalization · Cosine similarity
          </p>
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-[#202A44] lg:flex">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Tutup navigasi"
            className="absolute inset-0 bg-black/45"
            onClick={closeMobile}
            type="button"
          />
          <aside className="relative flex h-full w-[min(86vw,280px)] flex-col bg-[#202A44] shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}

export default function SpotifyAnalyticsApp({
  initialOverview,
}: {
  initialOverview: OverviewData
}) {
  const router = useRouter()
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [overview, setOverview] = useState<OverviewData | null>(initialOverview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const logout = () => {
    recordDemoActivity('logout', 'Keluar akun', 'Pengguna keluar dari akun pratinjau.')
    logoutDemo()
    router.replace('/login')
  }
  useEffect(() => {
    setCurrentUser(getDemoSession())
  }, [activePage])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/spotify/overview')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Ringkasan dataset gagal dimuat')
      setOverview(body)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ringkasan dataset gagal dimuat',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    window.scrollTo({ behavior: 'smooth', top: 0 })
  }, [activePage])

  const content = useMemo(() => {
    if (!overview) return null
    switch (activePage) {
      case 'cluster':
        return <ClusterPage overview={overview} />
      case 'recommendation':
        return <RecommendationPage overview={overview} />
      case 'mood':
        return <MoodExplorerPage overview={overview} />
      case 'evaluation':
        return <EvaluationPage overview={overview} setOverview={setOverview} />
      case 'profile':
        return <UserProfilePage />
      case 'recommendationHistory':
        return <RecommendationHistoryPage onOpenRecommendation={() => setActivePage('recommendation')} />
      case 'searchHistory':
        return <SearchHistoryPage onOpenRecommendation={() => setActivePage('recommendation')} />
      case 'userActivity':
        return <UserActivityPage onOpenRecommendation={() => setActivePage('recommendation')} />
      default:
        return <DashboardPage overview={overview} />
    }
  }, [activePage, overview])

  return (
    <div className="min-h-dvh bg-[#F6F7FC] text-zinc-950">
      <Sidebar
        activePage={activePage}
        closeMobile={() => setMobileOpen(false)}
        mobileOpen={mobileOpen}
        setActivePage={setActivePage}
        onLogout={logout}
        displayName={currentUser?.displayName || ''}
      />
      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Buka navigasi"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
                type="button"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {PAGE_META[activePage].title}
                </p>
                <p className="hidden truncate text-xs text-zinc-500 sm:block">
                  Ritmelika Recommender · Analytics workspace
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#CBD9FF] bg-[#E8F0FF] px-3 text-xs font-bold text-[#344FA1] transition hover:bg-[#D9E6FF]"
                onClick={() => setActivePage('profile')}
                type="button"
              >
                <UserRound size={14} /> <span className="hidden sm:inline">{currentUser?.displayName || 'Profil'}</span>
              </button>
              <div className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 sm:flex">
                <Database size={14} />
                {overview?.source === 'dataset' ? 'Live dataset' : 'Demo preview'}
              </div>
              <button
                aria-label="Muat ulang data"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50"
                onClick={loadOverview}
                type="button"
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} size={15} />
              </button>
            </div>
          </div>
        </header>
        <main
          className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8"
          ref={contentRef}
        >
          {loading && !overview ? (
            <LoadingState />
          ) : error && !overview ? (
            <ErrorState message={error} retry={loadOverview} />
          ) : (
            content
          )}
        </main>
      </div>
    </div>
  )
}
