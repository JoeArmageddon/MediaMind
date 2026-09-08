import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// friendships rows only carry Clerk user ids, not display info - this
// resolves ids to {name, email, imageUrl} for the friends UI. Deliberately
// NOT a general id->profile lookup: each requested id is checked against a
// Supabase query scoped to the caller's own RLS-protected session first, so
// this can only ever resolve ids that are actually the other party in one
// of the caller's own friendship rows.
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userIds: string[];
  try {
    const body = await req.json();
    userIds = Array.isArray(body.userIds)
      ? body.userIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (userIds.length === 0) {
    return NextResponse.json({ profiles: {} });
  }
  if (userIds.length > 100) {
    return NextResponse.json({ error: 'Too many ids requested' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const token = await getToken();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: rows, error } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) throw error;

    const legitimateIds = new Set<string>();
    for (const row of rows ?? []) {
      if (row.requester_id === userId) legitimateIds.add(row.addressee_id);
      if (row.addressee_id === userId) legitimateIds.add(row.requester_id);
    }

    const idsToFetch = userIds.filter((id) => legitimateIds.has(id));
    if (idsToFetch.length === 0) {
      return NextResponse.json({ profiles: {} });
    }

    const client = await clerkClient();
    const profiles: Record<
      string,
      { id: string; name: string; email: string | null; imageUrl: string | null }
    > = {};

    await Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const u = await client.users.getUser(id);
          profiles[id] = {
            id: u.id,
            name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'MediaMind user',
            email: u.emailAddresses[0]?.emailAddress ?? null,
            imageUrl: u.imageUrl,
          };
        } catch (e) {
          console.warn('Failed to fetch profile for', id, e);
        }
      })
    );

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Friend profile lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
