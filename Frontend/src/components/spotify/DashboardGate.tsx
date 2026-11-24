
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase'

export default function DashboardGate({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAllowed(true)
      } else {
        setAllowed(false)
        router.replace('/login')
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  if (loading || !allowed) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F6F7FC] px-5 text-center">
        <div
          role="status"
          className="rounded-2xl border border-zinc-200 bg-white px-8 py-7 text-sm font-medium text-zinc-600 shadow-sm"
        >
          Memeriksa login Firebase...
        </div>
      </main>
    )
  }

  return <>{children}</>
}
