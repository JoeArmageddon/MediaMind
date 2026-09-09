import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { ADMIN_EMAIL } from '@/lib/admin';

// Admin-only: approve or reject one application. On approval, if the
// applicant already has a Clerk account (they signed up and are sitting
// on /pending), their publicMetadata.betaApproved is set immediately so
// the middleware gate (src/middleware.ts) lets them in on their next
// request - no separate sync step needed. If they haven't signed up yet,
// there's nothing to flag yet; /pending checks and syncs this itself the
// moment they do (see /api/beta/status).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await clerkClient();
  const adminUser = await client.users.getUser(userId);
  const isAdmin = adminUser.emailAddresses.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let decision: 'approved' | 'rejected';
  let reviewNote: string | null;
  try {
    const body = await req.json();
    if (body.decision !== 'approved' && body.decision !== 'rejected') {
      return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
    }
    decision = body.decision;
    reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim() || null : null;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  try {
    const { data: application, error: updateError } = await admin
      .from('beta_applications')
      .update({ status: decision, review_note: reviewNote, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('email')
      .single();

    if (updateError || !application) {
      throw updateError ?? new Error('Application not found');
    }

    if (decision === 'approved') {
      // Best-effort: if they've already signed up, flag them approved
      // right away. If not, nothing to do yet - covered on their first
      // sign-in instead (see /api/beta/sync-approval).
      try {
        const { data: existingUsers } = await client.users.getUserList({
          emailAddress: [application.email],
          limit: 1,
        });
        const existing = existingUsers[0];
        if (existing) {
          await client.users.updateUserMetadata(existing.id, {
            publicMetadata: { ...existing.publicMetadata, betaApproved: true },
          });
        }
      } catch (e) {
        console.warn('Failed to sync betaApproved metadata on approval (non-fatal):', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to review beta application:', error);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }
}
