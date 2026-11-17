export const AUDIO_FEATURES = [
  'danceability',
  'energy',
  'loudness',
  'speechiness',
  'acousticness',
  'instrumentalness',
  'liveness',
  'valence',
  'tempo',
] as const

export type AudioFeature = (typeof AUDIO_FEATURES)[number]

export type Song = {
  index: number
  name: string
  artists: string
  cluster: number
  year?: number
} & Record<AudioFeature, number>

export type DataSource = 'dataset' | 'demo'
export type MoodName = 'Happy' | 'Calm' | 'Energetic' | 'Sad'

export type HistogramBin = {
  label: string
  value: number
}

export type EvaluationPoint = {
  k: number
  silhouette: number
  daviesBouldin: number
}

export type EvaluationMetric = {
  metric: string
  value: string | number
  description: string
}

export type EvaluationData = {
  available: boolean
  points: EvaluationPoint[]
  metrics: EvaluationMetric[]
  selectedK: number | null
  timing: {
    allMs: number | null
    clusterMs: number | null
  }
  detailAvailable: boolean
  message?: string
}

export type OverviewData = {
  source: DataSource
  sourceLabel: string
  warning?: string
  generatedAt: string
  kpis: {
    songs: number
    artists: number
    clusters: number
    yearMin: number | null
    yearMax: number | null
  }
  clusterCounts: Array<{ cluster: number; count: number; percentage: number }>
  clusterProfiles: Array<{
    cluster: number
    description: string
    values: Record<AudioFeature, number>
  }>
  scatter: Array<{
    x: number
    y: number
    cluster: number
  }>
  decades: Array<{ decade: string; count: number }>
  histograms: Record<'energy' | 'danceability' | 'valence', HistogramBin[]>
  catalogProfile: Record<AudioFeature, number>
  moods: Array<{
    mood: MoodName
    count: number
    percentage: number
    description: string
    averageTempo: number
    averageLoudness: number
    dominantCluster: number
    values: Record<AudioFeature, number>
    songs: SearchResult[]
  }>
  dataset: {
    clusterFiles: number
    cleanFileAvailable: boolean
    evaluationAvailable: boolean
    features: number
  }
  evaluation: EvaluationData
}

export type SearchResult = {
  index: number
  name: string
  artists: string
  cluster: number
}

export type Recommendation = SearchResult & {
  rank: number
  similarity: number
}

export type RecommendationResponse = {
  selected: SearchResult
  mode: 'cluster' | 'all'
  results: Recommendation[]
  timing: {
    clusterMs: number
    allMs: number
    catalogShare: number
    overlap: number
  }
  source: DataSource
}
