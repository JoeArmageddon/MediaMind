import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { ADMIN_EMAIL } from '@/lib/admin';

// Everything requires sign-in except the auth pages, the invite-code
// landing pages, and the beta application form itself - a shared invite
// link (or the application form) has to be openable by someone who
// doesn't have an account yet, so it can't sit behind the same gate as
// the rest of the app.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite/(.*)',
  '/collection-invite/(.*)',
  '/privacy',
  '/apply',
  '/api/beta/apply',
]);

// /pending is the waiting-room page itself (must never redirect to
// itself) and every other /api/beta/* route does its own authorization
// (the admin-review routes check ADMIN_EMAIL; /api/beta/status is how a
// pending user's approval actually gets checked/synced, so it has to
// stay reachable while still pending) - excluded from the beta-approval
// redirect below, though still behind the plain auth.protect() sign-in
// requirement everything else has.
const isExemptFromApprovalGate = createRouteMatcher(['/pending', '/api/beta/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth.protect();

  // The beta-approval gate only applies to actual pages, not every API
  // route - each API route already has its own auth (and, for anything
  // that touches real data, RLS scoped to that one account) regardless
  // of beta status. Known, accepted gap: a signed-up-but-not-yet-approved
  // account could still call e.g. /api/ai/gemini directly and consume
  // some of the shared default-key quota before being approved - real,
  // but low-severity (still requires an actual Clerk account, still
  // rate-limited per user) and not worth the extra Clerk lookup on every
  // single API call to close for a beta this size.
  if (req.nextUrl.pathname.startsWith('/api/') || isExemptFromApprovalGate(req)) {
    return;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAdmin = user.emailAddresses.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL);
  const isApproved = isAdmin || user.publicMetadata?.betaApproved === true;

  if (!isApproved) {
    return NextResponse.redirect(new URL('/pending', req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
