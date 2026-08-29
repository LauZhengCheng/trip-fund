import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { isIOS, isStandalone } from '../lib/platform'
import { isPushSupported, isSubscribedToPush, pushPermission, subscribeToPush, unsubscribeFromPush } from '../lib/push'

const AUTO_ASKED_KEY = 'trip-fund-notification-auto-asked'

function BellIcon({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c-3.3 0-6 2.7-6 6v5l-1.6 2.4c-.3.4 0 1 .5 1h14.2c.5 0 .8-.6.5-1L18 13V8c0-3.3-2.7-6-6-6z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0h-5z" />
      {muted && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}

export function NotificationToggle({ memberId }: { memberId: string | null }) {
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    isSubscribedToPush().then(setSubscribed)
  }, [])

  // Notifications default to "on": the first time this device sees this
  // trip, try to subscribe without waiting for a tap. If the permission is
  // already granted from a prior visit this is silent and just works; if
  // it's still undecided, the browser's own prompt appears. Either way we
  // only attempt this once per device -- if they dismiss/deny it, the bell
  // just sits in its "off" state instead of nagging on every visit.
  useEffect(() => {
    if (!memberId || !isPushSupported()) return
    if (localStorage.getItem(AUTO_ASKED_KEY) === '1') return
    localStorage.setItem(AUTO_ASKED_KEY, '1')
    if (Notification.permission === 'denied') return
    subscribeToPush(memberId)
      .then(() => setSubscribed(true))
      .catch(() => {})
  }, [memberId])

  if (!memberId) return null

  if (!isPushSupported()) {
    if (isIOS() && !isStandalone()) {
      return (
        <p className="mt-1 text-xs text-neutral-400">
          Add this app to your home screen to turn on notifications.
        </p>
      )
    }
    return null
  }

  async function handleToggle() {
    if (!memberId) return
    setBusy(true)
    setError('')
    try {
      if (subscribed) {
        await unsubscribeFromPush(memberId)
        setSubscribed(false)
      } else {
        await subscribeToPush(memberId)
        setSubscribed(true)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const blocked = pushPermission() === 'denied'

  return (
    <div className="mt-1">
      <button
        onClick={handleToggle}
        disabled={busy || blocked}
        title={blocked ? 'Notifications blocked' : subscribed ? 'Notifications on — tap to turn off' : 'Turn on notifications'}
        className={`inline-flex items-center justify-center rounded-full p-1.5 disabled:opacity-40 ${
          subscribed ? 'text-neutral-900' : 'text-neutral-300'
        }`}
      >
        <BellIcon muted={!subscribed} className="h-5 w-5" />
      </button>
      {blocked && (
        <p className="mt-0.5 text-xs text-neutral-400">
          You blocked notifications for this app. Turn them back on in your phone's browser settings.
        </p>
      )}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
