import { AuthProvider, useAuth } from './lib/auth'
import { Login } from './pages/Login'

function AppContent() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Logged in as <span className="font-medium text-neutral-900">{user.email}</span>
        </p>
        <button onClick={() => signOut()} className="text-sm text-neutral-500 underline">
          Sign out
        </button>
      </div>
    </div>
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
