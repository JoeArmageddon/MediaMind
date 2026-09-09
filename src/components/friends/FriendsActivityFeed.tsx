'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Users, Check, Plus, Heart, Archive } from 'lucide-react';
import { useFriendStore } from '@/store/friendStore';
import { getTypeLabel } from '@/lib/utils';
import type { FriendActivityEntry } from '@/types';

const actionCopy: Record<string, { verb: string; icon: React.ReactNode }> = {
  added: { verb: 'added', icon: <Plus className="h-3 w-3" /> },
  status_change: { verb: 'updated', icon: <Check className="h-3 w-3" /> },
  progress_update: { verb: 'made progress on', icon: <Check className="h-3 w-3" /> },
  favorited: { verb: 'favorited', icon: <Heart className="h-3 w-3" /> },
  archived: { verb: 'archived', icon: <Archive className="h-3 w-3" /> },
};

function describe(entry: FriendActivityEntry): string {
  if (entry.action_type === 'status_change') {
    const status = (entry.value as { status?: string } | null)?.status;
    if (status === 'completed') return 'finished';
    if (status) return `marked as ${status.replace('_', ' ')}`;
  }
  return actionCopy[entry.action_type]?.verb ?? 'updated';
}

export function FriendsActivityFeed() {
  const { friends, activity, isLoadingActivity, fetchFriendsActivity } = useFriendStore();

  useEffect(() => {
    fetchFriendsActivity();
  }, [fetchFriendsActivity]);

  // Nothing to show for someone with no friends yet - the "Add a friend"
  // flow lives on /friends, no need to duplicate an empty-state prompt here.
  if (!isLoadingActivity && friends.length === 0) return null;
  if (!isLoadingActivity && activity.length === 0) return null;

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--mm-text)] tracking-tight flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--mm-text-50)]" />
          Friends&apos; Activity
        </h2>
        <Link href="/friends" className="text-xs text-indigo-400 hover:text-indigo-300">
          View all
        </Link>
      </div>

      <div className="glass-card rounded-[24px] divide-y divide-white/5 overflow-hidden">
        {activity.slice(0, 8).map((entry) => (
          <Link
            key={entry.id}
            href={`/friends/${entry.friend.id}`}
            className="flex items-center gap-3 p-3 hover:bg-[var(--mm-hover-bg)] transition-colors"
          >
            {entry.friend.imageUrl ? (
              <img
                src={entry.friend.imageUrl}
                alt={entry.friend.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {entry.friend.name[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--mm-text)] truncate">
                <span className="font-semibold">{entry.friend.name}</span>{' '}
                <span className="text-[var(--mm-text-50)]">{describe(entry)}</span>{' '}
                <span className="font-medium">{entry.media?.title ?? 'a title'}</span>
              </p>
              {entry.media && (
                <p className="text-[10px] text-[var(--mm-text-30)] uppercase tracking-wider mt-0.5">
                  {getTypeLabel(entry.media.type)}
                </p>
              )}
            </div>
            {entry.media?.poster_url && (
              <img
                src={entry.media.poster_url}
                alt=""
                className="w-8 h-11 rounded object-cover shrink-0"
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
