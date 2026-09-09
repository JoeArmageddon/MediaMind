'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Loader2, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Where a signed-in-but-not-yet-approved account lands (see the redirect
// in middleware.ts). Excluded from the approval gate itself so it can't
// redirect to itself. Polls /api/beta/status - that route both checks and
// (if a matching approved application exists) syncs Clerk's
// publicMetadata.betaApproved, which is what actually lets middleware
// through afterward.
export default function PendingPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [checking, setChecking] = useState(false);
  const [hasApplied, setHasApplied] = useState<boolean | null>(null);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/beta/status');
      if (!res.ok) return;
      const body = await res.json();
      setHasApplied(!!body.hasApplied);
      if (body.approved) {
        router.replace('/');
      }
    } catch {
      // Quiet - this is a background poll, not a user-initiated action.
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    checkStatus();
    // Check periodically in case an admin approves while this tab is open,
    // rather than only ever on manual refresh.
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto text-indigo-400">
          <Clock className="h-7 w-7" />
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tighter">You&apos;re on the list</h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed">
            MediaMind is in a small, invite-only beta right now. Your account is signed in but not
            yet approved.
          </p>
        </div>

        {hasApplied === false && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            We don&apos;t see an application for this email yet -{' '}
            <a href="/apply" className="text-indigo-400 hover:opacity-80">
              apply here
            </a>{' '}
            and we&apos;ll review it.
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={checkStatus} disabled={checking} variant="outline">
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Check again
              </>
            )}
          </Button>
          <Button onClick={() => signOut({ redirectUrl: '/sign-in' })} variant="ghost">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
