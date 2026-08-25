/**
 * `err instanceof Error` alone isn't reliable for Supabase errors in every case
 * (e.g. a plain object thrown from a rejected fetch), so pull `.message` off
 * whatever we get before falling back to a generic string.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
