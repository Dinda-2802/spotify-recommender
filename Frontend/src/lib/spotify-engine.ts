import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { parse } from 'csv-parse/sync'
import {
  AUDIO_FEATURES,
  type AudioFeature,
  type DataSource,
  type EvaluationData,
  type EvaluationMetric,
  type MoodName,
  type OverviewData,
  type Recommendation,
  type RecommendationResponse,
  type SearchResult,
  type Song,
} from './spotify-types'

const DATA_DIR = path.resolve(process.cwd(), '..', 'spotify-recommender')

const CLUSTER_DIR = path.join(
  DATA_DIR,
  'hasil_clustering',
  'lagu_dengan_cluster',
)

const CLEAN_FILE = path.join(DATA_DIR, 'data_clean', 'tracks_clean.csv')

const EVALUATION_DIR = path.join(DATA_DIR, 'hasil_evaluasi')

type CsvRow = Record<string, string>

function readCsv(filePath: string): CsvRow[] {
  return parse(fs.readFileSync(filePath, 'utf8'), {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value))
}

function cleanArtists(value: string) {
  const trimmed = String(value || '(tanpa artis)').trim()
  if (!trimmed.startsWith('[')) return trimmed
  return trimmed
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .join(', ')
}

function numberFrom(row: CsvRow, key: AudioFeature) {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : null
}

function createDemoSongs(): Song[] {
  const profiles = [
    {
      danceability: 0.82,
      energy: 0.78,
      loudness: -5.4,
      speechiness: 0.07,
      acousticness: 0.12,
      instrumentalness: 0.03,
      liveness: 0.16,
      valence: 0.72,
      tempo: 124,
    },
    {
      danceability: 0.48,
      energy: 0.36,
      loudness: -11.2,
      speechiness: 0.04,
      acousticness: 0.72,
      instrumentalness: 0.22,
      liveness: 0.13,
      valence: 0.38,
      tempo: 92,
    },
    {
      danceability: 0.61,
      energy: 0.88,
      loudness: -4.1,
      speechiness: 0.14,
      acousticness: 0.08,
      instrumentalness: 0.08,
      liveness: 0.31,
      valence: 0.44,
      tempo: 148,
    },
    {
      danceability: 0.7,
      energy: 0.54,
      loudness: -8.2,
      speechiness: 0.2,
      acousticness: 0.31,
      instrumentalness: 0.02,
      liveness: 0.2,
      valence: 0.64,
      tempo: 106,
    },
  ]

  return Array.from({ length: 48 }, (_, index) => {
    const cluster = index % profiles.length
    const profile = profiles[cluster]
    const variation = ((index * 7) % 11 - 5) / 100
    return {
      index,
      name: `Preview Track ${String(index + 1).padStart(2, '0')}`,
      artists: `Demo Artist ${String((index % 12) + 1).padStart(2, '0')}`,
      cluster,
      year: 1980 + ((index * 3) % 45),
      danceability: clamp(profile.danceability + variation),
      energy: clamp(profile.energy - variation / 2),
      loudness: profile.loudness + variation * 12,
      speechiness: clamp(profile.speechiness + variation / 3),
      acousticness: clamp(profile.acousticness - variation),
      instrumentalness: clamp(profile.instrumentalness + variation / 2),
      liveness: clamp(profile.liveness - variation / 3),
      valence: clamp(profile.valence + variation),
      tempo: profile.tempo + variation * 45,
    }
  })
}

function loadSongs(): {
  songs: Song[]
  source: DataSource
  clusterFiles: number
  warning?: string
} {
  try {
    if (!fs.existsSync(CLUSTER_DIR)) throw new Error('Folder clustering tidak ditemukan')
    const files = fs
      .readdirSync(CLUSTER_DIR)
      .filter((name) => /^part-.*\.csv$/i.test(name))
      .sort()
    if (!files.length) throw new Error('File part-*.csv tidak ditemukan')

    const songs: Song[] = []
    for (const file of files) {
      for (const row of readCsv(path.join(CLUSTER_DIR, file))) {
        const cluster = Number(row.cluster)
        const features = Object.fromEntries(
          AUDIO_FEATURES.map((feature) => [feature, numberFrom(row, feature)]),
        ) as Record<AudioFeature, number | null>
        if (
          !Number.isFinite(cluster) ||
          AUDIO_FEATURES.some((feature) => features[feature] === null)
        ) {
          continue
        }
        songs.push({
          index: songs.length,
          name: String(row.name || '(tanpa judul)'),
          artists: cleanArtists(row.artists),
          cluster,
          ...Object.fromEntries(
            AUDIO_FEATURES.map((feature) => [feature, features[feature] as number]),
          ),
        } as Song)
      }
    }
    if (!songs.length) throw new Error('Tidak ada baris lagu valid')
    return { songs, source: 'dataset', clusterFiles: files.length }
  } catch (error) {
    return {
      songs: createDemoSongs(),
      source: 'demo',
      clusterFiles: 0,
      warning:
        error instanceof Error
          ? `${error.message}. Preview memakai data demo berlabel dan akan otomatis beralih ketika dataset asli tersedia.`
          : 'Dataset asli belum tersedia. Preview memakai data demo berlabel.',
    }
  }
}

