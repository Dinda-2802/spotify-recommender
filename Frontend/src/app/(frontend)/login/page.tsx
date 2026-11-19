import type { Metadata } from 'next'
import AuthPreviewForm from '@/components/spotify/AuthPreviewForm'

export const metadata: Metadata = { title: 'Login | Spotify Analytics' }

export default function LoginPage() {
  return <AuthPreviewForm mode="login" />
}
