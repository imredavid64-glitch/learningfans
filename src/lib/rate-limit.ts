import { headers } from "next/headers"

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const FIVE_MINUTES = 5 * 60 * 1000

export async function rateLimit(
  maxAttempts: number = 5,
  windowMs: number = FIVE_MINUTES,
): Promise<{ success: boolean; remaining: number }> {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip")
    || "unknown"

  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: maxAttempts - 1 }
  }

  if (entry.count >= maxAttempts) {
    return { success: false, remaining: 0 }
  }

  entry.count++
  return { success: true, remaining: maxAttempts - entry.count }
}

export function resetRateLimit(identifier?: string) {
  if (identifier) {
    store.delete(identifier)
  } else {
    store.clear()
  }
}
