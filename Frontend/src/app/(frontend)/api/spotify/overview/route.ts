import { getSpotifyEngine } from '@/lib/spotify-engine'

export async function GET(request: Request) {
  try {
    const refresh = new URL(request.url).searchParams.get('refresh') === '1'
    return Response.json(getSpotifyEngine(refresh).overview())
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Gagal memuat ringkasan dataset.',
      },
      { status: 500 },
    )
  }
}
