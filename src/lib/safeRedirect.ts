// A `redirect_url`-style query param handed to an auth flow is a classic
// open-redirect vector: `?redirect_url=https://evil.example/phishing`
// would send a freshly-authenticated user straight to an attacker's site.
// Only ever accept a same-site relative path - anything absolute
// (`https://...`) or protocol-relative (`//evil.example`, which browsers
// resolve as absolute) is rejected outright.
export function safeRedirectPath(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}
