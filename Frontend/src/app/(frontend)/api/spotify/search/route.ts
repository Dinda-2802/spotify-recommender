import { getSpotifyEngine } from '@/lib/spotify-engine'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') || ''
  if (query.trim().length < 2) {
    return Response.json({ results: [], message: 'Ketik minimal dua karakter.' })
  }
  return Response.json({
    results: getSpotifyEngine().search(query),
  })
}
