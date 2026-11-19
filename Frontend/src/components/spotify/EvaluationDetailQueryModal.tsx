'use client'

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Search,
  TableProperties,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

type DetailRow = Record<string, string>
type Props = { rows: DetailRow[]; close: () => void }

const PAGE_SIZE = 10

function numeric(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function fmt(value: number | null, digits = 2): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function speed(row: DetailRow): number | null {
  const all = numeric(row.waktu_semua_ms)
  const cluster = numeric(row.waktu_cluster_ms)
  return all !== null && cluster !== null && cluster > 0 ? all / cluster : null
}

function percentage(value: string | undefined, digits = 1) {
  const number = numeric(value)
  return number === null ? '—' : `${fmt(number * 100, digits)}%`
}

function hit(value: string | undefined) {
  const number = numeric(value)
  return number === null ? '—' : number > 0 ? 'Ya' : 'Tidak'
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-[#E1E8F7] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(22,39,82,0.025)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#5278E8]">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-[#202A44]">{value}</p>
      <p className="mt-1 text-[10px] text-[#94A3B8]">{detail}</p>
    </div>
  )
}

export default function EvaluationDetailQueryModal({ rows, close }: Props) {
  const [keyword, setKeyword] = useState('')
  const [cluster, setCluster] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close])

  const clusters = useMemo(
    () => [...new Set(rows.map((row) => row.cluster).filter(Boolean))].sort(
      (a, b) => Number(a) - Number(b),
    ),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = keyword.toLocaleLowerCase('id-ID').trim()
    return rows.map((row, index) => ({ row, index })).filter(({ row }) => {
      const matchQuery = !q || [row.judul, row.artis, row.indeks_lagu]
        .some((part) => (part ?? '').toLocaleLowerCase('id-ID').includes(q))
      return matchQuery && (cluster === 'all' || row.cluster === cluster)
    })
  }, [rows, keyword, cluster])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const first = (currentPage - 1) * PAGE_SIZE
  const visibleRows = filtered.slice(first, first + PAGE_SIZE)

  const stats = useMemo(() => ({
    all: average(rows.map((row) => numeric(row.waktu_semua_ms))),
    cluster: average(rows.map((row) => numeric(row.waktu_cluster_ms))),
    speedup: (() => {
      const all = average(rows.map((row) => numeric(row.waktu_semua_ms)))
      const cluster = average(rows.map((row) => numeric(row.waktu_cluster_ms)))
      return all !== null && cluster !== null && cluster > 0 ? all / cluster : null
    })(),
  }), [rows])

  const changeKeyword = (value: string) => {
    setKeyword(value)
    setPage(1)
    setExpandedKey(null)
  }

  const changeCluster = (value: string) => {
    setCluster(value)
    setPage(1)
    setExpandedKey(null)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F1832]/70 p-2 backdrop-blur-[3px] sm:p-5"
      role="presentation"
    >
      <section
        aria-labelledby="evaluation-detail-title"
        aria-modal="true"
        className="flex max-h-[96dvh] w-full max-w-[1250px] flex-col overflow-hidden rounded-2xl border border-[#D8E2FA] bg-[#F7F9FE] shadow-[0_28px_90px_rgba(5,15,43,0.36)] sm:max-h-[92dvh]"
        role="dialog"
      >
        {/* Header sesuai palet dashboard: navy, biru dan ungu. */}
        <div className="relative shrink-0 overflow-hidden bg-[#202A44] px-5 py-5 text-white sm:px-7">
          <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-56 rounded-full bg-[#5278E8]/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#6882CA]/40 bg-[#364772] text-[#C4B5FD]">
                <TableProperties size={21} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#B9ACFF]">Evaluation workspace</p>
                <h2 id="evaluation-detail-title" className="mt-1 text-lg font-bold tracking-[-0.025em] sm:text-2xl">
                  Detail Query Evaluasi
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#CAD5ED] sm:text-sm">
                  Perbandingan performa pencarian semua lagu dan filter cluster
                </p>
              </div>
            </div>
            <button
              aria-label="Tutup detail query"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#5C6E99] bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={close}
              type="button"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={<Database size={15} />} label="Jumlah query" value={rows.length.toLocaleString('id-ID')} detail="Baris data yang diterima" />
              <Stat icon={<Clock3 size={15} />} label="Rata-rata semua lagu" value={stats.all === null ? '—' : `${fmt(stats.all)} ms`} detail="Waktu pencarian tanpa filter" />
              <Stat icon={<Layers3 size={15} />} label="Rata-rata satu cluster" value={stats.cluster === null ? '—' : `${fmt(stats.cluster)} ms`} detail="Waktu pencarian terfilter" />
              <Stat icon={<Gauge size={15} />} label="Rata-rata percepatan" value={stats.speedup === null ? '—' : `${fmt(stats.speedup)}×`} detail="Rasio rerata waktu pencarian" />
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-[#DFE6F5] bg-white shadow-[0_2px_8px_rgba(25,40,85,0.035)]">
              <div className="flex flex-col gap-3 border-b border-[#E9EDF6] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#202A44]">Daftar hasil pengujian</h3>
                  <p className="mt-1 text-xs text-[#64748B]">Cari lagu, filter cluster, atau buka rincian metrik tiap query.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative block">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      aria-label="Cari judul, artis atau indeks lagu"
                      className="h-10 w-full rounded-lg border border-[#D9E2F2] bg-white pl-9 pr-3 text-xs text-[#202A44] outline-none placeholder:text-[#94A3B8] focus:border-[#5278E8] focus:ring-2 focus:ring-[#E8F0FF] sm:w-60"
                      onChange={(event) => changeKeyword(event.target.value)}
                      placeholder="Cari judul / artis / indeks..."
                      type="search"
                      value={keyword}
                    />
                  </label>
                  <label className="relative block">
                    <span className="sr-only">Filter cluster</span>
                    <select
                      className="h-10 w-full rounded-lg border border-[#D9E2F2] bg-white px-3 text-xs font-semibold text-[#344FA1] outline-none focus:border-[#5278E8] focus:ring-2 focus:ring-[#E8F0FF] sm:w-38"
                      onChange={(event) => changeCluster(event.target.value)}
                      value={cluster}
                    >
                      <option value="all">Semua cluster</option>
                      {clusters.map((item) => <option key={item} value={item}>Cluster {item}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[870px] border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-[#F1F5FD]">
                    <tr className="border-b border-[#DFE6F5] text-[10px] font-bold uppercase tracking-[0.08em] text-[#5C6C88]">
                      <th className="w-[30%] px-5 py-3.5">Lagu / query</th>
                      <th className="px-3 py-3.5">Cluster</th>
                      <th className="px-3 py-3.5 text-right">Semua lagu</th>
                      <th className="px-3 py-3.5 text-right">Satu cluster</th>
                      <th className="px-3 py-3.5 text-right">Percepatan</th>
                      <th className="px-3 py-3.5 text-right">Overlap top-10</th>
                      <th className="px-5 py-3.5 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF1F8]">
                    {visibleRows.map(({ row, index }) => {
                      const key = String(index)
                      const expanded = expandedKey === key
                      const gain = speed(row)
                      return (
                        <Fragment key={key}>
                          <tr className={`transition-colors ${expanded ? 'bg-[#EDF3FF]' : 'bg-white hover:bg-[#F8FAFF]'}`}>
                            <td className="max-w-0 px-5 py-4">
                              <p className="truncate text-xs font-bold text-[#202A44]" title={row.judul || ''}>
                                {row.judul || 'Judul tidak tersedia'}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-[#64748B]" title={row.artis || ''}>
                                {row.artis || 'Artis tidak tersedia'} <span className="text-[#A1AEC5]">· ID {row.indeks_lagu || '—'}</span>
                              </p>
                            </td>
                            <td className="px-3 py-4">
                              <span className="inline-flex rounded-md border border-[#D5E1FF] bg-[#E8F0FF] px-2.5 py-1 text-[11px] font-bold text-[#344FA1]">
                                C{row.cluster ?? '—'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-right text-xs tabular-nums text-[#536179]">{fmt(numeric(row.waktu_semua_ms))} ms</td>
                            <td className="whitespace-nowrap px-3 py-4 text-right text-xs font-semibold tabular-nums text-[#344FA1]">{fmt(numeric(row.waktu_cluster_ms))} ms</td>
                            <td className="px-3 py-4 text-right">
                              <span className="inline-flex min-w-14 justify-center rounded-md bg-[#F1ECFF] px-2 py-1 text-[11px] font-bold tabular-nums text-[#7253B6]">
                                {gain === null ? '—' : `${fmt(gain)}×`}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-right text-xs font-semibold tabular-nums text-[#536179]">{percentage(row.irisan_top)}</td>
                            <td className="px-5 py-4 text-center">
                              <button
                                aria-expanded={expanded}
                                aria-label={`${expanded ? 'Tutup' : 'Lihat'} detail ${row.judul || 'query'}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#D7E2F9] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#5278E8] transition hover:border-[#5278E8] hover:bg-[#E8F0FF]"
                                onClick={() => setExpandedKey(expanded ? null : key)}
                                type="button"
                              >
                                {expanded ? 'Tutup' : 'Lihat'}
                                <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-[#F3F6FE]">
                              <td colSpan={7} className="px-5 pb-5 pt-2">
                                <div className="rounded-xl border border-[#D7E2FA] bg-white p-4">
                                  <p className="mb-3 text-xs font-bold text-[#344FA1]">Rincian metrik query</p>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                      ['Cosine similarity · semua lagu', fmt(numeric(row.kosinus_semua), 4)],
                                      ['Cosine similarity · cluster', fmt(numeric(row.kosinus_cluster), 4)],
                                      ['Overlap rekomendasi top-10', percentage(row.irisan_top)],
                                      ['Hit artis · semua lagu', hit(row.hit_artis_semua)],
                                      ['Hit artis · cluster', hit(row.hit_artis_cluster)],
                                      ['Porsi kandidat cluster', percentage(row.porsi_kandidat)],
                                    ].map(([label, value]) => (
                                      <div className="rounded-lg border border-[#EBEFF8] bg-[#FAFBFF] p-3" key={label}>
                                        <p className="text-[10px] text-[#72809A]">{label}</p>
                                        <p className="mt-1 text-sm font-bold tabular-nums text-[#202A44]">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-[11px] leading-5 text-[#72809A]">
                                    Waktu dalam milidetik. Overlap menunjukkan proporsi hasil top-10 pencarian semua lagu yang juga ditemukan melalui filter cluster.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td className="px-5 py-16 text-center" colSpan={7}>
                          <Search className="mx-auto text-[#94A3B8]" size={24} />
                          <p className="mt-3 text-sm font-bold text-[#202A44]">Tidak ada query yang cocok</p>
                          <p className="mt-1 text-xs text-[#64748B]">Coba kata kunci atau filter cluster yang lain.</p>
                          <button
                            className="mt-4 rounded-lg border border-[#CBD9FF] bg-[#E8F0FF] px-3 py-2 text-xs font-bold text-[#344FA1]"
                            onClick={() => { changeKeyword(''); changeCluster('all') }}
                            type="button"
                          >
                            Hapus filter
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[#E9EDF6] bg-[#FCFDFF] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p aria-live="polite" className="text-xs text-[#64748B]">
                  {filtered.length ? `Menampilkan ${first + 1}–${Math.min(first + PAGE_SIZE, filtered.length)} dari ${filtered.length} query` : '0 query ditemukan'}
                  {filtered.length !== rows.length ? ` · Total data: ${rows.length}` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <span className="mr-2 text-xs font-semibold tabular-nums text-[#536179]">{currentPage} / {totalPages}</span>
                  <button
                    aria-label="Halaman sebelumnya"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E2F2] bg-white text-[#344FA1] hover:bg-[#E8F0FF] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage === 1}
                    onClick={() => { setPage(currentPage - 1); setExpandedKey(null) }}
                    type="button"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    aria-label="Halaman berikutnya"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E2F2] bg-white text-[#344FA1] hover:bg-[#E8F0FF] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() => { setPage(currentPage + 1); setExpandedKey(null) }}
                    type="button"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] leading-5 text-[#7B8AA5]">
              <p>Sumber: <span className="font-semibold text-[#536A9D]">hasil_evaluasi/detail_query.csv</span> · Data asli, hanya format tampilan yang diubah.</p>
              <p>Tekan Esc atau tombol × untuk menutup.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
