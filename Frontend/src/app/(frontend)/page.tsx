import SpotifyAnalyticsApp from '@/components/spotify/SpotifyAnalyticsApp'
import { getSpotifyEngine } from '@/lib/spotify-engine'

export default function HomePage() {
  const initialOverview = getSpotifyEngine().overview()
  return <SpotifyAnalyticsApp initialOverview={initialOverview} />
}
