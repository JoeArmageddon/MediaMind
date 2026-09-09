'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Plus,
  Film,
  Wand2,
  Folder,
  Trash2,
  Share2,
  Users,
  X,
  Loader2,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAIClient } from '@/lib/ai';
import { getSearchOrchestrator } from '@/lib/api/search';
import { mapExternalIds } from '@/lib/api/externalId';
import { MediaDetail } from '@/components/media/MediaDetail';
import { useMediaStore } from '@/store/mediaStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useFriendStore } from '@/store/friendStore';
import { supabase } from '@/lib/db/supabase';
import { db, type AICollectionDraft } from '@/lib/db/dexie';
import { cn, getTypeLabel } from '@/lib/utils';
import type {
  AISmartCollection,
  SmartCollection,
  SharedCollection,
  CollectionShareWithProfile,
  Media,
  SearchResult,
} from '@/types';

function UserCollectionCard({
  collection,
  onClick,
  onDelete,
  onShare,
}: {
  collection: SmartCollection;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onShare}
              title="Share with a friend"
              className="p-2 rounded-lg hover:bg-indigo-500/20 text-white/40 hover:text-indigo-400 transition-colors"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {collection.description && (
          <p className="text-white/60 text-sm mb-4 leading-relaxed">{collection.description}</p>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/5 border-white/10 text-white/80 rounded-lg px-3 py-1">
            {collection.media_ids.length} items
          </Badge>
          {collection.is_auto_generated && (
            <Badge variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 rounded-lg">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function AICollectionCard({
  collection,
  onSave,
  onDiscard,
}: {
  collection: AISmartCollection;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="glass-card rounded-[24px] p-6 hover:border-fuchsia-500/50 transition-all group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onSave}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg"
            >
              <Plus className="h-4 w-4 mr-1" />
              Save
            </Button>
            <button
              onClick={onDiscard}
              title="Discard suggestion"
              className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <p className="text-white/60 text-sm mb-4 leading-relaxed">{collection.description}</p>
        
        <div className="flex flex-wrap gap-2">
          {collection.media_titles.slice(0, 4).map((title) => (
            <Badge 
              key={title} 
              variant="secondary" 
              className="bg-white/5 border-white/10 text-white/80 rounded-lg px-3 py-1"
            >
              {title}
            </Badge>
          ))}
          {collection.media_titles.length > 4 && (
            <Badge variant="outline" className="border-white/10 text-white/50 rounded-lg">
              +{collection.media_titles.length - 4}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function UserCollectionDetail({
  collection,
  media,
  onExpandMedia,
  onAddMedia,
  onRemoveMedia,
}: {
  collection: SmartCollection;
  media: Media[];
  onExpandMedia: (item: Media, readOnly: boolean) => void;
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
}) {
  const collMedia = media.filter((m) => collection.media_ids.includes(m.id));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.description && (
          <p className="text-white/60 text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Media in collection</h4>
            <button
              onClick={onAddMedia}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {collMedia.length > 0 ? (
            collMedia.map((item) => (
              <div
                key={item.id}
                onClick={() => onExpandMedia(item, false)}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-white/10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                      {item.title[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-white font-medium text-sm truncate block">{item.title}</span>
                    <p className="text-xs text-white/40">{getTypeLabel(item.type)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMedia(item.id);
                  }}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm text-center py-4">No media in this collection yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function AICollectionDetail({ 
  collection, 
  allMedia 
}: { 
  collection: AISmartCollection; 
  allMedia: Media[];
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.description && (
          <p className="text-white/60 text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Suggested media</h4>
          {collection.media_titles.map((title) => (
            <div
              key={title}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
            >
              <span className="text-white font-medium text-sm">{title}</span>
              {allMedia.find(m => m.title.toLowerCase().includes(title.toLowerCase())) && (
                <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                  In Library
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SharedCollectionCard({
  collection,
  onClick,
}: {
  collection: SharedCollection;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
          </div>
        </div>

        {collection.description && (
          <p className="text-white/60 text-sm mb-4 leading-relaxed">{collection.description}</p>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/5 border-white/10 text-white/80 rounded-lg px-3 py-1">
            {collection.media_ids.length} items
          </Badge>
          {collection.owner && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              {collection.owner.imageUrl ? (
                <img src={collection.owner.imageUrl} alt={collection.owner.name} className="w-4 h-4 rounded-full" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {collection.owner.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SharedCollectionDetail({
  collection,
  onExpandMedia,
  onAddMedia,
  onRemoveMedia,
}: {
  collection: SharedCollection;
  onExpandMedia: (item: Media, readOnly: boolean) => void;
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    // The shared collection's media_ids point at the owner's media rows,
    // not mine - fetched fresh rather than filtered from my own media
    // list. RLS ("select friends media") is what actually makes this work:
    // it only returns rows here because owner and viewer are friends.
    (async () => {
      if (collection.media_ids.length === 0) {
        if (!cancelled) {
          setMedia([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await (supabase as any)
          .from('media')
          .select('*')
          .in('id', collection.media_ids);
        if (cancelled) return;
        if (error) throw error;
        setMedia((data ?? []) as Media[]);
      } catch (e) {
        console.warn('Failed to load shared collection media:', e);
        if (!cancelled) setMedia([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Folder className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.owner && (
          <p className="text-white/40 text-xs">Shared by {collection.owner.name}</p>
        )}
        {collection.description && (
          <p className="text-white/60 text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Media in collection</h4>
            <button
              onClick={onAddMedia}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {isLoading ? (
            <div className="text-center py-4">
              <Loader2 className="h-5 w-5 text-white/30 mx-auto animate-spin" />
            </div>
          ) : media.length > 0 ? (
            media.map((item) => {
              // Any collaborator's write to media itself is blocked by RLS
              // regardless (only the owning account can edit its own media
              // row) - only expand into the fully editable MediaDetail when
              // this item is actually mine.
              const isMine = (item as unknown as { user_id?: string }).user_id === currentUserId;
              return (
                <div
                  key={item.id}
                  onClick={() => onExpandMedia(item, !isMine)}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.poster_url ? (
                      <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-10 h-14 bg-white/10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                        {item.title[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-white font-medium text-sm truncate block">{item.title}</span>
                      <p className="text-xs text-white/40">{getTypeLabel(item.type)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMedia(item.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-white/40 text-sm text-center py-4">No media in this collection.</p>
          )}
        </div>
      </div>
    </>
  );
}

function ShareCollectionDialog({
  collection,
  onClose,
}: {
  collection: SmartCollection | null;
  onClose: () => void;
}) {
  const { friends, fetchFriends } = useFriendStore();
  const {
    fetchSharesForCollection,
    shareCollection,
    unshareCollection,
    inviteCodes,
    fetchCollectionInviteCode,
    regenerateCollectionInviteCode,
  } = useCollectionStore();
  const [shares, setShares] = useState<CollectionShareWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyFriendId, setBusyFriendId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (!collection) return;
    fetchFriends();
    fetchCollectionInviteCode(collection.id);
    setIsLoading(true);
    fetchSharesForCollection(collection.id)
      .then(setShares)
      .finally(() => setIsLoading(false));
  }, [collection, fetchFriends, fetchSharesForCollection, fetchCollectionInviteCode]);

  if (!collection) return null;

  const sharedWithIds = new Set(shares.map((s) => s.shared_with_id));
  const code = inviteCodes[collection.id];
  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/collection-invite/${code}` : '';

  const copy = async (value: string, which: 'link' | 'code') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard denied/unavailable - not worth an error, it's on screen.
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Generate a new invite code for this collection? The current code and link will stop working.')) {
      return;
    }
    setIsRegenerating(true);
    await regenerateCollectionInviteCode(collection.id);
    setIsRegenerating(false);
  };

  const handleToggle = async (friendId: string) => {
    setBusyFriendId(friendId);
    try {
      const existingShare = shares.find((s) => s.shared_with_id === friendId);
      if (existingShare) {
        await unshareCollection(existingShare.id);
        setShares((prev) => prev.filter((s) => s.id !== existingShare.id));
      } else {
        const result = await shareCollection(collection.id, friendId);
        if (result.success) {
          const updated = await fetchSharesForCollection(collection.id);
          setShares(updated);
        }
      }
    } finally {
      setBusyFriendId(null);
    }
  };

  return (
    <Dialog open={!!collection} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &quot;{collection.title}&quot;
          </DialogTitle>
        </DialogHeader>

        {code && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-2">
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5" />
              Invite link - anyone with it can join
            </h4>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <button
                  onClick={() => copy(code, 'code')}
                  className="group flex items-center gap-2 mb-2 -ml-1 px-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="font-mono text-lg font-black text-white tracking-[0.15em]">{code}</span>
                  {copied === 'code' ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60" />
                  )}
                </button>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => copy(link, 'link')}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs"
                  >
                    {copied === 'link' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied === 'link' ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    onClick={() => setShowQr((s) => !s)}
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-xs"
                  >
                    <QrCode className="h-3 w-3 mr-1" />
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
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              {showQr && link && (
                <div className="bg-white p-2.5 rounded-xl shrink-0">
                  <QRCodeSVG value={link} size={100} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="py-2">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Share with a friend</h4>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-5 w-5 text-white/30 mx-auto animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-8">
              Add friends first to share collections with them.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const isShared = f.otherUser && sharedWithIds.has(f.otherUser.id);
                const isBusy = busyFriendId === f.otherUser?.id;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {f.otherUser?.imageUrl ? (
                        <img src={f.otherUser.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                          {f.otherUser?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-sm text-white truncate">{f.otherUser?.name}</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={isBusy || !f.otherUser}
                      onClick={() => f.otherUser && handleToggle(f.otherUser.id)}
                      className={cn(
                        'rounded-lg text-xs',
                        isShared
                          ? 'bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isShared ? (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </>
                      ) : (
                        'Share'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMediaPickerDialog({
  open,
  onClose,
  pool,
  excludeIds,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  pool: Media[];
  excludeIds: string[];
  onAdd: (mediaId: string) => Promise<void> | void;
}) {
  const { addMedia } = useMediaStore();
  const [tab, setTab] = useState<'library' | 'search'>('library');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const [externalQuery, setExternalQuery] = useState('');
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [addedExternalKeys, setAddedExternalKeys] = useState<Set<string>>(new Set());
  const [externalError, setExternalError] = useState<string | null>(null);

  const available = pool.filter((m) => !excludeIds.includes(m.id));
  const filtered = search.trim()
    ? available.filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  const handleAdd = async (mediaId: string) => {
    setAddingId(mediaId);
    try {
      await onAdd(mediaId);
    } finally {
      setAddingId(null);
    }
  };

  const handleExternalSearch = async () => {
    if (!externalQuery.trim()) return;
    setIsSearchingExternal(true);
    setExternalError(null);
    try {
      const orchestrator = getSearchOrchestrator();
      const results = await orchestrator.search(externalQuery.trim(), undefined);
      setExternalResults(results);
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setIsSearchingExternal(false);
    }
  };

  // A title from external search isn't in your library yet - this creates
  // it (same shape as the Search tab's own add flow) and then adds the
  // newly created row to the collection via the same onAdd path used for
  // an existing item, rather than needing a separate "unowned catalog
  // reference" data model just for this.
  const handleAddExternal = async (result: SearchResult) => {
    const key = `${result.type}:${result.title}`;
    setAddingId(key);
    setExternalError(null);
    try {
      const externalIds = mapExternalIds(result);
      const newMedia = await addMedia({
        title: result.title,
        normalized_title: result.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
        type: result.type,
        poster_url: result.poster_url,
        backdrop_url: null,
        description: result.description,
        release_year: result.release_year,
        api_rating: result.api_rating,
        genres: result.genres,
        tags: [],
        studios: [],
        total_units: result.total_units || 0,
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
        ...externalIds,
      });
      await onAdd(newMedia.id);
      setAddedExternalKeys((prev) => new Set(prev).add(key));
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : 'Failed to add this title.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white">Add Media</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'library' | 'search')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="library"
              className="rounded-lg py-2 px-1 text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 min-w-0"
            >
              <span className="truncate">My Library</span>
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="rounded-lg py-2 px-1 text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 min-w-0"
            >
              <Search className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">Search Web</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3 mt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library..."
              className="bg-black border-white/10 rounded-xl h-11"
            />
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">
                  {available.length === 0 ? "Everything's already in this collection." : 'No matches.'}
                </p>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} className="w-9 h-12 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-9 h-12 bg-white/10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                          {item.title[0]}
                        </div>
                      )}
                      <span className="text-white text-sm truncate">{item.title}</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={addingId === item.id}
                      onClick={() => handleAdd(item.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0"
                    >
                      {addingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-3 mt-3">
            <p className="text-xs text-white/40 -mt-1">
              Add a title you don&apos;t track yet - it's added to your library and this collection together.
            </p>
            <div className="flex gap-2">
              <Input
                value={externalQuery}
                onChange={(e) => setExternalQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExternalSearch()}
                placeholder="Search movies, TV, anime, books, games..."
                className="bg-black border-white/10 rounded-xl h-11 flex-1"
              />
              <Button
                onClick={handleExternalSearch}
                disabled={isSearchingExternal || !externalQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4"
              >
                {isSearchingExternal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {externalError && <p className="text-xs text-red-400">{externalError}</p>}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {externalResults.map((result, i) => {
                const key = `${result.type}:${result.title}`;
                const added = addedExternalKeys.has(key);
                return (
                  <div
                    key={`${key}-${i}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {result.poster_url ? (
                        <img src={result.poster_url} alt={result.title} className="w-9 h-12 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-9 h-12 bg-white/10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                          {result.title[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-white text-sm truncate block">{result.title}</span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wide">
                          {getTypeLabel(result.type)}
                          {result.release_year ? ` · ${result.release_year}` : ''}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={added || addingId === key}
                      onClick={() => !added && handleAddExternal(result)}
                      className={cn(
                        'rounded-lg shrink-0',
                        added ? 'bg-green-600 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
                      )}
                    >
                      {addingId === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      ) : added ? (
                        <Check className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-white" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const { media, updateMedia, deleteMedia } = useMediaStore();
  const {
    collections,
    sharedWithMe,
    fetchCollections,
    fetchSharedWithMe,
    addCollection,
    deleteCollection,
    addMediaToCollection,
    removeMediaFromCollection,
    addMediaToSharedCollection,
    removeMediaFromSharedCollection,
    redeemCollectionCode,
  } = useCollectionStore();

  // Generated-but-unsaved AI suggestions, persisted to db.aiCollectionDrafts
  // so they survive navigation/reload until explicitly saved or discarded.
  const [aiCollections, setAiCollections] = useState<AICollectionDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedUserCollection, setSelectedUserCollection] = useState<SmartCollection | null>(null);
  const [selectedAICollection, setSelectedAICollection] = useState<AISmartCollection | null>(null);
  const [selectedSharedCollection, setSelectedSharedCollection] = useState<SharedCollection | null>(null);
  const [shareDialogCollection, setShareDialogCollection] = useState<SmartCollection | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('my');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // "Expand" a media row from inside a collection's detail view - editable
  // (readOnly false) for your own collection's items, or when a shared
  // collection's item happens to be one of yours; read-only otherwise.
  const [expandedMedia, setExpandedMedia] = useState<{ item: Media; readOnly: boolean } | null>(null);
  // Which collection an "Add Media" picker is currently targeting, and
  // whether it's one of mine or one shared with me (they call different
  // store actions - own collections vs. collaborative shared ones).
  const [addMediaTarget, setAddMediaTarget] = useState<{ id: string; kind: 'own' | 'shared' } | null>(null);

  useEffect(() => {
    fetchCollections();
    fetchSharedWithMe();
    db.aiCollectionDrafts
      .orderBy('created_at')
      .reverse()
      .toArray()
      .then(setAiCollections)
      .catch((e) => console.warn('Failed to load AI collection drafts:', e));
  }, [fetchCollections, fetchSharedWithMe]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const ai = getAIClient();
      // Existing saved collections plus whatever drafts are still on
      // screen from a previous generate (about to be cleared below) - both
      // count as "already have this", so a re-generate doesn't just
      // reproduce the same groupings under a slightly different title.
      const avoidTitles = [...collections.map((c) => c.title), ...aiCollections.map((d) => d.data.title)];
      const newCollections = await ai.generateSmartCollections(
        media.map((m) => ({
          title: m.title,
          type: m.type,
          genres: m.genres,
          ai_primary_tone: m.ai_primary_tone,
        })),
        avoidTitles
      );
      if (newCollections) {
        const now = new Date().toISOString();
        const drafts: AICollectionDraft[] = newCollections.map((data) => ({
          id: crypto.randomUUID(),
          data,
          created_at: now,
        }));

        // Replace any previous batch of drafts with the new one.
        await db.aiCollectionDrafts.clear();
        await db.aiCollectionDrafts.bulkAdd(drafts);

        setAiCollections(drafts);
        setActiveTab('ai');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate AI collections. Make sure you have a Groq or Gemini API key in Settings.');
    } finally {
      setIsGenerating(false);
    }
  };

  const discardAICollection = async (draftId: string) => {
    await db.aiCollectionDrafts.delete(draftId);
    setAiCollections((prev) => prev.filter((d) => d.id !== draftId));
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    await addCollection({
      title: newCollectionName,
      description: newCollectionDesc || null,
      media_ids: selectedMediaIds,
      filter_criteria: null,
      is_auto_generated: false,
    });

    setNewCollectionName('');
    setNewCollectionDesc('');
    setSelectedMediaIds([]);
    setIsCreateOpen(false);
  };

  const handleSaveAICollection = async (draft: AICollectionDraft) => {
    const aiCollection = draft.data;
    const mediaIds: string[] = [];
    aiCollection.media_titles.forEach((title) => {
      const matchedMedia = media.find(
        (m) => m.title.toLowerCase().includes(title.toLowerCase()) ||
               title.toLowerCase().includes(m.title.toLowerCase())
      );
      if (matchedMedia) {
        mediaIds.push(matchedMedia.id);
      }
    });

    await addCollection({
      title: aiCollection.title,
      description: aiCollection.description,
      media_ids: mediaIds,
      filter_criteria: null,
      is_auto_generated: true,
    });

    // Saved for real now - the draft has served its purpose.
    await discardAICollection(draft.id);

    alert(`"${aiCollection.title}" saved!`);
  };

  const handleAddToOwnCollection = async (mediaId: string) => {
    if (!addMediaTarget) return;
    await addMediaToCollection(addMediaTarget.id, mediaId);
    // Keep the open detail dialog's list in sync without closing it.
    setSelectedUserCollection((prev) =>
      prev && prev.id === addMediaTarget.id
        ? { ...prev, media_ids: [...prev.media_ids, mediaId] }
        : prev
    );
  };

  const handleAddToSharedCollection = async (mediaId: string) => {
    if (!addMediaTarget) return;
    await addMediaToSharedCollection(addMediaTarget.id, mediaId);
    setSelectedSharedCollection((prev) =>
      prev && prev.id === addMediaTarget.id
        ? { ...prev, media_ids: [...prev.media_ids, mediaId] }
        : prev
    );
  };

  const handleRemoveFromOwnCollection = async (mediaId: string) => {
    if (!selectedUserCollection) return;
    await removeMediaFromCollection(selectedUserCollection.id, mediaId);
    setSelectedUserCollection((prev) =>
      prev ? { ...prev, media_ids: prev.media_ids.filter((id) => id !== mediaId) } : prev
    );
  };

  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    setJoinFeedback(null);
    const result = await redeemCollectionCode(joinCodeInput.trim().toUpperCase());
    setJoinFeedback({ ok: result.success, text: result.message });
    if (result.success) {
      setJoinCodeInput('');
      await fetchSharedWithMe();
      setActiveTab('shared');
    }
    setIsJoining(false);
  };

  const handleRemoveFromSharedCollection = async (mediaId: string) => {
    if (!selectedSharedCollection) return;
    await removeMediaFromSharedCollection(selectedSharedCollection.id, mediaId);
    setSelectedSharedCollection((prev) =>
      prev ? { ...prev, media_ids: prev.media_ids.filter((id) => id !== mediaId) } : prev
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">COLLECTIONS</h1>
            <p className="text-sm text-white/50 font-mono">コレクション</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>

      <div className="glass-card rounded-[24px] p-6">
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Join a collection
        </h3>
        <div className="flex gap-2">
          <Input
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            placeholder="Enter invite code"
            className="bg-black border-white/10 rounded-xl h-12 flex-1 font-mono uppercase tracking-widest placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
          />
          <Button
            onClick={handleJoinByCode}
            disabled={isJoining || !joinCodeInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
          >
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
          </Button>
        </div>
        {joinFeedback && (
          <p className={cn('text-sm mt-3', joinFeedback.ok ? 'text-green-400' : 'text-red-400')}>
            {joinFeedback.text}
          </p>
        )}
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || media.length === 0}
        className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 text-white rounded-xl h-14"
      >
        <Wand2 className={cn('mr-2 h-5 w-5', isGenerating && 'animate-spin')} />
        {isGenerating ? 'Generating...' : 'Generate AI Collections'}
      </Button>

      {media.length === 0 && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-white/50">Add media to generate AI collections.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-2xl h-auto">
          <TabsTrigger value="my" className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
            <Folder className="h-4 w-4 mr-2" />
            My ({collections.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
            <Sparkles className="h-4 w-4 mr-2" />
            AI ({aiCollections.length})
          </TabsTrigger>
          <TabsTrigger value="shared" className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
            <Users className="h-4 w-4 mr-2" />
            Shared ({sharedWithMe.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-6">
          {collections.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Folder className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No collections yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {collections.map((collection) => (
                <UserCollectionCard
                  key={collection.id}
                  collection={collection}
                  onClick={() => setSelectedUserCollection(collection)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    deleteCollection(collection.id);
                  }}
                  onShare={(e) => {
                    e.stopPropagation();
                    setShareDialogCollection(collection);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          {aiCollections.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Sparkles className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No AI collections yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {aiCollections.map((draft) => (
                <AICollectionCard
                  key={draft.id}
                  collection={draft.data}
                  onSave={() => handleSaveAICollection(draft)}
                  onDiscard={() => discardAICollection(draft.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared" className="mt-6">
          {sharedWithMe.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No collections shared with you yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sharedWithMe.map((collection) => (
                <SharedCollectionCard
                  key={collection.id}
                  collection={collection}
                  onClick={() => setSelectedSharedCollection(collection)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-white/10 rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Name</label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., My Top Anime"
                className="bg-black border-white/10 rounded-xl h-12"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Description</label>
              <Textarea
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="What's this collection about?"
                className="bg-black border-white/10 rounded-xl min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                Media ({selectedMediaIds.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2">
                {media.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMediaIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMediaIds([...selectedMediaIds, item.id]);
                        } else {
                          setSelectedMediaIds(selectedMediaIds.filter((id) => id !== item.id));
                        }
                      }}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-white truncate flex-1">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
                      {getTypeLabel(item.type)}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            <Button 
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserCollection} onOpenChange={() => setSelectedUserCollection(null)}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
          {selectedUserCollection && (
            <UserCollectionDetail
              collection={selectedUserCollection}
              media={media}
              onExpandMedia={(item, readOnly) => setExpandedMedia({ item, readOnly })}
              onAddMedia={() => setAddMediaTarget({ id: selectedUserCollection.id, kind: 'own' })}
              onRemoveMedia={handleRemoveFromOwnCollection}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAICollection} onOpenChange={() => setSelectedAICollection(null)}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
          {selectedAICollection && (
            <AICollectionDetail collection={selectedAICollection} allMedia={media} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSharedCollection} onOpenChange={() => setSelectedSharedCollection(null)}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
          {selectedSharedCollection && (
            <SharedCollectionDetail
              collection={selectedSharedCollection}
              onExpandMedia={(item, readOnly) => setExpandedMedia({ item, readOnly })}
              onAddMedia={() => setAddMediaTarget({ id: selectedSharedCollection.id, kind: 'shared' })}
              onRemoveMedia={handleRemoveFromSharedCollection}
            />
          )}
        </DialogContent>
      </Dialog>

      <ShareCollectionDialog
        collection={shareDialogCollection}
        onClose={() => setShareDialogCollection(null)}
      />

      <AddMediaPickerDialog
        open={!!addMediaTarget}
        onClose={() => setAddMediaTarget(null)}
        pool={media}
        excludeIds={
          addMediaTarget?.kind === 'own'
            ? selectedUserCollection?.media_ids ?? []
            : selectedSharedCollection?.media_ids ?? []
        }
        onAdd={addMediaTarget?.kind === 'own' ? handleAddToOwnCollection : handleAddToSharedCollection}
      />

      <Dialog open={!!expandedMedia} onOpenChange={() => setExpandedMedia(null)}>
        <DialogContent hideCloseButton className="max-w-4xl h-[90vh] lg:h-auto lg:max-h-[90vh] overflow-hidden bg-[#0a0a0a] border-white/10 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {expandedMedia && (
            <MediaDetail
              media={expandedMedia.item}
              readOnly={expandedMedia.readOnly}
              onUpdate={
                expandedMedia.readOnly
                  ? undefined
                  : (updates) => updateMedia(expandedMedia.item.id, updates)
              }
              onDelete={
                expandedMedia.readOnly
                  ? undefined
                  : () => {
                      deleteMedia(expandedMedia.item.id);
                      setExpandedMedia(null);
                    }
              }
              onClose={() => setExpandedMedia(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
