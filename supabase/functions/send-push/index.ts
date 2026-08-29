// Sends Web Push notifications to a trip's subscribers.
// Called only by Postgres (pg_cron -> pg_net), never by the browser directly --
// auth is a shared secret header, not a Supabase JWT (see x-cron-secret below).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const PUSH_CONTACT_EMAIL = Deno.env.get('PUSH_CONTACT_EMAIL')!
const PUSH_CRON_SECRET = Deno.env.get('PUSH_CRON_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(`mailto:${PUSH_CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const CURRENCY_SYMBOLS: Record<string, string> = { MYR: 'RM', IDR: 'Rp' }

function formatMinor(minor: number, exponent: number): string {
  const value = minor / 10 ** exponent
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value)
}

type ActivityPayload = {
  type: 'activity'
  trip_id: string
  event_count: number
  summaries: string[]
  exclude_member_ids?: string[]
}

type DailyPayload = {
  type: 'daily'
  trip_id: string
  wallet_label: string
  currency: string
  exponent: number
  spent_today_minor: number
  contributed_today_minor: number
  balance_minor: number
}

type Payload = ActivityPayload | DailyPayload

function buildMessage(payload: Payload, tripName: string): { title: string; body: string } {
  if (payload.type === 'daily') {
    const symbol = CURRENCY_SYMBOLS[payload.currency] ?? payload.currency
    const balance = formatMinor(payload.balance_minor, payload.exponent)
    const spent = formatMinor(payload.spent_today_minor, payload.exponent)
    const contributedPart =
      payload.contributed_today_minor > 0
        ? `, +${symbol} ${formatMinor(payload.contributed_today_minor, payload.exponent)} contributed`
        : ''
    return {
      title: `${payload.wallet_label} — today`,
      body: `Spent ${symbol} ${spent}${contributedPart}. Balance: ${symbol} ${balance}.`,
    }
  }

  const [first, ...rest] = payload.summaries
  const body = rest.length > 0 ? `${first} (+${rest.length} more update${rest.length === 1 ? '' : 's'})` : first
  return { title: tripName, body }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== PUSH_CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = (await req.json()) as Payload
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let tripName = 'Trip Fund'
  if (payload.type === 'activity') {
    const { data: trip } = await supabase.from('trips').select('name').eq('id', payload.trip_id).single()
    if (trip?.name) tripName = trip.name
  }
  const { title, body } = buildMessage(payload, tripName)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, member_id, members!inner(trip_id)')
    .eq('members.trip_id', payload.trip_id)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const excludeIds = new Set('exclude_member_ids' in payload ? (payload.exclude_member_ids ?? []) : [])
  const targets = (subs ?? []).filter((s) => !excludeIds.has(s.member_id))

  const results = await Promise.allSettled(
    targets.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url: '/' }),
      ),
    ),
  )

  const staleIds: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const statusCode = (r.reason as { statusCode?: number } | undefined)?.statusCode
      if (statusCode === 404 || statusCode === 410) staleIds.push(targets[i].id)
    }
  })
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  return new Response(
    JSON.stringify({
      sent: targets.length - results.filter((r) => r.status === 'rejected').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      removedStale: staleIds.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
