'use client';

import { useEffect, useState } from 'react';
import { Send, Loader2, Check, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFriendStore } from '@/store/friendStore';
import { useRecommendationStore } from '@/store/recommendationStore';
import { cn } from '@/lib/utils';
import type { Media } from '@/types';

interface RecommendDialogProps {
  media: Media | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Pick a friend to send a title to - a lightweight "you should watch/read this" share. */
export function RecommendDialog({ media, open, onOpenChange }: RecommendDialogProps) {
  const { friends, fetchFriends } = useFriendStore();
  const { send } = useRecommendationStore();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchFriends();
  }, [open, fetchFriends]);

  useEffect(() => {
    if (!open) {
      // Reset once the dialog has finished closing, not on open, so the
      // content doesn't visibly flash empty during the close animation.
      const t = setTimeout(() => {
        setSelectedFriendId(null);
        setMessage('');
        setSentTo(new Set());
        setError(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!media) return null;

  const handleSend = async () => {
    if (!selectedFriendId) return;
    setIsSending(true);
    setError(null);
    const result = await send(selectedFriendId, media, message);
    if (result.success) {
      setSentTo((prev) => new Set(prev).add(selectedFriendId));
      setSelectedFriendId(null);
      setMessage('');
    } else {
      setError(result.message);
    }
    setIsSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-2">
            <Send className="h-5 w-5" />
            Recommend &quot;{media.title}&quot;
          </DialogTitle>
        </DialogHeader>

        {friends.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-10 w-10 text-[var(--mm-text-20)] mx-auto mb-3" />
            <p className="text-[var(--mm-text-50)] text-sm">Add a friend first to recommend titles to them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto space-y-2">
              {friends.map((f) => {
                const friendId = f.otherUser?.id;
                const alreadySent = friendId ? sentTo.has(friendId) : false;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={!friendId || alreadySent}
                    onClick={() => friendId && setSelectedFriendId(friendId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors',
                      selectedFriendId === friendId
                        ? 'bg-indigo-600/20 border-indigo-500/50'
                        : 'bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] hover:border-[var(--mm-card-border-hover)]',
                      alreadySent && 'opacity-50'
                    )}
                  >
                    {f.otherUser?.imageUrl ? (
                      <img src={f.otherUser.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                        {f.otherUser?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="text-sm text-[var(--mm-text)] flex-1 truncate">{f.otherUser?.name ?? 'Unknown user'}</span>
                    {alreadySent && <Check className="h-4 w-4 text-green-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note (optional)..."
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl min-h-[70px]"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              onClick={handleSend}
              disabled={!selectedFriendId || isSending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
