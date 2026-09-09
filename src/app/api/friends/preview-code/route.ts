import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Resolves an invite code to the inviter's public profile, for the
// "X invited you to connect - Accept?" landing page shown before the
// friendship is actually created. Unlike /api/friends/profiles (which
// only ever resolves ids that are already the other party in one of the
// caller's own friendship rows), no friendship exists yet at this point -
// legitimacy here comes from possessing the code itself, verified by the
// preview_friend_code Postgres function (SECURITY DEFINER, authenticated-
// only, and itself the only thing that can ever read the
// friend_invite_codes table for a row that isn't the caller's own).
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let code: string;
  try {
    const body = await req.json();
    code = typeof body.code === 'string' ? body.code.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'A code is required' }, { status: 400 });
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

    const { data: ownerId, error } = await supabase.rpc('preview_friend_code', { target_code: code });
    if (error || !ownerId) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    if (ownerId === userId) {
      return NextResponse.json({ error: "That's your own invite code" }, { status: 400 });
    }

    const client = await clerkClient();
    const found = await client.users.getUser(ownerId);

    return NextResponse.json({
      id: found.id,
      name: [found.firstName, found.lastName].filter(Boolean).join(' ') || 'MediaMind user',
      email: found.emailAddresses[0]?.emailAddress ?? null,
      imageUrl: found.imageUrl,
    });
  } catch (error) {
    console.error('Invite code preview failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
