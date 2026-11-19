'use client'

import {
  Activity,
  CalendarClock,
  ArrowRight,
  Clock3,
  Database,
  ChevronDown,
  Camera,
  Check,
  ChevronUp,
  History,
  Info,
  ListMusic,
  Music2,
  Pencil,
  Save,
  Search,
  UserRound,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { getDemoSession, updateDemoProfile, type DemoUser } from '../../lib/demo-auth'
import {
  emptyDemoHistory, getDemoHistory, recordDemoActivity,
  deleteDemoHistoryEntry, clearDemoHistorySection,
  type DemoHistory, type DemoHistorySection, type DemoActivityKind,
} from '../../lib/demo-history'

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)] ${className}`}>
      {children}
    </section>
  )
}

function UserHeader({ eyebrow, title, description }: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5278E8]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-zinc-950 sm:text-[30px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Preview · belum terhubung Firebase
      </span>
    </div>
  )
}

function ConnectionNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#CBD9FF] bg-[#E8F0FF] px-4 py-3.5">
      <Database size={18} className="mt-0.5 shrink-0 text-[#344FA1]" />
      <div>
        <p className="text-sm font-semibold text-[#263F8F]">Tahap desain antarmuka</p>
        <p className="mt-1 text-xs leading-5 text-[#445D9C]">
          Foto profil, nama, riwayat pencarian, rekomendasi, dan aktivitas saat ini disimpan di browser untuk masing-masing akun demo.
          Data belum tersinkron ke perangkat lain dan belum disimpan di Firebase. Dataset musik dan sistem rekomendasi tetap digunakan seperti sebelumnya.
        </p>
      </div>
    </div>
  )
}

function EmptyHistory({ icon, title, explanation, onOpenRecommendation }: {
  icon: ReactNode
  title: string
  explanation: string
  onOpenRecommendation: () => void
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#5278E8]">{icon}</div>
      <h2 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-lg text-xs leading-6 text-zinc-500">{explanation}</p>
      <button
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#5278E8] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#344FA1]"
        onClick={onOpenRecommendation}
        type="button"
      >
        Buka Music Recommendation <ArrowRight size={15} />
      </button>
    </div>
  )
}

const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024 // Maksimal 5 MB sebelum dikompresi.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Setiap akun demo menggunakan penyimpanan foto yang berbeda.
function avatarStorageKey(email: string) {
  return `spotify-analytics.preview-avatar.v1:${encodeURIComponent(email.trim().toLowerCase())}`
}

// Foto dijadikan gambar persegi berukuran kecil agar tidak memenuhi localStorage.
async function prepareAvatar(file: File): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Gunakan foto JPG, PNG, atau WebP.')
  }
  if (file.size > MAX_PHOTO_FILE_SIZE) {
    throw new Error('Ukuran foto maksimal 5 MB. Pilih gambar yang lebih kecil.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Foto gagal dibuka. Pilih file gambar lain.'))
      image.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.')

    const side = Math.min(loadedImage.naturalWidth, loadedImage.naturalHeight)
    const startX = (loadedImage.naturalWidth - side) / 2
    const startY = (loadedImage.naturalHeight - side) / 2
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 320, 320)
    context.drawImage(loadedImage, startX, startY, side, side, 0, 0, 320, 320)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function UserProfilePage() {
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)
  const [savedName, setSavedName] = useState('')
  const [savedBio, setSavedBio] = useState('')
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftBio, setDraftBio] = useState('')
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loadingPhoto, setLoadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const bioInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const user = getDemoSession()
    setDemoUser(user)
    if (!user) return

    setSavedName(user.displayName)
    setDraftName(user.displayName)
    setSavedBio(user.bio)
    setDraftBio(user.bio)
    try {
      const photo = window.localStorage.getItem(avatarStorageKey(user.email))
      setSavedPhoto(photo)
      setDraftPhoto(photo)
    } catch {
      setError('Foto profil lokal tidak bisa dibaca dari browser.')
    }
  }, [])

  function editName() {
    setEditing(true)
    setError('')
    setSuccess('')
    nameInputRef.current?.focus()
  }

  function editBio() {
    setEditing(true)
    setError('')
    setSuccess('')
    bioInputRef.current?.focus()
  }

  function cancelEdit() {
    setDraftName(savedName)
    setDraftBio(savedBio)
    setDraftPhoto(savedPhoto)
    setEditing(false)
    setError('')
    setSuccess('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setLoadingPhoto(true)
    setError('')
    setSuccess('')
    try {
      const photo = await prepareAvatar(file)
      setDraftPhoto(photo)
      setEditing(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memilih foto.')
    } finally {
      setLoadingPhoto(false)
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || loadingPhoto) return
    if (!draftName.trim()) {
      setError('Nama tampilan tidak boleh kosong.')
      return
    }
    if (!demoUser) {
      setError('Sesi login tidak ditemukan. Silakan login kembali.')
      return
    }

    const key = avatarStorageKey(demoUser.email)
    try {
      // Menyimpan foto hanya di browser. Tidak ada unggahan ke server.
      if (draftPhoto) window.localStorage.setItem(key, draftPhoto)
      else window.localStorage.removeItem(key)

      const updated = updateDemoProfile(draftName.trim(), draftBio.trim())
      setDemoUser(updated)
      setSavedName(updated.displayName)
      setSavedBio(updated.bio)
      setSavedPhoto(draftPhoto)
      setDraftName(updated.displayName)
      setDraftBio(updated.bio)
      setEditing(false)
      setError('')
      setSuccess('Perubahan profil berhasil disimpan di browser ini.')
      recordDemoActivity('profile', 'Mengubah profil', 'Foto profil, nama tampilan, atau deskripsi singkat diperbarui.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan profil. Periksa penyimpanan browser.')
    }
  }

  const displayName = editing ? draftName : savedName
  const displayBio = editing ? draftBio : savedBio
  const displayPhoto = editing ? draftPhoto : savedPhoto

  return (
    <div className="space-y-6">
      <UserHeader
        eyebrow="USER WORKSPACE"
        title="Profil Pengguna"
        description="Atur foto profil, nama tampilan, dan deskripsi singkat akun Ritmelika."
      />
      <ConnectionNotice />

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-[#E8F0FF] text-[#5278E8] ring-2 ring-white shadow-sm">
                {displayPhoto ? (
                  <Image
                    src={displayPhoto}
                    alt="Foto profil pengguna"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound size={40} />
                )}
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#5278E8] text-white shadow-sm" aria-hidden="true">
                <Camera size={15} />
              </span>
            </div>
            {editing && (
              <span className="inline-flex items-center rounded-full bg-[#E8F0FF] px-3 py-1 text-[11px] font-semibold text-[#344FA1]">
                Pratinjau perubahan
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Pilih foto profil"
            onChange={(event) => void changePhoto(event)}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingPhoto || !demoUser}
              className="inline-flex items-center gap-2 rounded-lg border border-[#BFCFFF] bg-[#E8F0FF] px-3 py-2 text-xs font-semibold text-[#344FA1] hover:bg-[#DCE7FF] disabled:opacity-50"
            >
              <Camera size={15} /> {loadingPhoto ? 'Memproses foto...' : displayPhoto ? 'Ganti foto' : 'Tambah foto'}
            </button>
            {displayPhoto && (
              <button
                type="button"
                onClick={() => { setDraftPhoto(null); setEditing(true); setSuccess(''); setError('') }}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                <Trash2 size={15} /> Hapus foto
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">JPG, PNG, atau WebP, maksimal 5 MB. Foto dipotong persegi dan disimpan setelah klik Simpan perubahan.</p>

          <h2 className="mt-6 break-words text-lg font-bold text-zinc-900">{displayName || 'Pengguna baru'}</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-500">{displayBio || 'Belum ada deskripsi profil.'}</p>
          <div className="mt-6 divide-y divide-zinc-100 border-y border-zinc-100">
            {[
              ['Email (akun demo)', demoUser?.email || 'Tidak tersedia'],
              ['User ID Firebase', 'Belum tersedia'],
              ['Terdaftar di demo', demoUser?.createdAt ? new Date(demoUser.createdAt).toLocaleDateString('id-ID') : 'Tidak tersedia'],
            ].map(([label, value]) => (
              <div className="flex flex-wrap justify-between gap-2 py-3 text-xs" key={label}>
                <span className="text-zinc-500">{label}</span>
                <span className="break-all font-medium text-zinc-800">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#445D9C]">
            <Info size={15} className="mt-0.5 shrink-0" />
            Foto, nama, dan bio disimpan hanya di browser ini, bukan di Firebase.
          </p>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Pengaturan profil</h2>
              <p className="mt-1 text-xs text-zinc-500">Klik Edit untuk mengubah informasi, lalu simpan.</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditing(true); setSuccess(''); setError(''); nameInputRef.current?.focus() }}
              disabled={editing || !demoUser}
              className="inline-flex items-center gap-2 rounded-lg border border-[#BFCFFF] px-3 py-2 text-xs font-bold text-[#344FA1] hover:bg-[#E8F0FF] disabled:cursor-default disabled:opacity-50"
            >
              <Pencil size={15} /> Edit profil
            </button>
          </div>

          <form className="space-y-5 p-5" onSubmit={saveProfile}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold text-zinc-700" htmlFor="preview-name">Nama tampilan</label>
                <button
                  type="button"
                  onClick={editName}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5278E8] hover:underline"
                >
                  <Pencil size={13} /> Edit nama
                </button>
              </div>
              <input
                ref={nameInputRef}
                className={`mt-2 h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#5278E8] focus:ring-4 focus:ring-[#E8F0FF] ${editing ? 'bg-white' : 'bg-zinc-50'}`}
                id="preview-name"
                maxLength={60}
                required
                readOnly={!editing}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Masukkan nama pengguna"
                value={draftName}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold text-zinc-700" htmlFor="preview-bio">Deskripsi singkat</label>
                <button
                  type="button"
                  onClick={editBio}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5278E8] hover:underline"
                >
                  <Pencil size={13} /> Edit deskripsi
                </button>
              </div>
              <textarea
                ref={bioInputRef}
                className={`mt-2 min-h-28 w-full resize-y rounded-lg border border-zinc-200 p-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#5278E8] focus:ring-4 focus:ring-[#E8F0FF] ${editing ? 'bg-white' : 'bg-zinc-50'}`}
                id="preview-bio"
                maxLength={200}
                readOnly={!editing}
                onChange={(event) => setDraftBio(event.target.value)}
                placeholder="Tulis deskripsi singkat (opsional)"
                value={draftBio}
              />
              <p className="mt-1 text-right text-[11px] text-zinc-400">{draftBio.length}/200 karakter</p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}
            {success && (
              <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <Check size={16} /> {success}
              </p>
            )}
            {editing && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5278E8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#344FA1] disabled:opacity-60"
                  type="submit"
                  disabled={loadingPhoto}
                >
                  <Save size={16} /> Simpan perubahan
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                  type="button"
                  onClick={cancelEdit}
                >
                  <X size={16} /> Batal
                </button>
              </div>
            )}
          </form>
        </Panel>
      </div>
    </div>
  )
}


function readableTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

function useLocalHistory() {
  const [history, setHistory] = useState<DemoHistory>(emptyDemoHistory)
  const [error, setError] = useState('')
  useEffect(() => {
    const reload = () => setHistory(getDemoHistory())
    reload()
    window.addEventListener('storage', reload)
    window.addEventListener('spotify-analytics-demo-history-updated', reload)
    return () => {
      window.removeEventListener('storage', reload)
      window.removeEventListener('spotify-analytics-demo-history-updated', reload)
    }
  }, [])

  function remove(section: DemoHistorySection, id: string) {
    if (!deleteDemoHistoryEntry(section, id)) {
      setError('Gagal menghapus catatan. Periksa izin penyimpanan browser.'); return
    }
    setHistory(getDemoHistory())
    setError('')
  }
  function clear(section: DemoHistorySection, label: string) {
    if (!window.confirm(`Hapus seluruh ${label} dari akun demo ini? Tindakan ini tidak bisa dibatalkan.`)) return
    if (!clearDemoHistorySection(section)) {
      setError('Gagal menghapus riwayat. Periksa izin penyimpanan browser.'); return
    }
    setHistory(getDemoHistory())
    setError('')
  }
  return { history, error, remove, clear }
}

function HistoryActions({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <button type="button" disabled={count === 0} onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
      <Trash2 size={14} /> Hapus semua
    </button>
  )
}

