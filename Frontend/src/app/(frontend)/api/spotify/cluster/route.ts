import { getSpotifyEngine } from '@/lib/spotify-engine'

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams
  const cluster = Number(parameters.get('cluster'))
  const seed = Number(parameters.get('seed')) || Date.now()
  if (!Number.isInteger(cluster)) {
    return Response.json({ error: 'Cluster tidak valid.' }, { status: 400 })
  }
  return Response.json(getSpotifyEngine().clusterSamples(cluster, seed))
}
