import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export function Login() {
  const { signInWithEmail, verifyEmailCode, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await signInWithEmail(email)
    if (error) {
      setErrorMessage(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setStatus('verifying')
    const { error } = await verifyEmailCode(email, code.trim())
    if (error) {
      setErrorMessage(error)
      setStatus('sent')
    }
    // On success, onAuthStateChange picks up the new session -- nothing else to do here.
  }

  async function handleGoogleClick() {
    const { error } = await signInWithGoogle()
    if (error) setErrorMessage(error)
    // On success the browser navigates away to Google, so nothing else to do here.
  }

  if (status === 'sent' || status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-neutral-600">
            We sent a code and a sign-in link to <span className="font-medium">{email}</span>.
          </p>
          <p className="text-sm text-neutral-500">
            If you're using the app from your home screen icon, tapping the link in the email
            won't work (it always opens your regular browser instead) — type the 6-digit code
            below instead.
          </p>
          <form onSubmit={handleVerify} className="space-y-3 text-left">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
            <button
              type="submit"
              disabled={status === 'verifying' || !code.trim()}
              className="w-full rounded-lg bg-neutral-900 py-2 font-medium text-white disabled:opacity-50"
            >
              {status === 'verifying' ? 'Checking…' : 'Verify code'}
            </button>
          </form>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Trip Fund</h1>

        <button
          type="button"
          onClick={handleGoogleClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-2 font-medium text-neutral-700"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          or
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg bg-neutral-900 text-white py-2 font-medium disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send sign-in code'}
          </button>
        </form>

        {status === 'error' && <p className="text-red-600 text-sm">{errorMessage}</p>}
      </div>
    </div>
  )
}
