'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDemoSession } from '../../lib/demo-auth'

const SPLASH_DURATION_MS = 5000

export default function SplashScreen() {
  const router = useRouter()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(getDemoSession() ? '/dashboard' : '/login')
    }, SPLASH_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [router])

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#202A44] px-6 py-10 text-center text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#526FE1]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#A78BFA]/20 blur-3xl" />
      <div className="relative flex w-full max-w-md flex-col items-center" role="status" aria-live="polite">
        <div className="mb-8 flex h-48 w-48 items-center justify-center overflow-hidden rounded-[2.5rem] bg-white p-4 shadow-[0_18px_70px_rgba(4,13,42,0.35)] sm:h-56 sm:w-56">
          <Image
            src="/music-analytics-logo.jpeg"
            alt="Logo Ritmelika: simbol musik ungu biru"
            width={224}
            height={200}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-[#C4B5FD]">Big Data · Kelompok 5</p>
        <h1 className="text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">Ritmelika</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-[#C0C9E4]">
          Analisis clustering dan rekomendasi lagu berdasarkan kemiripan fitur audio.
        </p>
        <div className="mt-10 w-64 max-w-full" aria-label="Memuat aplikasi, sekitar enam detik">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#455579]">
            <div className="splash-progress-bar h-full rounded-full bg-gradient-to-r from-[#A78BFA] to-[#75C9E7]" />
          </div>
          <p className="mt-4 text-xs font-medium text-[#B5C2E2]">Menyiapkan Ritmelika ...</p>
        </div>
      </div>
      <style jsx>{`
        @keyframes splash-progress { from { width: 0%; } to { width: 100%; } }
        .splash-progress-bar { width: 0; animation: splash-progress 6s linear forwards; }
      `}</style>
    </main>
  )
}
