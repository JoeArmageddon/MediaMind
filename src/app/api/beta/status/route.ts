import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { ADMIN_EMAIL } from '@/lib/admin';

// Called from /pending (see that page) - handles the "applied and got
// approved before ever signing up" case, which /api/beta/applications/
// [id]/review's approval step can't handle on its own (there's no Clerk
// user to flag yet at that point). Checks the CALLER's own email (never
// an arbitrary one) against beta_applications; if there's an approved row
// and their Clerk metadata isn't flagged yet, flags it now, so the very
// next request (this one redirecting them home) passes middleware's gate.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  if (user.emailAddresses.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL)) {
    return NextResponse.json({ approved: true });
  }
  if (user.publicMetadata?.betaApproved === true) {
    return NextResponse.json({ approved: true });
  }

  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) {
    return NextResponse.json({ approved: false });
  }

  try {
    const { data } = await getSupabaseAdmin()
      .from('beta_applications')
      .select('status')
      .eq('email', email)
      .maybeSingle();

    const approved = data?.status === 'approved';
    if (approved) {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, betaApproved: true },
      });
    }

    return NextResponse.json({ approved, hasApplied: !!data });
  } catch (error) {
    console.warn('beta status check failed:', error);
    return NextResponse.json({ approved: false });
  }
}
