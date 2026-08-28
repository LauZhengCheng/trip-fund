import { isIOS, isStandalone } from './platform'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/** iOS only exposes the Push API to a PWA that's been added to the home screen. */
export function isPushSupported(): boolean {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (isIOS() && !isStandalone()) return false
  return true
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  return (await registration.pushManager.getSubscription()) !== null
}

export async function subscribeToPush(memberId: string): Promise<void> {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this device/browser')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: memberId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: 'member_id,endpoint' },
  )
  if (error) throw error
}

export async function unsubscribeFromPush(memberId: string): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('member_id', memberId)
    .eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
