import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

const DISMISSED_KEY = 'trip-fund-install-prompt-dismissed'

export function InstallPrompt() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (isIOS()) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-40 rounded-xl bg-neutral-900 p-3 text-sm text-white shadow-lg">
        <p>
          Install this app: open this page in <strong>Safari</strong>, tap the Share icon, then
          "Add to Home Screen". (Chrome on iOS can't install it — this only works in Safari.)
        </p>
        <button onClick={dismiss} className="mt-2 text-xs text-neutral-300 underline">
          Got it
        </button>
      </div>
    )
  }

  if (deferredPrompt) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-xl bg-neutral-900 p-3 text-sm text-white shadow-lg">
        <p>Install this app for quick access and offline use.</p>
        <div className="flex shrink-0 gap-2">
          <button onClick={dismiss} className="text-xs text-neutral-300 underline">
            Not now
          </button>
          <button
            onClick={handleInstallClick}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-900"
          >
            Install
          </button>
        </div>
      </div>
    )
  }

  return null
}
