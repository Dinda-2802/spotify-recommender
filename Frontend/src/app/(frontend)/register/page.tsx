import type { Metadata } from 'next'
import AuthPreviewForm from '@/components/spotify/AuthPreviewForm'

export const metadata: Metadata = { title: 'Registrasi | Spotify Analytics' }

export default function RegistrasiPage() {
  return <AuthPreviewForm mode="register" />
}
