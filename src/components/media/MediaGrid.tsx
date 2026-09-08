'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MediaCard } from './MediaCard';
import { useMediaStore } from '@/store/mediaStore';
import type { Media } from '@/types';

interface MediaGridProps {
  onMediaClick?: (media: Media) => void;
  // When provided, renders this list instead of the signed-in user's own
  // filteredMedia - used for a read-only friend's-library view. viewMode
  // and gridSize still come from the store purely for display consistency;
  // readOnly disables the mark-done/edit affordances on each card.
  media?: Media[];
  readOnly?: boolean;
}

export function MediaGrid({ onMediaClick, media: mediaOverride, readOnly }: MediaGridProps) {
  const { filteredMedia, viewMode, gridSize } = useMediaStore();
  const displayMedia = mediaOverride ?? filteredMedia;

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5',
    6: 'grid-cols-3 md:grid-cols-5 lg:grid-cols-6',
  };

  if (displayMedia.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30">
        <p className="text-lg font-medium text-muted-foreground">
          No media found
        </p>
        <p className="text-sm text-muted-foreground/70">
          Try adjusting your filters or add new media
        </p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={
        viewMode === 'grid'
          ? `grid gap-4 ${gridCols[gridSize as keyof typeof gridCols] || 'grid-cols-3'}`
          : 'flex flex-col gap-3'
      }
    >
      <AnimatePresence mode="popLayout">
        {displayMedia.map((media) => (
          <MediaCard
            key={media.id}
            media={media}
            viewMode={viewMode}
            onClick={() => onMediaClick?.(media)}
            readOnly={readOnly}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
