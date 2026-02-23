'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Clock, CheckCircle, Plus, Heart, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaStore } from '@/store/mediaStore';
import { cn, getStatusLabel, getTypeLabel } from '@/lib/utils';

// Mock history data
const mockHistory = [
  { id: '1', action: 'added', title: 'Attack on Titan', type: 'anime', time: '2026-02-23T10:00:00Z' },
  { id: '2', action: 'completed', title: 'The Last of Us', type: 'tv', time: '2026-02-22T15:30:00Z' },
  { id: '3', action: 'updated', title: 'One Piece', type: 'anime', time: '2026-02-21T20:00:00Z' },
  { id: '4', action: 'favorited', title: 'Cyberpunk: Edgerunners', type: 'anime', time: '2026-02-20T09:00:00Z' },
  { id: '5', action: 'added', title: 'Dune: Part Two', type: 'movie', time: '2026-02-19T14:00:00Z' },
  { id: '6', action: 'completed', title: 'Baldur\'s Gate 3', type: 'game', time: '2026-02-18T22:00:00Z' },
];

const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  added: { icon: <Plus className="h-4 w-4" />, color: 'bg-blue-500', label: 'Added' },
  completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500', label: 'Completed' },
  updated: { icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-500', label: 'Updated' },
  favorited: { icon: <Heart className="h-4 w-4" />, color: 'bg-pink-500', label: 'Favorited' },
  archived: { icon: <Archive className="h-4 w-4" />, color: 'bg-gray-500', label: 'Archived' },
};

export default function TimelinePage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">TIMELINE</h1>
          <p className="text-sm text-white/50 font-mono">タイムライン</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {mockHistory.map((event, index) => {
          const config = actionConfig[event.action] || actionConfig.added;
          
          return (
            <div key={event.id} className="relative pl-8">
              {/* Timeline line */}
              {index < mockHistory.length - 1 && (
                <div className="absolute left-3.5 top-8 bottom-0 w-px bg-white/10" />
              )}
              
              {/* Dot */}
              <div className={cn(
                'absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center',
                config.color
              )}>
                {config.icon}
              </div>

              {/* Card */}
              <div className="glass-card rounded-2xl p-4 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                        {getTypeLabel(event.type)}
                      </span>
                      <span className="text-[10px] text-white/30">•</span>
                      <span className="text-[10px] text-white/50">
                        {formatDistanceToNow(new Date(event.time), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="font-bold text-white truncate">{event.title}</h3>
                    <p className="text-xs text-white/40 mt-1">
                      {config.label} to library
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state if no history */}
      {mockHistory.length === 0 && (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">No activity yet.</p>
          <p className="text-sm text-white/30 mt-2">Start adding media to see your timeline.</p>
        </div>
      )}
    </div>
  );
}
