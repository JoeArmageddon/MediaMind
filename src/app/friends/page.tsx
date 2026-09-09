'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  UserPlus,
  Users,
  Check,
  X,
  Trash2,
  Loader2,
  Library,
  Copy,
  RefreshCw,
  QrCode,
  Inbox,
  Send,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriendStore } from '@/store/friendStore';
import { useRecommendationStore } from '@/store/recommendationStore';
import { useMediaStore } from '@/store/mediaStore';
import { cn, getTypeLabel } from '@/lib/utils';
import type { FriendshipWithProfile, RecommendationWithProfile } from '@/types';

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
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    fetchMyInviteCode();
  }, [fetchMyInviteCode]);

  const link =
    myInviteCode && typeof window !== 'undefined' ? `${window.location.origin}/invite/${myInviteCode}` : '';

  const copy = async (value: string, which: 'link' | 'code') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API can be denied/unavailable - not worth surfacing an
      // error for, the value is right there to select manually either way.
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
      <h3 className="text-sm font-bold text-[var(--mm-text-70)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <QrCode className="h-4 w-4" />
        Your invite code
      </h3>
      <p className="text-xs text-[var(--mm-text-40)] mb-4">
        Share your code, link, or QR code - anyone who has it connects with you instantly, no approval needed.
      </p>

      {isLoadingCode && !myInviteCode ? (
        <Loader2 className="h-5 w-5 text-[var(--mm-text-30)] animate-spin" />
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <button
              onClick={() => copy(myInviteCode ?? '', 'code')}
              title="Copy code"
              className="group flex items-center gap-2 mb-3 -ml-1 px-1 rounded-lg hover:bg-[var(--mm-hover-bg)] transition-colors"
            >
              <span className="font-mono text-2xl font-black text-[var(--mm-text)] tracking-[0.2em]">{myInviteCode}</span>
              {copied === 'code' ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-[var(--mm-text-30)] group-hover:text-[var(--mm-text-60)]" />
              )}
            </button>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => copy(link, 'link')}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {copied === 'link' ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
              <Button
                onClick={() => setShowQr((s) => !s)}
                size="sm"
                variant="outline"
                className="border-[var(--mm-card-border)] text-[var(--mm-text-70)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-lg"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                {showQr ? 'Hide QR' : 'Show QR'}
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                size="sm"
                variant="ghost"
                className="text-[var(--mm-text-40)] hover:text-red-400 hover:bg-red-500/10 rounded-lg"
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

function RecommendationCard({
  rec,
  direction,
  onAdd,
  onDismiss,
  isAdding,
  added,
}: {
  rec: RecommendationWithProfile;
  direction: 'received' | 'sent';
  onAdd?: () => void;
  onDismiss: () => void;
  isAdding?: boolean;
  added?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 flex gap-3">
      {rec.poster_url ? (
        <img src={rec.poster_url} alt={rec.title} className="w-12 h-16 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-12 h-16 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
          {rec.title[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[var(--mm-text)] font-semibold truncate">{rec.title}</p>
            <p className="text-[10px] text-[var(--mm-text-40)] uppercase tracking-wide">
              {getTypeLabel(rec.type)}
              {rec.release_year ? ` - ${rec.release_year}` : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="text-[var(--mm-text-30)] hover:text-red-400 hover:bg-red-500/10 rounded-lg h-7 w-7 shrink-0"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-[var(--mm-text-40)] mt-1">
          {direction === 'received' ? 'From ' : 'To '}
          {rec.otherUser?.name ?? 'Unknown user'}
        </p>
        {rec.message && <p className="text-sm text-[var(--mm-text-70)] mt-1.5 italic">&quot;{rec.message}&quot;</p>}
        {direction === 'received' && (
          <Button
            size="sm"
            onClick={onAdd}
            disabled={isAdding || added}
            className={cn(
              'rounded-lg text-xs mt-2',
              added ? 'bg-green-600 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : added ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Added
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add to Library
              </>
            )}
          </Button>
        )}
      </div>
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
    redeemInviteCode,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriendStore();
  const { inbox, sent, fetchInbox, fetchSent, markRead, dismiss: dismissRecommendation } = useRecommendationStore();
  const { addMedia } = useMediaStore();

  const [codeInput, setCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('friends');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInbox();
    fetchSent();
  }, [fetchInbox, fetchSent]);

  // Mark the inbox read once its tab is actually opened, not on page load -
  // the unread badge should stay visible until the recipient has actually
  // looked, same reasoning as the Requests tab's badge.
  useEffect(() => {
    if (activeTab !== 'recommendations') return;
    const unread = inbox.filter((r) => !r.is_read);
    if (unread.length === 0) return;
    unread.forEach((r) => markRead(r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleAddRecommendation = async (rec: RecommendationWithProfile) => {
    setAddingId(rec.id);
    try {
      await addMedia({
        title: rec.title,
        normalized_title: rec.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
        type: rec.type,
        poster_url: rec.poster_url,
        backdrop_url: null,
        description: rec.description,
        release_year: rec.release_year,
        api_rating: rec.api_rating,
        genres: rec.genres,
        tags: [],
        studios: [],
        total_units: 0,
        progress: 0,
        completion_percent: 0,
        status: 'planned',
        is_favorite: false,
        is_archived: false,
        notes: null,
        user_rating: null,
        streaming_platforms: [],
        ai_primary_tone: null,
        ai_secondary_tone: null,
        ai_core_themes: [],
        ai_emotional_intensity: null,
        ai_pacing: null,
        ai_darkness_level: null,
        ai_intellectual_depth: null,
        completed_at: null,
        tmdb_id: rec.tmdb_id,
        mal_id: rec.mal_id,
        rawg_id: rec.rawg_id,
        google_books_id: rec.google_books_id,
      });
      setAddedIds((prev) => new Set(prev).add(rec.id));
    } catch (e) {
      // A 23505 (already in your library) is the common case here - not
      // worth a scary error, the item's already where they wanted it.
      console.warn('Failed to add recommended title:', e);
      setAddedIds((prev) => new Set(prev).add(rec.id));
    } finally {
      setAddingId(null);
    }
  };

  const unreadCount = inbox.filter((r) => !r.is_read).length;

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleRedeem = async () => {
    if (!codeInput.trim()) return;
    setIsRedeeming(true);
    setFeedback(null);
    const result = await redeemInviteCode(codeInput.trim().toUpperCase());
    setFeedback({ ok: result.success, text: result.message });
    if (result.success) setCodeInput('');
    setIsRedeeming(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-[var(--mm-text)] tracking-tighter">FRIENDS</h1>
          <p className="text-sm text-[var(--mm-text-50)] font-mono">友達</p>
        </div>
      </div>

      {/* Add friend by code */}
      <div className="glass-card rounded-[24px] p-6">
        <h3 className="text-sm font-bold text-[var(--mm-text-70)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add a friend
        </h3>
        <div className="flex gap-2">
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
            placeholder="Enter their invite code"
            className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-12 flex-1 font-mono uppercase tracking-widest placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
          />
          <Button
            onClick={handleRedeem}
            disabled={isRedeeming || !codeInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
          >
            {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
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
        <TabsList className="grid w-full grid-cols-3 bg-[var(--mm-hover-bg)] p-1 rounded-2xl h-auto">
          <TabsTrigger
            value="friends"
            className="rounded-xl py-3 text-xs sm:text-sm data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]"
          >
            <Users className="h-4 w-4 mr-1.5 shrink-0" />
            <span className="truncate">Friends ({friends.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="rounded-xl py-3 text-xs sm:text-sm data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)] relative"
          >
            <span className="truncate">Requests</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-600 text-white text-[10px] font-bold shrink-0">
                {incomingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="recommendations"
            className="rounded-xl py-3 text-xs sm:text-sm data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)] relative"
          >
            <Inbox className="h-4 w-4 mr-1.5 shrink-0" />
            <span className="truncate">For You</span>
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-600 text-white text-[10px] font-bold shrink-0">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-6">
          {isLoading && friends.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Loader2 className="h-6 w-6 text-[var(--mm-text-30)] mx-auto animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Users className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
              <p className="text-[var(--mm-text-50)]">No friends yet. Enter their invite code above, or share yours.</p>
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
                      <p className="text-[var(--mm-text)] font-semibold truncate">
                        {f.otherUser?.name ?? 'Unknown user'}
                      </p>
                      {f.otherUser?.email && (
                        <p className="text-xs text-[var(--mm-text-40)] truncate">{f.otherUser.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/friends/${f.otherUser?.id ?? ''}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[var(--mm-text-60)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-xl"
                        title="View library"
                      >
                        <Library className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriend(f.id)}
                      className="text-[var(--mm-text-40)] hover:text-red-400 hover:bg-red-500/10 rounded-xl"
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
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3">
              Incoming ({incomingRequests.length})
            </h4>
            {incomingRequests.length === 0 ? (
              <p className="text-[var(--mm-text-40)] text-sm">No incoming requests.</p>
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
                        <p className="text-[var(--mm-text)] font-semibold truncate">
                          {f.otherUser?.name ?? 'Unknown user'}
                        </p>
                        {f.otherUser?.email && (
                          <p className="text-xs text-[var(--mm-text-40)] truncate">{f.otherUser.email}</p>
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
                        className="text-[var(--mm-text-40)] hover:text-red-400 hover:bg-red-500/10 rounded-xl"
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
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3">
              Sent ({outgoingRequests.length})
            </h4>
            {outgoingRequests.length === 0 ? (
              <p className="text-[var(--mm-text-40)] text-sm">No outgoing requests.</p>
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
                        <p className="text-[var(--mm-text)] font-semibold truncate">
                          {f.otherUser?.name ?? 'Unknown user'}
                        </p>
                        <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)] mt-1">
                          Pending
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriend(f.id)}
                      className="text-[var(--mm-text-40)] hover:text-red-400 hover:bg-red-500/10 rounded-xl shrink-0"
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

        <TabsContent value="recommendations" className="mt-6 space-y-6">
          <div>
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3">
              Sent to you ({inbox.length})
            </h4>
            {inbox.length === 0 ? (
              <p className="text-[var(--mm-text-40)] text-sm">
                Nothing yet - when a friend recommends a title, it shows up here.
              </p>
            ) : (
              <div className="grid gap-3">
                {inbox.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    direction="received"
                    onAdd={() => handleAddRecommendation(rec)}
                    onDismiss={() => dismissRecommendation(rec.id)}
                    isAdding={addingId === rec.id}
                    added={addedIds.has(rec.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3">
              Sent by you ({sent.length})
            </h4>
            {sent.length === 0 ? (
              <p className="text-[var(--mm-text-40)] text-sm">
                Recommend a title from its detail view - look for the <Send className="h-3 w-3 inline mx-0.5" />{' '}
                Recommend button.
              </p>
            ) : (
              <div className="grid gap-3">
                {sent.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    direction="sent"
                    onDismiss={() => dismissRecommendation(rec.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
