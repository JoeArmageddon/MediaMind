import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { ADMIN_EMAIL } from '@/lib/admin';

// Admin-only: list beta applications for review. beta_applications has no
// RLS policies, so authorization happens entirely here - the caller must
// be signed in as the one hardcoded admin account.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAdmin = user.emailAddresses.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get('status');

  try {
    let query = getSupabaseAdmin()
      .from('beta_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ applications: data ?? [] });
  } catch (error) {
    console.error('Failed to list beta applications:', error);
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 });
  }
}
