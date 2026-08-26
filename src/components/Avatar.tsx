import { useAuth } from '../lib/auth'

/**
 * Shows the signed-in account so it's obvious whose login is active on this
 * device. Falls back to an initial-letter circle for Magic Link (no photo);
 * once Google login lands, user_metadata.avatar_url is populated by Supabase
 * automatically and this switches to the real Google avatar with no code change.
 */
export function Avatar() {
  const { user } = useAuth()
  if (!user) return null

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const label = (user.user_metadata?.full_name as string | undefined) || user.email || '?'
  const initial = label.charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label}
        title={user.email ?? undefined}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <div
      title={user.email ?? undefined}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-white"
    >
      {initial}
    </div>
  )
}
