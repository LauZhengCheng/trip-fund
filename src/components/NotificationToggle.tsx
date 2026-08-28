import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { isIOS, isStandalone } from '../lib/platform'
import { isPushSupported, isSubscribedToPush, pushPermission, subscribeToPush, unsubscribeFromPush } from '../lib/push'

export function NotificationToggle({ memberId }: { memberId: string | null }) {
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    isSubscribedToPush().then(setSubscribed)
  }, [])

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
        className="text-xs text-neutral-400 underline disabled:opacity-50"
      >
        {blocked ? 'Notifications blocked' : subscribed ? 'Notifications: On' : 'Turn on notifications'}
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
