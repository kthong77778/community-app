// A tiny in-memory sliding-window rate limiter.
//
// Good enough for a single server instance. For a multi-instance deployment,
// back this with Redis (or a similar shared store) so limits are enforced
// across instances — the interface below is intentionally small so that swap
// is easy.

interface Bucket {
  hits: number[]; // timestamps (ms) within the window
}

const buckets = new Map<string, Bucket>();

// Periodically drop empty buckets so the map does not grow unbounded.
let lastSweep = 0;
function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < now - windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number; // seconds until the next attempt is allowed (0 if allowed)
}

// Records an attempt for `key` and returns whether it is allowed.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop hits outside the window.
  bucket.hits = bucket.hits.filter((t) => t > now - windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

// Best-effort client IP from proxy headers (works behind Vercel/nginx).
export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
