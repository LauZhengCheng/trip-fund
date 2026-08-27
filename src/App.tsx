import { useEffect, useState } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { AuthProvider, useAuth } from './lib/auth'
import { errorMessage } from './lib/errors'
import { acceptInvite } from './lib/invites'
import type { Trip } from './lib/trips'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { TripList } from './pages/TripList'

function AppContent() {
  const { user, loading } = useAuth()
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    if (!user) return
    const inviteId = new URLSearchParams(window.location.search).get('invite')
    if (!inviteId) return

    setInvitePending(true)
    acceptInvite(inviteId)
      .then((trip) => setActiveTrip(trip))
      .catch((err) => setInviteError(errorMessage(err, 'This invite link is invalid or has been revoked.')))
      .finally(() => {
        setInvitePending(false)
        window.history.replaceState({}, '', window.location.pathname)
      })
  }, [user])

  if (loading || invitePending) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-500">Loading…</div>
  }

  const page = !user ? (
    <Login />
  ) : !activeTrip ? (
    <TripList onSelect={setActiveTrip} bannerError={inviteError} />
  ) : (
    <Home trip={activeTrip} onBack={() => setActiveTrip(null)} />
  )

  return (
    <>
      {page}
      <InstallPrompt />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
