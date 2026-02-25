'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid3X3, List, ArrowLeft, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaGrid } from '@/components/media/MediaGrid';
import { MediaList } from '@/components/media/MediaList';
import { MediaDetail } from '@/components/media/MediaDetail';
import { FilterDrawer } from '@/components/layout/FilterDrawer';
import { useMediaStore } from '@/store/mediaStore';
import { cn, getTypeLabel } from '@/lib/utils';
import type { Media } from '@/types';

export default function LibraryPage() {
  const router = useRouter();
  const {
    media,
    filteredMedia,
    viewMode,
    setViewMode,
    setFilters,
    filters,
    selectedMedia,
    setSelectedMedia,
    updateMedia,
    deleteMedia,
  } = useMediaStore();

  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleMediaClick = (media: Media) => {
    setSelectedMedia(media);
    setDetailOpen(true);
  };

  const handleUpdateMedia = async (updates: Partial<Media>) => {
    if (selectedMedia) {
      await updateMedia(selectedMedia.id, updates);
    }
  };

  const handleDeleteMedia = async () => {
    if (selectedMedia) {
      await deleteMedia(selectedMedia.id);
      setDetailOpen(false);
      setSelectedMedia(null);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters({ search_query: query });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      status: [],
      type: [],
      genres: [],
      tags: [],
      release_year: {},
      rating: {},
      is_favorite: null,
      is_archived: false,
      search_query: '',
      sort_by: 'updated_at',
      sort_order: 'desc',
    });
  };

  const hasActiveFilters = 
    filters.status.length > 0 ||
    filters.type.length > 0 ||
    filters.genres.length > 0 ||
    filters.is_favorite !== null ||
    filters.is_archived !== false ||
    searchQuery.length > 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/')}
          className="text-white hover:bg-white/10 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">LIBRARY</h1>
          <p className="text-sm text-white/50 font-mono">コレクション</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        <div className="flex-none glass-card px-4 py-3 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total</div>
            <div className="text-xl font-bold font-mono">{media.length}</div>
          </div>
        </div>
        <div className="flex-none glass-card px-4 py-3 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Showing</div>
            <div className="text-xl font-bold font-mono">{filteredMedia.length}</div>
          </div>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex-none glass-card px-4 py-3 rounded-xl flex items-center gap-3 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
          >
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">Filters Active</div>
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
              Clear
            </Badge>
          </button>
        )}
      </div>

      {/* Search & Controls */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-12 h-14 bg-black border-white/10 rounded-xl text-lg focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('grid')}
            className={cn(
              'h-14 w-14 rounded-xl',
              viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/60'
            )}
          >
            <Grid3X3 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('list')}
            className={cn(
              'h-14 w-14 rounded-xl',
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/60'
            )}
          >
            <List className="h-5 w-5" />
          </Button>
          <FilterDrawer />
        </div>
      </div>

      {/* Content */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <Search className="h-10 w-10 text-white/20" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {hasActiveFilters ? 'No matches found' : 'Your library is empty'}
          </h3>
          <p className="text-white/50 mb-6">
            {hasActiveFilters 
              ? 'Try adjusting your filters or search query'
              : 'Start adding media to build your collection'
            }
          </p>
          {hasActiveFilters ? (
            <Button 
              onClick={clearFilters}
              variant="outline"
              className="border-white/10 text-white/60 rounded-xl"
            >
              Clear Filters
            </Button>
          ) : (
            <Button 
              onClick={() => router.push('/search')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              Add Your First Title
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50">
              Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
            </p>
            {hasActiveFilters && (
              <Badge variant="outline" className="border-indigo-500/50 text-indigo-400">
                Filtered
              </Badge>
            )}
          </div>

          {/* Media Display */}
          {viewMode === 'grid' ? (
            <MediaGrid onMediaClick={handleMediaClick} />
          ) : (
            <MediaList onMediaClick={handleMediaClick} />
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl h-[90vh] lg:h-auto lg:max-h-[90vh] overflow-hidden bg-[#0a0a0a] border-white/10 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {selectedMedia && (
            <MediaDetail
              media={selectedMedia}
              onUpdate={handleUpdateMedia}
              onDelete={handleDeleteMedia}
              onAISuggestions={() => {}}
              onClose={() => setDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
