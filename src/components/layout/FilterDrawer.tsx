'use client';

import { useMemo } from 'react';
import { X, Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn, getStatusLabel, getTypeLabel } from '@/lib/utils';
import { useMediaStore } from '@/store/mediaStore';
import type { MediaStatus, MediaType } from '@/types';

const statuses: MediaStatus[] = [
  'planned',
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
];

const types: MediaType[] = [
  'movie',
  'tv',
  'anime',
  'manga',
  'manhwa',
  'game',
  'book',
];

export function FilterDrawer() {
  const { media, filters, setFilters, resetFilters, isFilterDrawerOpen, toggleFilterDrawer } = useMediaStore();

  // Extract all unique genres from media
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    media.forEach((item) => {
      item.genres.forEach((genre) => genreSet.add(genre));
    });
    return Array.from(genreSet).sort();
  }, [media]);

  const activeCount = filters.status.length + filters.type.length + filters.genres.length +
    (filters.is_favorite ? 1 : 0) + (filters.is_archived ? 1 : 0);

  if (!isFilterDrawerOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={toggleFilterDrawer}
        className={cn(
          'border-white/10 hover:border-violet-600',
          activeCount > 0 && 'border-violet-600 bg-violet-600/10'
        )}
      >
        <SlidersHorizontal className="mr-2 h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <span className="ml-2 px-1.5 py-0.5 text-xs bg-violet-600 rounded-full">
            {activeCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black/80"
        onClick={toggleFilterDrawer}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-sm bg-black border-l border-white/10">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Filters</h2>
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-white/60 hover:text-white">
                  Reset
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={toggleFilterDrawer} className="text-white">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Status */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Status</h3>
              <div className="space-y-2">
                {statuses.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-violet-600"
                  >
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={(e) => {
                        setFilters({
                          status: e.target.checked
                            ? [...filters.status, status]
                            : filters.status.filter((s) => s !== status),
                        });
                      }}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-white/80">{getStatusLabel(status)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {types.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-violet-600"
                  >
                    <input
                      type="checkbox"
                      checked={filters.type.includes(type)}
                      onChange={(e) => {
                        setFilters({
                          type: e.target.checked
                            ? [...filters.type, type]
                            : filters.type.filter((t) => t !== type),
                        });
                      }}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-white/80">{getTypeLabel(type)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Favorites */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Favorites</h3>
              <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm text-white/80">Show only favorites</span>
                <Switch
                  checked={filters.is_favorite || false}
                  onCheckedChange={(checked) => {
                    setFilters({ is_favorite: checked });
                  }}
                />
              </label>
            </div>

            {/* Archived */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Archived</h3>
              <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm text-white/80">Show archived</span>
                <Switch
                  checked={filters.is_archived}
                  onCheckedChange={(checked) => {
                    setFilters({ is_archived: checked });
                  }}
                />
              </label>
            </div>

            {/* Genres */}
            {allGenres.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {allGenres.map((genre) => (
                    <Badge
                      key={genre}
                      variant={filters.genres.includes(genre) ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer px-3 py-1.5 text-xs transition-all',
                        filters.genres.includes(genre)
                          ? 'bg-violet-600 hover:bg-violet-700 border-transparent'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                      onClick={() => {
                        setFilters({
                          genres: filters.genres.includes(genre)
                            ? filters.genres.filter((g) => g !== genre)
                            : [...filters.genres, genre],
                        });
                      }}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
                {filters.genres.length > 0 && (
                  <button
                    onClick={() => setFilters({ genres: [] })}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300"
                  >
                    Clear genre filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4">
            <Button 
              className="w-full bg-violet-600 hover:bg-violet-700" 
              onClick={toggleFilterDrawer}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
