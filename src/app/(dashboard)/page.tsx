'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid3X3, List, Plus, Shuffle, Film, ArrowRight, Sparkles, Library, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaGrid } from '@/components/media/MediaGrid';
import { MediaDetail } from '@/components/media/MediaDetail';
import { FilterDrawer } from '@/components/layout/FilterDrawer';
import { useMediaStore } from '@/store/mediaStore';
import { cn } from '@/lib/utils';
import type { Media } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const {
    filteredMedia,
    viewMode,
    gridSize,
    setViewMode,
    setGridSize,
    setFilters,
    selectedMedia,
    setSelectedMedia,
    updateMedia,
    deleteMedia,
  } = useMediaStore();

  const [detailOpen, setDetailOpen] = useState(false);
  const [randomPickerOpen, setRandomPickerOpen] = useState(false);

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

  const pickRandom = () => {
    const planned = filteredMedia.filter((m) => m.status === 'planned');
    if (planned.length > 0) {
      const random = planned[Math.floor(Math.random() * planned.length)];
      setSelectedMedia(random);
      setDetailOpen(true);
    }
    setRandomPickerOpen(false);
  };

  const completedCount = filteredMedia.filter((m) => m.status === 'completed').length;
  const totalCount = filteredMedia.length;

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Section */}
      <div className="relative mb-8">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[80px]" />
        <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tighter leading-[0.85] mb-2 relative z-10">
          MEDIA<br/>MIND
        </h1>
        <div className="flex items-center gap-3 text-indigo-400 font-mono text-xs tracking-[0.2em] uppercase">
          <span>v2.0</span>
          <div className="h-px w-12 bg-indigo-500/50" />
          <span>INTELLIGENCE</span>
        </div>
      </div>

      {/* Stats Ticker */}
      <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar">
        <div className="flex-none glass-card px-4 py-3 rounded-xl flex items-center gap-3 min-w-[120px]">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total</div>
            <div className="text-xl font-bold font-mono">{totalCount}</div>
          </div>
        </div>
        <div className="flex-none glass-card px-4 py-3 rounded-xl flex items-center gap-3 min-w-[120px]">
          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Watched</div>
            <div className="text-xl font-bold font-mono">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Library Card - Large with Posters */}
        <button 
          onClick={() => router.push('/library')}
          className="col-span-12 h-56 relative group rounded-[28px] overflow-hidden border border-white/10 bg-[#0a0a0a] text-left"
        >
          {/* Poster Grid Background */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-1 p-1">
            {filteredMedia.slice(0, 8).map((media, idx) => (
              <div key={media.id} className="relative overflow-hidden rounded-lg">
                {media.poster_url ? (
                  <img 
                    src={media.poster_url} 
                    alt={media.title}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <span className="text-2xl font-black text-white/20">{media.title.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
            {/* Fill empty slots with placeholders */}
            {Array.from({ length: Math.max(0, 8 - filteredMedia.length) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="relative overflow-hidden rounded-lg bg-gradient-to-br from-white/5 to-transparent">
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="h-8 w-8 text-white/10" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
            <div className="flex items-end justify-between">
              <div>
                <div className="bg-white text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-2 w-fit">
                  {totalCount} {totalCount === 1 ? 'Title' : 'Titles'}
                </div>
                <h2 className="text-4xl font-black text-white tracking-tighter">LIBRARY</h2>
                <p className="text-sm text-slate-400 font-mono mt-1">コレクション</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-full group-hover:bg-white group-hover:text-black transition-all">
                <ArrowRight size={24} className="-rotate-45" />
              </div>
            </div>
          </div>
        </button>

        {/* AI Suggestions */}
        <button 
          onClick={() => router.push('/collections')}
          className="col-span-7 h-40 bg-[#0a0a0a] rounded-[28px] relative overflow-hidden group border border-white/10 flex flex-col justify-between p-5 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Sparkles size={56} className="text-fuchsia-500" />
          </div>
          
          <div className="z-10 bg-fuchsia-500/20 w-fit p-2 rounded-lg backdrop-blur-md border border-fuchsia-500/20">
            <Sparkles size={20} className="text-fuchsia-300" />
          </div>
          <div className="z-10">
            <h3 className="text-xl font-bold text-white leading-none">AI<br/>COLLECTIONS</h3>
            <p className="text-[10px] text-fuchsia-400/80 font-mono mt-2 uppercase tracking-wider">Smart Grouping</p>
          </div>
        </button>

        {/* Add Button */}
        <button 
          onClick={() => router.push('/search')}
          className="col-span-5 h-40 bg-white rounded-[28px] relative overflow-hidden group border border-white/10 flex flex-col justify-center items-center p-4 hover:bg-slate-200 transition-colors"
        >
          <Plus size={40} className="text-black mb-2 group-hover:scale-125 transition-transform duration-300" strokeWidth={3} />
          <span className="text-black font-black text-sm uppercase tracking-widest">ADD</span>
        </button>

        {/* Settings */}
        <button 
          onClick={() => router.push('/settings')}
          className="col-span-12 bg-[#111] border border-white/5 rounded-[24px] p-4 flex items-center justify-between group hover:border-white/20 transition-colors relative overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
          <div className="flex items-center gap-4 z-10">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center font-mono text-xs text-white border border-white/10">
              ID
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-200 text-sm">SYSTEM CONFIG</div>
              <div className="text-[10px] text-slate-500 font-mono">STATUS: ONLINE</div>
            </div>
          </div>
          <Settings size={18} className="text-slate-500 group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      {/* Recent Items Section */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Recent</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              className={cn(viewMode === 'grid' && 'bg-white/10')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewMode('list')}
              className={cn(viewMode === 'list' && 'bg-white/10')}
            >
              <List className="h-4 w-4" />
            </Button>
            <FilterDrawer />
          </div>
        </div>

        <MediaGrid onMediaClick={handleMediaClick} />
      </div>

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

      {/* Random Picker */}
      <Dialog open={randomPickerOpen} onOpenChange={setRandomPickerOpen}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Random Picker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-white/60">
              Pick something random from your planned list.
            </p>
            <div className="p-4 rounded-xl glass-card">
              <p className="text-sm text-indigo-400">
                {filteredMedia.filter(m => m.status === 'planned').length} items available
              </p>
            </div>
            <Button 
              onClick={pickRandom} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Pick Random
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
