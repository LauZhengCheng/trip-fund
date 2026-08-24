import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export function Login() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
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

  if (status === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2">Check your email</h1>
          <p className="text-neutral-600">
            We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on
            this device to continue.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Trip Fund</h1>
        <input
          type="email"
          required
          autoFocus
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
          {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
        </button>
        {status === 'error' && <p className="text-red-600 text-sm">{errorMessage}</p>}
      </form>
    </div>
  )
}
