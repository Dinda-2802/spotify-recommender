import SpotifyAnalyticsApp from '@/components/spotify/SpotifyAnalyticsApp'
import DashboardGate from '@/components/spotify/DashboardGate'
import { getSpotifyEngine } from '@/lib/spotify-engine'

export default function DashboardPage() {
  
  const initialOverview = getSpotifyEngine().overview()
  return (
    <DashboardGate>
      <SpotifyAnalyticsApp initialOverview={initialOverview} />
    </DashboardGate>
  )
}
