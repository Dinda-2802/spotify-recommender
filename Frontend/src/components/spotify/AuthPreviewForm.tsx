
'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Info,
  LockKeyhole, Mail, ShieldCheck, UserRound,
} from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase'

type AuthMode = 'login' | 'register'
type FormValues = {
  displayName: string
  email: string
  password: string
  confirmation: string
}

const inputClass = 'mt-2 block h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#5278E8] focus:ring-4 focus:ring-[#E8F0FF]'

export default function AuthPreviewForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const registering = mode === 'register'

  const [values, setValues] = useState<FormValues>({
    displayName: '',
    email: '',
    password: '',
    confirmation: '',
  })
  const [visible, setVisible] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof FormValues, value: string) {
    setValues(current => ({ ...current, [field]: value }))
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setError('')

    if (registering && !values.displayName.trim()) {
      setError('Masukkan nama pengguna.')
      return
    }

    if (values.password.length < 8) {
      setError('Password minimal 8 karakter.')
      return
    }

    if (registering && values.password !== values.confirmation) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setSubmitting(true)

    try {
      const email = values.email.trim().toLowerCase()

      if (registering) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          values.password
        )

        await updateProfile(credential.user, {
          displayName: values.displayName.trim(),
        })

        await setDoc(doc(db, 'users', credential.user.uid), {
          uid: credential.user.uid,
          displayName: values.displayName.trim(),
          email,
          createdAt: serverTimestamp(),
        })
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          values.password
        )
      }

      setValues({
        displayName: '',
        email: '',
        password: '',
        confirmation: '',
      })

      router.replace('/dashboard')
    } catch (cause: unknown) {
      const code = (cause as { code?: string })?.code

      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Email sudah terdaftar. Silakan login.',
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/weak-password': 'Password terlalu lemah.',
        'auth/user-not-found': 'Akun tidak ditemukan. Silakan daftar.',
        'auth/wrong-password': 'Password salah.',
        'auth/invalid-credential': 'Email atau password salah.',
        'auth/network-request-failed': 'Koneksi internet bermasalah.',
        'permission-denied': 'Firestore menolak akses. Periksa Security Rules.',
      }

      setError(
        messages[code || ''] ||
        (cause instanceof Error ? cause.message : 'Terjadi kesalahan.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[#F6F7FC] text-zinc-900 lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden min-h-dvh overflow-hidden bg-[#202A44] px-10 py-10 text-white lg:flex lg:flex-col xl:px-16">
        <div className="pointer-events-none absolute -right-28 top-20 h-80 w-80 rounded-full bg-[#5278E8]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-[#A78BFA]/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
            <Image src="/music-analytics-logo.jpeg" alt="Logo Ritmelika" height={48} width={48} className="h-full w-full object-contain" priority />
          </span>
          <div>
            <strong className="block text-sm">Ritmelika</strong>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-[#A8B7D8]">Big Data Spark</span>
          </div>
        </div>

        <div className="relative my-auto max-w-lg py-16">
          <span className="inline-flex rounded-full border border-[#4F618A] bg-[#2B3B60] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C4B5FD]">
            User workspace
          </span>
          <h1 className="mt-7 text-4xl font-bold leading-[1.2] tracking-[-0.04em] xl:text-5xl">
            Temukan musik melalui data dan kemiripan audio.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#BAC7E1]">
            Jelajahi analisis 8 cluster, eksplorasi mood, dan rekomendasi lagu dengan cosine similarity.
          </p>
          <div className="mt-9 grid gap-3">
            {[
              'Dashboard analytics dan visualisasi cluster',
              'Rekomendasi berdasarkan fitur audio',
              'Profil serta riwayat pengguna Firebase',
            ].map(item => (
              <div className="flex items-center gap-3 text-xs text-[#DFE6F7]" key={item}>
                <CheckCircle2 size={17} className="shrink-0 text-[#A78BFA]" /> {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-[#91A2C4]">fy Analytics · Big Data Spark</p>
      </aside>

      <div className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:px-14 lg:py-10 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-[#5278E8]">
            <ArrowLeft size={15} /> Layar awal
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] font-semibold text-green-800">
            <ShieldCheck size={13} /> Firebase Authentication
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#5278E8]">
            {registering ? <UserRound size={22} /> : <LockKeyhole size={22} />}
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5278E8]">
            {registering ? 'Belum punya akun?' : 'Sudah punya akun?'}
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-zinc-950">
            {registering ? 'Buat akun baru' : 'Login ke Ritmelika'}
          </h2>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            {registering
              ? 'Daftarkan akun untuk mulai menggunakan Ritmelika.'
              : 'Masuk menggunakan akun Firebase kamu.'}
          </p>

          <form className="mt-7 space-y-4" onSubmit={submit}>
            {registering && (
              <div>
                <label htmlFor="displayName" className="block text-xs font-semibold text-zinc-700">Nama pengguna</label>
                <div className="relative">
                  <UserRound size={16} className="pointer-events-none absolute left-3 top-[21px] text-zinc-400" />
                  <input id="displayName" autoComplete="name" required maxLength={60} placeholder="Nama pengguna"
                    className={`${inputClass} pl-10`} value={values.displayName} onChange={e => update('displayName', e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-700">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-[21px] text-zinc-400" />
                <input id="email" type="email" autoComplete="email" required maxLength={254} placeholder="contoh@email.com"
                  className={`${inputClass} pl-10`} value={values.email} onChange={e => update('email', e.target.value)} />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-zinc-700">Password</label>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-[21px] text-zinc-400" />
                <input id="password" type={visible ? 'text' : 'password'} required minLength={8}
                  autoComplete={registering ? 'new-password' : 'current-password'} placeholder="Minimal 8 karakter"
                  className={`${inputClass} pl-10 pr-12`} value={values.password} onChange={e => update('password', e.target.value)} />
                <button type="button" aria-label="Tampilkan atau sembunyikan password"
                  className="absolute right-3 top-[18px] rounded-md p-1 text-zinc-400 hover:text-zinc-700"
                  onClick={() => setVisible(v => !v)}>
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {registering && (
              <div>
                <label htmlFor="confirmation" className="block text-xs font-semibold text-zinc-700">Konfirmasi password</label>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-[21px] text-zinc-400" />
                  <input id="confirmation" type={showConfirmation ? 'text' : 'password'} required minLength={8}
                    autoComplete="new-password" placeholder="Ulangi password"
                    className={`${inputClass} pl-10 pr-12`} value={values.confirmation} onChange={e => update('confirmation', e.target.value)} />
                  <button type="button" aria-label="Tampilkan atau sembunyikan konfirmasi password"
                    className="absolute right-3 top-[18px] rounded-md p-1 text-zinc-400 hover:text-zinc-700"
                    onClick={() => setShowConfirmation(v => !v)}>
                    {showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</p>
            )}

            <button type="submit" disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5278E8] px-4 text-sm font-bold text-white transition hover:bg-[#344FA1] disabled:opacity-60">
              {submitting ? 'Memproses...' : registering ? 'Daftar & Masuk' : 'Login'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-500">
            {registering ? 'Sudah mendaftar?' : 'Belum punya akun?'}{' '}
            <Link className="font-bold text-[#5278E8] hover:underline" href={registering ? '/login' : '/register'}>
              {registering ? 'Masuk di sini' : 'Daftar sekarang'}
            </Link>
          </p>

          <div className="mt-7 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <ShieldCheck className="mt-0.5 shrink-0 text-green-700" size={20} />
            <div>
              <p className="text-xs font-bold text-green-950">Terhubung dengan Firebase</p>
              <p className="mt-1 text-xs leading-5 text-green-800">
                Autentikasi menggunakan Firebase Authentication dan profil pengguna disimpan di Cloud Firestore.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
