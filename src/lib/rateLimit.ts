// A deliberately simple in-memory fixed-window rate limiter for API
// routes, keyed by Clerk user id (every route this guards already
// requires auth, so "per authenticated user" is both more meaningful and
// more robust than per-IP - it isn't defeated by shared/NAT'd IPs, and a
// beta tester's Clerk account isn't a trivially disposable identity the
// way an IP address is).
//
// Known, accepted limitation: this Map lives in one serverless function
// instance's memory, not a shared store. Vercel can run multiple warm
// instances of the same route concurrently, and any instance restart
// (cold start, redeploy) resets its counters to zero. That means the
// *actual* enforced ceiling under real concurrent traffic is
// "roughly limit, per warm instance" rather than a hard global cap - not
// a substitute for a real distributed limiter (Upstash Redis, Vercel KV),
// but it still meaningfully raises the bar against casual scripted abuse
// for a ~100-150 person beta, which is the actual threat model right now.
// Worth revisiting with real infrastructure if the user base grows.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep expired buckets occasionally so this Map doesn't grow forever
// across a long-lived warm instance - not on every call, to keep the
// common path cheap.
let lastSweep = Date.now();
function sweepIfDue() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key Unique identifier for the caller+route, e.g. `${userId}:friends-find`.
 * @param limit Max requests allowed within the window.
 * @param windowMs Window length in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  sweepIfDue();
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
