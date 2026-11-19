import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Kolom ini dihasilkan oleh evaluasi_rekomendasi() pada 08_evaluasi.py.
const EXPECTED_COLUMNS = [
  'indeks_lagu',
  'judul',
  'artis',
  'cluster',
  'waktu_semua_ms',
  'waktu_cluster_ms',
  'irisan_top',
  'kosinus_semua',
  'kosinus_cluster',
  'hit_artis_semua',
  'hit_artis_cluster',
  'porsi_kandidat',
] as const

type CsvRow = Record<string, string>

/** Parser CSV tanpa dependensi tambahan; mendukung BOM UTF-8, tanda kutip, koma dalam judul lagu, dan CRLF. */
function parseCsv(source: string): string[][] {
  const input = source.replace(/^\uFEFF/, '')
  const result: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      row.push(field)
      if (row.some((value) => value !== '')) result.push(row)
      row = []
      field = ''
      if (ch === '\r' && input[i + 1] === '\n') i++
      continue
    }
    field += ch
  }

  if (quoted) throw new Error('Format CSV tidak valid: tanda kutip tidak ditutup.')
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((value) => value !== '')) result.push(row)
  }
  return result
}

function candidatePaths(): string[] {
  const cwd = process.cwd() // Folder Frontend tempat pnpm dev dijalankan.
  const customPath = process.env.SPOTIFY_DETAIL_QUERY_CSV?.trim()
  const candidates = [
    ...(customPath ? [path.resolve(cwd, customPath)] : []),
    path.resolve(cwd, '..', 'spotify-recommender', 'hasil_evaluasi', 'detail_query.csv'),
    path.resolve(cwd, '..', 'spotify-recommender-main', 'hasil_evaluasi', 'detail_query.csv'),
    path.resolve(cwd, '..', 'spotify-recommender-main(1)', 'hasil_evaluasi', 'detail_query.csv'),
    path.resolve(cwd, 'hasil_evaluasi', 'detail_query.csv'),
    path.resolve(cwd, 'data', 'evaluation', 'detail_query.csv'),
  ]
  return [...new Set(candidates)]
}

export async function GET() {
  try {
    let csv: string | undefined

    for (const filename of candidatePaths()) {
      try {
        csv = await readFile(filename, 'utf8')
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }

    if (csv === undefined) {
      return NextResponse.json(
        {
          error:
            'File hasil_evaluasi/detail_query.csv belum ditemukan. Jalankan bagian evaluasi rekomendasi pada 08_evaluasi.py, lalu simpan CSV ke Frontend/data/evaluation/detail_query.csv atau set SPOTIFY_DETAIL_QUERY_CSV di .env.local.',
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const parsed = parseCsv(csv)
    const header = parsed[0]?.map((name) => name.trim()) ?? []
    const missing = EXPECTED_COLUMNS.filter((name) => !header.includes(name))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Kolom CSV tidak sesuai hasil 08_evaluasi.py. Kolom belum ada: ${missing.join(', ')}` },
        { status: 422 },
      )
    }

    const rows: CsvRow[] = parsed.slice(1).map((cells) => {
      const result: CsvRow = {}
      header.forEach((name, index) => {
        result[name] = cells[index] ?? ''
      })
      return result
    })
    return NextResponse.json(
      { rows, count: rows.length },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tidak dapat membaca tabel query.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
