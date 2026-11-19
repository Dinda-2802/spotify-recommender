'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getDemoSession } from '../../lib/demo-auth'

/** PENGALIHAN UI demo saja; belum merupakan keamanan route/server. */
export default function DashboardGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (getDemoSession()) setAllowed(true)
    else router.replace('/login')
  }, [router])

  if (!allowed) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F6F7FC] px-5 text-center">
        <div role="status" className="rounded-2xl border border-zinc-200 bg-white px-8 py-7 text-sm font-medium text-zinc-600 shadow-sm">
          Memeriksa akses pratinjau...
        </div>
      </main>
    )
  }
  return <>{children}</>
}