function HistoryError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{message}</p> : null
}

export function RecommendationHistoryPage({ onOpenRecommendation }: { onOpenRecommendation: () => void }) {
  const { history, error, remove, clear } = useLocalHistory()
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <UserHeader eyebrow="USER WORKSPACE" title="Riwayat Rekomendasi"
        description="Lihat kembali rekomendasi yang pernah berhasil dihitung, beserta lagu sumber dan waktu." />
      <ConnectionNotice />
      <HistoryError message={error} />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Riwayat Rekomendasi ({history.recommendations.length})</h2>
            <p className="mt-1 text-xs text-zinc-500">Tersimpan otomatis setelah tombol Cari Rekomendasi berhasil dijalankan.</p>
          </div>
          <HistoryActions count={history.recommendations.length} onClear={() => clear('recommendations', 'riwayat rekomendasi')} />
        </div>
        {history.recommendations.length === 0 ? (
          <EmptyHistory icon={<ListMusic size={22} />} title="Belum ada riwayat rekomendasi"
            explanation="Buka Music Recommendation, cari dan pilih satu lagu, lalu klik Cari Rekomendasi. Hasilnya akan tercatat otomatis di sini."
            onOpenRecommendation={onOpenRecommendation} />
        ) : (
          <div className="divide-y divide-zinc-100">
            {history.recommendations.map(item => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-zinc-900">{item.seed.name}</p>
                    <p className="mt-1 break-words text-xs text-zinc-500">{item.seed.artists}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1"><CalendarClock size={13}/>{readableTime(item.at)}</span>
                      <span>{item.mode === 'cluster' ? 'Filter cluster' : 'Semua lagu'}</span>
                      <span>{item.results.length} hasil</span>
                      <span>Cluster {item.seed.cluster}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#E8F0FF] px-3 py-2 text-xs font-semibold text-[#344FA1] hover:bg-[#DCE7FF]">
                      {expanded === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {expanded === item.id ? 'Tutup hasil' : 'Lihat hasil'}
                    </button>
                    <button type="button" aria-label={`Hapus rekomendasi ${item.seed.name}`} title="Hapus catatan"
                      onClick={() => remove('recommendations', item.id)} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {expanded === item.id && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="w-full min-w-[530px] text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-500"><tr>
                        <th className="px-3 py-2">#</th><th className="px-3 py-2">Judul lagu</th>
                        <th className="px-3 py-2">Artis</th><th className="px-3 py-2">Cluster</th><th className="px-3 py-2">Cosine similarity</th>
                      </tr></thead>
                      <tbody className="divide-y divide-zinc-100">{item.results.map(result => (
                        <tr key={`${item.id}-${result.index}`}>
                          <td className="px-3 py-2">{result.rank}</td>
                          <td className="px-3 py-2 font-semibold text-zinc-800">{result.name}</td>
                          <td className="px-3 py-2 text-zinc-500">{result.artists}</td>
                          <td className="px-3 py-2">C{result.cluster}</td>
                          <td className="px-3 py-2 tabular-nums">{result.similarity.toFixed(3)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

export function SearchHistoryPage({ onOpenRecommendation }: { onOpenRecommendation: () => void }) {
  const { history, error, remove, clear } = useLocalHistory()
  return (
    <div className="space-y-6">
      <UserHeader eyebrow="USER WORKSPACE" title="Riwayat Pencarian"
        description="Pencarian dicatat saat kamu memilih lagu dari hasil pencarian, bukan setiap kali mengetik." />
      <ConnectionNotice />
      <HistoryError message={error} />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Riwayat Pencarian ({history.searches.length})</h2>
            <p className="mt-1 text-xs text-zinc-500">Kata kunci, lagu yang dipilih, dan waktu pencarian.</p>
          </div>
          <HistoryActions count={history.searches.length} onClear={() => clear('searches', 'riwayat pencarian')} />
        </div>
        {history.searches.length === 0 ? (
          <EmptyHistory icon={<Search size={22} />} title="Belum ada riwayat pencarian"
            explanation="Buka Music Recommendation, ketik judul atau artis, lalu klik salah satu lagu dari daftar hasil pencarian. Pilihanmu akan muncul di sini."
            onOpenRecommendation={onOpenRecommendation} />
        ) : (
          <div className="divide-y divide-zinc-100">{history.searches.map(item => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-zinc-900">{item.track.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.track.artists} · Cluster {item.track.cluster}</p>
                <p className="mt-1 break-words text-xs text-zinc-500">Kata kunci: <span className="font-medium text-zinc-700">{item.query}</span></p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500"><Clock3 size={13}/>{readableTime(item.at)}</p>
              </div>
              <button type="button" title="Hapus catatan" aria-label={`Hapus pencarian ${item.track.name}`}
                onClick={() => remove('searches', item.id)} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}</div>
        )}
      </Panel>
    </div>
  )
}

const KIND_LABELS: Record<DemoActivityKind, string> = {
  register: 'Pendaftaran', login: 'Login', logout: 'Logout',
  search: 'Pencarian', recommendation: 'Rekomendasi', profile: 'Profil',
}

export function UserActivityPage({ onOpenRecommendation }: { onOpenRecommendation: () => void }) {
  const { history, error, remove, clear } = useLocalHistory()
  const searchCount = history.activities.filter(item => item.kind === 'search').length
  const recommendationCount = history.activities.filter(item => item.kind === 'recommendation').length
  const last = history.activities[0]
  return (
    <div className="space-y-6">
      <UserHeader eyebrow="USER WORKSPACE" title="Aktivitas Pengguna"
        description="Linimasa login, pencarian lagu, rekomendasi, dan perubahan profil akun demo." />
      <ConnectionNotice />
      <HistoryError message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Pencarian lagu', icon: Search, value: searchCount, detail: 'Lagu yang dipilih dari pencarian' },
          { label: 'Rekomendasi', icon: Music2, value: recommendationCount, detail: 'Permintaan yang berhasil dihitung' },
          { label: 'Total aktivitas', icon: Clock3, value: history.activities.length, detail: last ? `Terbaru: ${readableTime(last.at)}` : 'Belum ada aktivitas' },
        ].map(({ label, icon: Icon, value, detail }) => (
          <Panel className="p-5" key={label}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#5278E8]"><Icon size={17} /></span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{value.toLocaleString('id-ID')}</p>
            <p className="mt-1 text-xs text-zinc-500">{detail}</p>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Linimasa Aktivitas ({history.activities.length})</h2>
            <p className="mt-1 text-xs text-zinc-500">Data lokal milik akun demo yang saat ini login.</p>
          </div>
          <HistoryActions count={history.activities.length} onClear={() => clear('activities', 'aktivitas pengguna')} />
        </div>
        {history.activities.length === 0 ? (
          <EmptyHistory icon={<History size={22} />} title="Belum ada aktivitas yang tercatat"
            explanation="Login, pilih lagu dari pencarian, jalankan rekomendasi, atau ubah profil untuk membuat catatan aktivitas di browser ini."
            onOpenRecommendation={onOpenRecommendation} />
        ) : (
          <div className="divide-y divide-zinc-100">{history.activities.map(item => (
            <div key={item.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#5278E8]">
                {item.kind === 'search' ? <Search size={17}/> : item.kind === 'recommendation' ? <Music2 size={17}/> : item.kind === 'profile' ? <UserRound size={17}/> : <Activity size={17}/>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                <p className="mt-1 break-words text-xs text-zinc-500">{item.detail}</p>
                <p className="mt-1 text-[11px] font-medium text-[#5278E8]">{KIND_LABELS[item.kind]} · {readableTime(item.at)}</p>
              </div>
              <button type="button" title="Hapus aktivitas" aria-label={`Hapus aktivitas ${item.title}`}
                onClick={() => remove('activities', item.id)} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}</div>
        )}
      </Panel>
    </div>
  )
}