function loadYears(songs: Song[], source: DataSource) {
  if (source === 'demo') return songs.flatMap((song) => (song.year ? [song.year] : []))
  try {
    if (!fs.existsSync(CLEAN_FILE)) return []
    return readCsv(CLEAN_FILE)
      .map((row) => Number(row.year))
      .filter((year) => Number.isFinite(year) && year > 0)
  } catch {
    return []
  }
}

function metricDescription(metric: string) {
  const descriptions: Record<string, string> = {
    waktu_rata2_semua_ms:
      'Waktu rata-rata ketika setiap query dibandingkan dengan seluruh lagu.',
    waktu_rata2_cluster_ms:
      'Waktu rata-rata ketika query dibandingkan dengan lagu dalam cluster yang sama.',
    percepatan_kali:
      'Rasio peningkatan kecepatan mode cluster terhadap pencarian seluruh lagu.',
    recall_top10_persen:
      'Persentase hasil top-10 pencarian penuh yang ditemukan kembali oleh mode cluster.',
  }
  return descriptions[metric] || 'Metrik yang dihasilkan oleh proses evaluasi.'
}

function classifyMood(song: Song): MoodName {
  if (song.valence < 0.38 && song.energy < 0.58) return 'Sad'
  if (song.energy < 0.48 && song.acousticness > 0.4) return 'Calm'
  if (song.energy > 0.76 && song.tempo > 118) return 'Energetic'
  if (song.valence > 0.62 && song.danceability > 0.5) return 'Happy'

  const tempoScore = clamp((song.tempo - 60) / 140)
  const scores: Record<MoodName, number> = {
    Happy:
      song.valence * 0.48 +
      song.danceability * 0.3 +
      song.energy * 0.14 +
      tempoScore * 0.08,
    Calm:
      (1 - song.energy) * 0.36 +
      song.acousticness * 0.3 +
      (1 - tempoScore) * 0.14 +
      song.instrumentalness * 0.12 +
      (1 - song.liveness) * 0.08,
    Energetic:
      song.energy * 0.44 +
      song.danceability * 0.22 +
      tempoScore * 0.2 +
      song.liveness * 0.09 +
      (1 - song.acousticness) * 0.05,
    Sad:
      (1 - song.valence) * 0.46 +
      (1 - song.energy) * 0.2 +
      song.acousticness * 0.18 +
      (1 - song.danceability) * 0.1 +
      song.instrumentalness * 0.06,
  }
  return (Object.entries(scores) as Array<[MoodName, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0][0]
}

const MOOD_DESCRIPTIONS: Record<MoodName, string> = {
  Happy: 'Valence dan danceability tinggi dengan energi positif.',
  Calm: 'Energi lebih rendah, akustik kuat, dan tempo yang lebih tenang.',
  Energetic: 'Energy, tempo, dan danceability berada di level tinggi.',
  Sad: 'Valence lebih rendah dengan karakter lembut dan reflektif.',
}

export function readEvaluation(selectedK: number): EvaluationData {
  const kFile = path.join(EVALUATION_DIR, 'k_selection.csv')
  const summaryFile = path.join(EVALUATION_DIR, 'ringkasan_evaluasi.csv')
  const detailFile = path.join(EVALUATION_DIR, 'detail_query.csv')
  const available = fs.existsSync(kFile) || fs.existsSync(summaryFile)
  if (!available) {
    return {
      available: false,
      points: [],
      metrics: [],
      selectedK,
      timing: { allMs: null, clusterMs: null },
      detailAvailable: false,
      message:
        'File evaluasi belum tersedia. Jalankan 08_evaluasi.py untuk menampilkan metrik aktual.',
    }
  }

  const points = fs.existsSync(kFile)
    ? readCsv(kFile)
        .map((row) => ({
          k: Number(row.k),
          silhouette: Number(row.silhouette),
          daviesBouldin: Number(row.davies_bouldin),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.k) &&
            Number.isFinite(point.silhouette) &&
            Number.isFinite(point.daviesBouldin),
        )
    : []

  const metrics: EvaluationMetric[] = fs.existsSync(summaryFile)
    ? readCsv(summaryFile).map((row) => ({
        metric: row.metrik,
        value: Number.isFinite(Number(row.nilai)) ? Number(row.nilai) : row.nilai,
        description: row.keterangan || metricDescription(row.metrik),
      }))
    : []
  const valueMap = new Map(metrics.map((metric) => [metric.metric, Number(metric.value)]))

  return {
    available: true,
    points,
    metrics,
    selectedK,
    timing: {
      allMs: Number.isFinite(valueMap.get('waktu_rata2_semua_ms'))
        ? (valueMap.get('waktu_rata2_semua_ms') as number)
        : null,
      clusterMs: Number.isFinite(valueMap.get('waktu_rata2_cluster_ms'))
        ? (valueMap.get('waktu_rata2_cluster_ms') as number)
        : null,
    },
    detailAvailable: fs.existsSync(detailFile),
  }
}

export function readEvaluationDetail() {
  const detailFile = path.join(EVALUATION_DIR, 'detail_query.csv')
  if (!fs.existsSync(detailFile)) return null
  return readCsv(detailFile)
}

class SpotifyEngine {
  songs: Song[]
  source: DataSource
  warning?: string
  clusterFiles: number
  years: number[]
  private standardized: number[][]
  private normalized: number[][]
  private duplicateKeys: string[]
  private clusterIndexes: Map<number, number[]>
  private searchText: string[]
  clusters: number[]

  constructor() {
    const loaded = loadSongs()
    this.songs = loaded.songs
    this.source = loaded.source
    this.warning = loaded.warning
    this.clusterFiles = loaded.clusterFiles
    this.years = loadYears(this.songs, this.source)

    const means = AUDIO_FEATURES.map(
      (feature) =>
        this.songs.reduce((total, song) => total + song[feature], 0) /
        this.songs.length,
    )
    const standardDeviations = AUDIO_FEATURES.map((feature, featureIndex) => {
      const variance =
        this.songs.reduce(
          (total, song) => total + (song[feature] - means[featureIndex]) ** 2,
          0,
        ) / this.songs.length
      return Math.sqrt(variance) || 1
    })

    this.standardized = this.songs.map((song) =>
      AUDIO_FEATURES.map(
        (feature, index) =>
          (song[feature] - means[index]) / standardDeviations[index],
      ),
    )
    this.normalized = this.standardized.map((row) => {
      const norm = Math.sqrt(row.reduce((total, value) => total + value ** 2, 0)) || 1
      return row.map((value) => value / norm)
    })
    this.duplicateKeys = this.songs.map(
      (song) => `${song.name.toLocaleLowerCase()}|${song.artists.toLocaleLowerCase()}`,
    )
    this.searchText = this.songs.map(
      (song) => `${song.name} ${song.artists}`.toLocaleLowerCase(),
    )
    this.clusters = [...new Set(this.songs.map((song) => song.cluster))].sort(
      (a, b) => a - b,
    )
    this.clusterIndexes = new Map(
      this.clusters.map((cluster) => [
        cluster,
        this.songs
          .map((song, index) => (song.cluster === cluster ? index : -1))
          .filter((index) => index >= 0),
      ]),
    )
  }

  private describe(values: number[]) {
    const strongest = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 2)
      .flatMap(({ value, index }) => {
        if (value >= 0.4) return [`${AUDIO_FEATURES[index]} tinggi`]
        if (value <= -0.4) return [`${AUDIO_FEATURES[index]} rendah`]
        return []
      })
    return strongest.length ? strongest.join(' · ') : 'mendekati rata-rata'
  }

  private clusterMeans(cluster: number) {
    const indexes = this.clusterIndexes.get(cluster) || []
    return AUDIO_FEATURES.map(
      (_, featureIndex) =>
        indexes.reduce(
          (total, songIndex) =>
            total + this.standardized[songIndex][featureIndex],
          0,
        ) / Math.max(indexes.length, 1),
    )
  }

  private histogram(feature: 'energy' | 'danceability' | 'valence') {
    const bins = Array.from({ length: 12 }, () => 0)
    for (const song of this.songs) {
      const index = Math.min(11, Math.max(0, Math.floor(song[feature] * 12)))
      bins[index] += 1
    }
    return bins.map((value, index) => ({
      label: `${(index / 12).toFixed(1)}–${((index + 1) / 12).toFixed(1)}`,
      value,
    }))
  }

  overview(): OverviewData {
    const counts = this.clusters.map((cluster) => ({
      cluster,
      count: this.clusterIndexes.get(cluster)?.length || 0,
    }))
    const years = this.years
    const decadeMap = new Map<number, number>()
    years.forEach((year) => {
      const decade = Math.max(1940, Math.floor(year / 10) * 10)
      decadeMap.set(decade, (decadeMap.get(decade) || 0) + 1)
    })
    const evaluation = readEvaluation(this.clusters.length)
    const catalogProfile = Object.fromEntries(
      AUDIO_FEATURES.map((feature) => [
        feature,
        this.songs.reduce((total, song) => total + song[feature], 0) /
          this.songs.length,
      ]),
    ) as Record<AudioFeature, number>
    const moodOrder: MoodName[] = ['Happy', 'Calm', 'Energetic', 'Sad']
    const moodIndexes = new Map<MoodName, number[]>(
      moodOrder.map((mood) => [mood, []]),
    )
    this.songs.forEach((song, index) => {
      moodIndexes.get(classifyMood(song))?.push(index)
    })
    const moods = moodOrder.map((mood) => {
      const indexes = moodIndexes.get(mood) || []
      const values = Object.fromEntries(
        AUDIO_FEATURES.map((feature) => [
          feature,
          indexes.reduce(
            (total, songIndex) => total + this.songs[songIndex][feature],
            0,
          ) / Math.max(indexes.length, 1),
        ]),
      ) as Record<AudioFeature, number>
      const clusterCounts = new Map<number, number>()
      indexes.forEach((songIndex) => {
        const cluster = this.songs[songIndex].cluster
        clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1)
      })
      const dominantCluster =
        [...clusterCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        this.clusters[0]
      const sampleStep = Math.max(1, Math.floor(indexes.length / 30))
      const songs = indexes
        .filter((_, index) => index % sampleStep === 0)
        .slice(0, 30)
        .map((songIndex) => ({
          index: songIndex,
          name: this.songs[songIndex].name,
          artists: this.songs[songIndex].artists,
          cluster: this.songs[songIndex].cluster,
        }))
      return {
        mood,
        count: indexes.length,
        percentage: (indexes.length / this.songs.length) * 100,
        description: MOOD_DESCRIPTIONS[mood],
        averageTempo: values.tempo,
        averageLoudness: values.loudness,
        dominantCluster,
        values,
        songs,
      }
    })

    return {
      source: this.source,
      sourceLabel:
        this.source === 'dataset'
          ? 'Dataset asli terhubung'
          : 'Preview menggunakan data demo',
      warning: this.warning,
      generatedAt: new Date().toISOString(),
      kpis: {
        songs: this.songs.length,
        artists: new Set(this.songs.map((song) => song.artists)).size,
        clusters: this.clusters.length,
        yearMin: years.length
        ? years.reduce((min, year) => Math.min(min, year), Infinity)
        : null,

        yearMax: years.length
        ? years.reduce((max, year) => Math.max(max, year), -Infinity)
        : null,
      },
      clusterCounts: counts.map((item) => ({
        ...item,
        percentage: (item.count / this.songs.length) * 100,
      })),
      clusterProfiles: this.clusters.map((cluster) => {
        const means = this.clusterMeans(cluster)
        return {
          cluster,
          description: this.describe(means),
          values: Object.fromEntries(
            AUDIO_FEATURES.map((feature, index) => [feature, means[index]]),
          ) as Record<AudioFeature, number>,
        }
      }),
      scatter: this.songs
        .filter((_, index) => {
          const step = Math.max(1, Math.ceil(this.songs.length / 480))
          return index % step === 0
        })
        .slice(0, 480)
        .map((song) => ({
          x: song.danceability,
          y: song.energy,
          cluster: song.cluster,
        })),
      decades: [...decadeMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([decade, count]) => ({
          decade: decade === 1940 ? '≤1940' : `${decade}s`,
          count,
        })),
      histograms: {
        energy: this.histogram('energy'),
        danceability: this.histogram('danceability'),
        valence: this.histogram('valence'),
      },
      catalogProfile,
      moods,
      dataset: {
        clusterFiles: this.clusterFiles,
        cleanFileAvailable:
          this.source === 'dataset' ? fs.existsSync(CLEAN_FILE) : false,
        evaluationAvailable: evaluation.available,
        features: AUDIO_FEATURES.length,
      },
      evaluation,
    }
  }

  search(query: string): SearchResult[] {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (normalizedQuery.length < 2) return []
    const results: SearchResult[] = []
    for (let index = 0; index < this.songs.length && results.length < 100; index += 1) {
      if (this.searchText[index].includes(normalizedQuery)) {
        const song = this.songs[index]
        results.push({
          index,
          name: song.name,
          artists: song.artists,
          cluster: song.cluster,
        })
      }
    }
    return results
  }

  clusterSamples(cluster: number, seed: number) {
    const indexes = [...(this.clusterIndexes.get(cluster) || [])]
    let state = (seed || Date.now()) >>> 0
    const random = () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return (state >>> 0) / 4294967296
    }
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1))
      ;[indexes[index], indexes[target]] = [indexes[target], indexes[index]]
    }
    const profile = this.clusterMeans(cluster)
    return {
      cluster,
      description: this.describe(profile),
      total: indexes.length,
      songs: indexes.slice(0, 30).map((index) => ({
        index,
        name: this.songs[index].name,
        artists: this.songs[index].artists,
        cluster,
      })),
      source: this.source,
    }
  }

  private top(queryIndex: number, candidates: number[], amount: number) {
    const query = this.normalized[queryIndex]
    const duplicateKey = this.duplicateKeys[queryIndex]
    const results: Array<{ index: number; similarity: number }> = []
    for (const index of candidates) {
      if (this.duplicateKeys[index] === duplicateKey) continue
      const similarity = this.normalized[index].reduce(
        (total, value, featureIndex) =>
          total + value * query[featureIndex],
        0,
      )
      if (results.length < amount) {
        results.push({ index, similarity })
        results.sort((a, b) => b.similarity - a.similarity)
      } else if (similarity > results[results.length - 1].similarity) {
        results[results.length - 1] = { index, similarity }
        results.sort((a, b) => b.similarity - a.similarity)
      }
    }
    return results
  }

  recommend(
    queryIndex: number,
    amount: number,
    mode: 'cluster' | 'all',
  ): RecommendationResponse {
    if (!this.songs[queryIndex]) throw new Error('Lagu yang dipilih tidak ditemukan')
    const safeAmount = [5, 10, 15, 20].includes(amount) ? amount : 10
    const allCandidates = this.songs.map((_, index) => index)
    const clusterCandidates =
      this.clusterIndexes.get(this.songs[queryIndex].cluster) || []

    const allStarted = performance.now()
    const topAll = this.top(queryIndex, allCandidates, safeAmount)
    const allMs = performance.now() - allStarted
    const clusterStarted = performance.now()
    const topCluster = this.top(queryIndex, clusterCandidates, safeAmount)
    const clusterMs = performance.now() - clusterStarted
    const selectedTop = mode === 'cluster' ? topCluster : topAll
    const toRecommendation = (
      item: { index: number; similarity: number },
      rank: number,
    ): Recommendation => ({
      rank: rank + 1,
      index: item.index,
      name: this.songs[item.index].name,
      artists: this.songs[item.index].artists,
      cluster: this.songs[item.index].cluster,
      similarity: item.similarity,
    })
    const selected = this.songs[queryIndex]

    return {
      selected: {
        index: queryIndex,
        name: selected.name,
        artists: selected.artists,
        cluster: selected.cluster,
      },
      mode,
      results: selectedTop.map(toRecommendation),
      timing: {
        clusterMs,
        allMs,
        catalogShare: (clusterCandidates.length / this.songs.length) * 100,
        overlap: topAll.filter((item) =>
          topCluster.some((clusterItem) => clusterItem.index === item.index),
        ).length,
      },
      source: this.source,
    }
  }
}

let engine: SpotifyEngine | null = null

export function getSpotifyEngine(refresh = false) {
  if (!engine || refresh) engine = new SpotifyEngine()
  return engine
}
