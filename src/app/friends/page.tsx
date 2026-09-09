'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Users, Check, X, Trash2, Loader2, Library, Copy, RefreshCw, QrCode } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriendStore } from '@/store/friendStore';
import { cn } from '@/lib/utils';
import type { FriendshipWithProfile } from '@/types';

function Avatar({ user }: { user: FriendshipWithProfile['otherUser'] }) {
  const initial = user?.name?.[0]?.toUpperCase() || '?';
  if (user?.imageUrl) {
    return <img src={user.imageUrl} alt={user.name} className="w-11 h-11 rounded-full object-cover" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white font-bold">
      {initial}
    </div>
  );
}

function InviteCodeCard() {
  const { myInviteCode, isLoadingCode, fetchMyInviteCode, regenerateInviteCode } = useFriendStore();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    fetchMyInviteCode();
  }, [fetchMyInviteCode]);

  const link =
    myInviteCode && typeof window !== 'undefined' ? `${window.location.origin}/invite/${myInviteCode}` : '';

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable - not worth surfacing an
      // error for, the link is right there to select manually either way.
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Generate a new invite code? Your current code and link will stop working.')) return;
    setIsRegenerating(true);
    await regenerateInviteCode();
    setIsRegenerating(false);
  };

  return (
    <div className="glass-card rounded-[24px] p-6">
      <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
        <QrCode className="h-4 w-4" />
        Your invite code
      </h3>
      <p className="text-xs text-white/40 mb-4">
        Share your code, link, or QR code - anyone who has it connects with you instantly, no approval needed.
      </p>

      {isLoadingCode && !myInviteCode ? (
        <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-mono text-2xl font-black text-white tracking-[0.2em] mb-3">
              {myInviteCode}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleCopy}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button
                onClick={() => setShowQr((s) => !s)}
                size="sm"
                variant="outline"
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                {showQr ? 'Hide QR' : 'Show QR'}
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                size="sm"
                variant="ghost"
                className="text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          {showQr && link && (
            <div className="bg-white p-3 rounded-2xl shrink-0">
              <QRCodeSVG value={link} size={128} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    fetchFriends,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriendStore();

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleSend = async () => {
    if (!email.trim()) return;
    setIsSending(true);
    setFeedback(null);
    const result = await sendRequest(email.trim());
    setFeedback({ ok: result.success, text: result.message });
    if (result.success) setEmail('');
    setIsSending(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-white hover:bg-white/10 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">FRIENDS</h1>
          <p className="text-sm text-white/50 font-mono">友達</p>
        </div>
      </div>

      {/* Add friend */}
      <div className="glass-card rounded-[24px] p-6">
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add a friend
        </h3>
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Their email address"
            type="email"
            className="bg-black border-white/10 rounded-xl h-12 flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !email.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
        {feedback && (
          <p className={cn('text-sm mt-3', feedback.ok ? 'text-green-400' : 'text-red-400')}>
            {feedback.text}
          </p>
        )}
      </div>

      <InviteCodeCard />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-2xl h-auto">
          <TabsTrigger
            value="friends"
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <Users className="h-4 w-4 mr-2" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 relative"
          >
            Requests
            {incomingRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-600 text-white text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-6">
          {isLoading && friends.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/30 mx-auto animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No friends yet. Add someone by email above.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={f.otherUser} />
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {f.otherUser?.name ?? 'Unknown user'}
                      </p>
                      {f.otherUser?.email && (
                        <p className="text-xs text-white/40 truncate">{f.otherUser.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/friends/${f.otherUser?.id ?? ''}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                        title="View library"
                      >
                        <Library className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriend(f.id)}
                      className="text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                      title="Remove friend"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-6 space-y-6">
          <div>
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">
              Incoming ({incomingRequests.length})
            </h4>
            {incomingRequests.length === 0 ? (
              <p className="text-white/40 text-sm">No incoming requests.</p>
            ) : (
              <div className="grid gap-3">
                {incomingRequests.map((f) => (
                  <div
                    key={f.id}
                    className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={f.otherUser} />
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">
                          {f.otherUser?.name ?? 'Unknown user'}
                        </p>
                        {f.otherUser?.email && (
                          <p className="text-xs text-white/40 truncate">{f.otherUser.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="icon"
                        onClick={() => acceptRequest(f.id)}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                        title="Accept"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => declineRequest(f.id)}
                        className="text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                        title="Decline"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">
              Sent ({outgoingRequests.length})
            </h4>
            {outgoingRequests.length === 0 ? (
              <p className="text-white/40 text-sm">No outgoing requests.</p>
            ) : (
              <div className="grid gap-3">
                {outgoingRequests.map((f) => (
                  <div
                    key={f.id}
                    className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={f.otherUser} />
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">
                          {f.otherUser?.name ?? 'Unknown user'}
                        </p>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/50 mt-1">
                          Pending
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriend(f.id)}
                      className="text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl shrink-0"
                      title="Cancel request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
