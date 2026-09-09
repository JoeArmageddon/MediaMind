import { callWebApiGet } from './webApi';

// Mirrors web's GET /api/beta/status (see src/app/api/beta/status/route.ts)
// - same Clerk publicMetadata.betaApproved flag is the single source of
// truth, checked here instead of reimplementing the beta_applications
// lookup on mobile (that table has zero RLS policies; only the deployed
// web app's service-role client can read it). Calling this route also
// self-heals the "approved before ever signing up" case, same as web.
export interface BetaStatus {
  approved: boolean;
  hasApplied?: boolean;
}

export async function checkBetaStatus(): Promise<BetaStatus> {
  try {
    const res = await callWebApiGet('/api/beta/status', {});
    if (!res.ok) return { approved: false };
    const json = await res.json();
    return { approved: json?.approved === true, hasApplied: !!json?.hasApplied };
  } catch {
    // Fail closed, same as the route's own catch block on web - a
    // network hiccup shouldn't silently grant access to a beta gate.
    return { approved: false };
  }
}
