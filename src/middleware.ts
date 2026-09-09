import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Everything requires sign-in except the auth pages and the invite-code
// landing page itself - a shared invite link has to be openable by someone
// who doesn't have an account yet (the page itself prompts sign-up/sign-in
// and preserves the code to redeem right after), so it can't sit behind
// the same gate as the rest of the app.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/invite/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
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
