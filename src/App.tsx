import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import type { Trip } from './lib/trips'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { TripList } from './pages/TripList'

function AppContent() {
  const { user, loading } = useAuth()
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-500">Loading…</div>
  }

  if (!user) {
    return <Login />
  }

  if (!activeTrip) {
    return <TripList onSelect={setActiveTrip} />
  }

  return <Home trip={activeTrip} onBack={() => setActiveTrip(null)} />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
