import { getSpotifyEngine } from '@/lib/spotify-engine'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      index?: unknown
      amount?: unknown
      mode?: unknown
    }
    const index = Number(body.index)
    const amount = Number(body.amount)
    const mode = body.mode === 'all' ? 'all' : 'cluster'
    if (!Number.isInteger(index) || ![5, 10, 15, 20].includes(amount)) {
      return Response.json(
        { error: 'Pilihan lagu atau jumlah rekomendasi tidak valid.' },
        { status: 400 },
      )
    }
    return Response.json(getSpotifyEngine().recommend(index, amount, mode))
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Rekomendasi gagal dihitung.',
      },
      { status: 500 },
    )
  }
}
