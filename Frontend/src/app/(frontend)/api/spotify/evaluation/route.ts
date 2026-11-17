import {
  getSpotifyEngine,
  readEvaluation,
  readEvaluationDetail,
} from '@/lib/spotify-engine'

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams
  if (parameters.get('detail') === '1') {
    const detail = readEvaluationDetail()
    if (!detail) {
      return Response.json(
        { error: 'detail_query.csv belum tersedia.' },
        { status: 404 },
      )
    }
    return Response.json({ rows: detail })
  }
  const engine = getSpotifyEngine(parameters.get('refresh') === '1')
  return Response.json(readEvaluation(engine.clusters.length))
}
