'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { Loader2, Users, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFriendStore } from '@/store/friendStore';
import type { InvitePreview } from '@/store/friendStore';

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { previewInviteCode, redeemInviteCode } = useFriendStore();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !code) return;
    setIsPreviewing(true);
    previewInviteCode(code).then((result) => {
      if (result.success && result.profile) {
        setPreview(result.profile);
      } else {
        setError(result.message || 'This invite link is invalid or has expired.');
      }
      setIsPreviewing(false);
    });
  }, [isLoaded, isSignedIn, code, previewInviteCode]);

  const handleAccept = async () => {
    setIsRedeeming(true);
    setError(null);
    const result = await redeemInviteCode(code);
    if (result.success) {
      setRedeemed(true);
      setTimeout(() => router.push('/friends'), 1200);
    } else {
      setError(result.message);
    }
    setIsRedeeming(false);
  };

  const redirectTarget = `/invite/${code}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-4">
      <div className="w-full max-w-sm glass-card rounded-[28px] p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/20">
          <Users className="h-6 w-6 text-white" />
        </div>

        {!isLoaded ? (
          <Loader2 className="h-6 w-6 text-white/30 mx-auto animate-spin" />
        ) : !isSignedIn ? (
          <>
            <h1 className="text-xl font-black text-white tracking-tight mb-2">You&apos;ve been invited</h1>
            <p className="text-sm text-white/50 mb-6">
              Sign in or create an account to connect on MediaMind.
            </p>
            <div className="space-y-2">
              <Link href={`/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`} className="block">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12">
                  Create an account
                </Button>
              </Link>
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`} className="block">
                <Button variant="ghost" className="w-full text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-12">
                  I already have an account
                </Button>
              </Link>
            </div>
          </>
        ) : redeemed ? (
          <>
            <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight mb-1">Connected!</h1>
            <p className="text-sm text-white/50">Taking you to your friends...</p>
          </>
        ) : isPreviewing ? (
          <Loader2 className="h-6 w-6 text-white/30 mx-auto animate-spin" />
        ) : error ? (
          <>
            <h1 className="text-xl font-black text-white tracking-tight mb-2">Invite not valid</h1>
            <p className="text-sm text-white/50 mb-6">{error}</p>
            <Link href="/friends">
              <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl">
                Go to Friends
              </Button>
            </Link>
          </>
        ) : preview ? (
          <>
            {preview.imageUrl ? (
              <img
                src={preview.imageUrl}
                alt={preview.name}
                className="w-16 h-16 rounded-full object-cover mx-auto mb-4 border-2 border-white/10"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                {preview.name[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <h1 className="text-xl font-black text-white tracking-tight mb-1">{preview.name}</h1>
            <p className="text-sm text-white/50 mb-6">invited you to connect on MediaMind.</p>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <Button
              onClick={handleAccept}
              disabled={isRedeeming}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12"
            >
              {isRedeeming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Accept &amp; Connect
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
