import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  verifyEmailCode: (email: string, token: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Origin + path + query string, deliberately WITHOUT the hash fragment.
 * A previous OAuth/magic-link redirect can leave #access_token=... sitting in
 * the address bar; using window.location.href directly would carry that
 * leftover fragment into the *next* redirectTo, which then comes back even
 * bigger and eventually too malformed for the client to parse. The query
 * string is kept so a `?invite=...` link survives the round trip; the hash
 * never holds anything we intentionally put there, so it's always safe to drop.
 */
function currentUrlWithoutAuthFragment(): string {
  return window.location.origin + window.location.pathname + window.location.search
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: currentUrlWithoutAuthFragment() },
    })
    return { error: error?.message ?? null }
  }

  /**
   * The emailed link only ever opens in the phone's regular browser, never in
   * a home-screen-installed PWA (separate storage container, no way around
   * it) -- so a code the user can type directly into whichever context
   * they're actually using is the only way sign-in reliably works there.
   * `signInWithOtp` already put the same code in the email as the link.
   */
  async function verifyEmailCode(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return { error: error?.message ?? null }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: currentUrlWithoutAuthFragment(),
        // Without this, Google silently reuses whichever account already has
        // an active session on the device instead of showing the picker --
        // fine for a family member with only their own account, but it's
        // what makes it impossible to test-switch between accounts here.
        queryParams: { prompt: 'select_account' },
      },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        loading,
        signInWithEmail,
        verifyEmailCode,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
