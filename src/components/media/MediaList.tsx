'use client';

import { useState } from 'react';
import { useMediaStore } from '@/store/mediaStore';
import { cn, getStatusColor, getStatusLabel, getTypeLabel } from '@/lib/utils';
import type { Media } from '@/types';
import { Star, MoreVertical, Heart, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface MediaListProps {
  onMediaClick?: (media: Media) => void;
}

export function MediaList({ onMediaClick }: MediaListProps) {
  const { filteredMedia, updateMedia, deleteMedia } = useMediaStore();
  const [pendingDelete, setPendingDelete] = useState<Media | null>(null);

  if (filteredMedia.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        No items found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredMedia.map((media) => (
        <div
          key={media.id}
          role="button"
          tabIndex={0}
          onClick={() => onMediaClick?.(media)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onMediaClick?.(media);
          }}
          className="w-full glass-card rounded-2xl p-3 flex items-center gap-4 hover:border-white/20 transition-all text-left group cursor-pointer"
        >
          {/* Poster */}
          <div className="h-16 w-12 flex-shrink-0 bg-black rounded-lg overflow-hidden border border-white/10">
            {media.poster_url ? (
              <img
                src={media.poster_url}
                alt={media.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                <span className="text-lg font-black text-white/20">
                  {media.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white truncate">{media.title}</h3>
              {media.is_favorite && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                getStatusColor(media.status)
              )}>
                {getStatusLabel(media.status)}
              </span>
              <span>•</span>
              <span>{getTypeLabel(media.type)}</span>
              {media.release_year && (
                <>
                  <span>•</span>
                  <span>{media.release_year}</span>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-mono text-white/60">
              {media.progress}/{media.total_units || '?'}
            </div>
            <div className="text-xs text-white/40">
              {media.completion_percent}%
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  aria-label="More actions"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={() => updateMedia(media.id, { is_favorite: !media.is_favorite })}>
                  <Heart className={cn('h-4 w-4', media.is_favorite && 'fill-current text-yellow-400')} />
                  {media.is_favorite ? 'Remove favorite' : 'Add favorite'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => updateMedia(media.id, { is_archived: !media.is_archived })}>
                  {media.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {media.is_archived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setPendingDelete(media)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this item?"
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently removed from your library.` : ''}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) deleteMedia(pendingDelete.id);
        }}
      />
    </div>
  );
}
