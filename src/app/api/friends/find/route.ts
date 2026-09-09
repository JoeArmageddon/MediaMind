import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkRateLimit } from '@/lib/rateLimit';

// Clerk doesn't let client-side code resolve other users by email (privacy) -
// this route does the lookup server-side with the secret key, and only ever
// returns back the minimal profile fields the friends UI actually needs.
// It's deliberately not a general "search users" endpoint: exact-email-match
// only, one result, no ability to enumerate the user base.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // This endpoint is a found/not-found oracle by design (that's the whole
  // point of "add a friend by email") - rate limiting is what keeps it
  // from being usable to bulk-check whether arbitrary emails have
  // MediaMind accounts.
  const rl = checkRateLimit(`${userId}:friends-find`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many lookups - try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let email: string;
  try {
    const body = await req.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const { data: users } = await client.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    const found = users[0];
    if (!found) {
      return NextResponse.json({ error: 'No MediaMind user found with that email' }, { status: 404 });
    }

    if (found.id === userId) {
      return NextResponse.json({ error: "That's your own account" }, { status: 400 });
    }

    return NextResponse.json({
      id: found.id,
      name: [found.firstName, found.lastName].filter(Boolean).join(' ') || 'MediaMind user',
      email: found.emailAddresses[0]?.emailAddress ?? null,
      imageUrl: found.imageUrl,
    });
  } catch (error) {
    console.error('Friend lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
