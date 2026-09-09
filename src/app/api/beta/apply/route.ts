import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { checkRateLimit } from '@/lib/rateLimit';

// Public route (no auth - the whole point is someone applying before
// they have an account). beta_applications has zero RLS policies, so
// this uses the service-role admin client and does its own validation.
export async function POST(req: NextRequest) {
  // The one legitimate case for IP-based limiting in this app - every
  // other rate-limited route already requires a signed-in user to key
  // on. x-forwarded-for's first entry is the original client per
  // Vercel's docs; falls back to a shared bucket if it's ever absent
  // rather than skipping the limit entirely.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(`beta-apply:${ip}`, 5, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many applications from this connection - try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const lastFinished = typeof body.lastFinished === 'string' ? body.lastFinished.trim() : '';
  const currentTracking = typeof body.currentTracking === 'string' ? body.currentTracking.trim() : '';
  const whyInterested = typeof body.whyInterested === 'string' ? body.whyInterested.trim() : '';

  if (!email || !email.includes('@') || email.length > 200) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'Your name is required' }, { status: 400 });
  }
  for (const [field, value] of [
    ['lastFinished', lastFinished],
    ['currentTracking', currentTracking],
    ['whyInterested', whyInterested],
  ] as const) {
    if (!value) {
      return NextResponse.json({ error: 'Please answer every question' }, { status: 400 });
    }
    if (value.length > 1000) {
      return NextResponse.json({ error: `That answer is too long (${field})` }, { status: 400 });
    }
  }

  try {
    const { error } = await getSupabaseAdmin().from('beta_applications').insert({
      email,
      name,
      last_finished: lastFinished,
      current_tracking: currentTracking,
      why_interested: whyInterested,
    });

    if (error) {
      // Unique violation on email - already applied. Not an error worth
      // alarming them over.
      if (error.code === '23505') {
        return NextResponse.json({
          success: true,
          message: "You've already applied with this email - we'll be in touch.",
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Application received - we\'ll review it soon.' });
  } catch (error) {
    console.error('Beta application submission failed:', error);
    return NextResponse.json({ error: 'Failed to submit your application. Try again shortly.' }, { status: 500 });
  }
}
