'use client';

import { forwardRef } from 'react';
import { Heart, Star, Check, Film, Tv, BookOpen, Gamepad2, Sparkles, MoreHorizontal } from 'lucide-react';
import { cn, truncate } from '@/lib/utils';
import type { Media } from '@/types';

const typeConfig: Record<string, { icon: React.ReactNode; gradient: string }> = {
  movie: { 
    icon: <Film size={14} strokeWidth={2.5} />, 
    gradient: 'from-cyan-500 to-blue-600',
  },
  tv: { 
    icon: <Tv size={14} strokeWidth={2.5} />, 
    gradient: 'from-violet-500 to-fuchsia-600',
  },
  anime: { 
    icon: <Sparkles size={14} strokeWidth={2.5} />, 
    gradient: 'from-pink-500 to-rose-600',
  },
  book: { 
    icon: <BookOpen size={14} strokeWidth={2.5} />, 
    gradient: 'from-amber-400 to-orange-500',
  },
  game: { 
    icon: <Gamepad2 size={14} strokeWidth={2.5} />, 
    gradient: 'from-emerald-400 to-teal-500',
  },
  manga: { 
    icon: <BookOpen size={14} strokeWidth={2.5} />, 
    gradient: 'from-red-500 to-orange-600',
  },
  manhwa: { 
    icon: <BookOpen size={14} strokeWidth={2.5} />, 
    gradient: 'from-indigo-400 to-blue-600',
  },
  manhua: { 
    icon: <BookOpen size={14} strokeWidth={2.5} />, 
    gradient: 'from-rose-500 to-pink-600',
  },
  donghua: { 
    icon: <Sparkles size={14} strokeWidth={2.5} />, 
    gradient: 'from-red-500 to-rose-600',
  },
  misc: { 
    icon: <MoreHorizontal size={14} strokeWidth={2.5} />, 
    gradient: 'from-gray-500 to-slate-600',
  },
};

interface MediaCardProps {
  media: Media;
  viewMode?: 'grid' | 'list';
  onClick?: () => void;
  className?: string;
}

export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  function MediaCard({ media, viewMode = 'grid', onClick, className }, ref) {
    const config = typeConfig[media.type] || typeConfig.movie;
    const isCompleted = media.status === 'completed';

    if (viewMode === 'list') {
      return (
        <div 
          ref={ref}
          onClick={onClick}
          className={cn(
            'group relative overflow-hidden rounded-2xl mb-2',
            'bg-[#1a1a1a]/40 backdrop-blur-xl border border-white/10',
            'hover:border-white/20 transition-all duration-300',
            'min-h-[80px]',
            className
          )}
        >
          <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b', config.gradient)} />
          
          <div className="p-4 flex gap-4 items-center relative z-10">
            {/* Poster Thumbnail for List */}
            <div className="w-12 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10">
              {media.poster_url ? (
                <img 
                  src={media.poster_url} 
                  alt={media.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                  <span className="text-lg font-black text-white/30">{media.title.charAt(0)}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className={cn(
                  'font-bold text-base text-white/90 truncate pr-4',
                  isCompleted && 'line-through opacity-50'
                )}>
                  {media.title}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 border border-white/5 px-2 py-0.5 rounded bg-black/40">
                  {media.release_year || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                {media.genres.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); }}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border transition-all',
                isCompleted 
                  ? 'bg-white text-black border-white' 
                  : 'border-white/10 text-white/20 hover:text-white'
              )}
            >
              <Check size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
      );
    }

    // Grid View - Poster with name underneath
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'group relative flex flex-col gap-2',
          className
        )}
      >
        {/* Poster Container */}
        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/10 group-hover:border-white/20 transition-all duration-300">
          {/* Poster Image */}
          {media.poster_url ? (
            <img 
              src={media.poster_url} 
              alt={media.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
              <span className="text-6xl font-black text-white/20">{media.title.charAt(0)}</span>
            </div>
          )}
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            {/* Type Badge */}
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br text-white mb-2',
              config.gradient
            )}>
              {config.icon}
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); }}
                className={cn(
                  'flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all',
                  isCompleted 
                    ? 'bg-white text-black' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                )}
              >
                <Check size={12} className="mr-1" />
                {isCompleted ? 'Completed' : 'Mark Done'}
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          {isCompleted && (
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center">
              <Check size={14} className="text-black" strokeWidth={3} />
            </div>
          )}

          {/* Rating Badge */}
          {media.api_rating && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm flex items-center gap-1">
              <Star size={10} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-white">{media.api_rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Title Below Poster */}
        <div className="px-1">
          <h3 className={cn(
            'font-bold text-sm text-white leading-tight line-clamp-2',
            isCompleted && 'line-through opacity-50'
          )}>
            {truncate(media.title, 50)}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-white/50">{media.release_year || 'N/A'}</span>
            {media.genres.length > 0 && (
              <>
                <span className="text-[10px] text-white/30">•</span>
                <span className="text-[10px] text-white/50 truncate">{media.genres[0]}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);
