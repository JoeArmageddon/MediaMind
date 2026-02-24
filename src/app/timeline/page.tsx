'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Clock, CheckCircle, Plus, Heart, Archive, PlayCircle, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/store/historyStore';
import { cn, getStatusLabel, getTypeLabel } from '@/lib/utils';

const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  added: { icon: <Plus className="h-4 w-4" />, color: 'bg-blue-500', label: 'Added' },
  completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500', label: 'Completed' },
  status_change: { icon: <RotateCcw className="h-4 w-4" />, color: 'bg-yellow-500', label: 'Status Changed' },
  progress_update: { icon: <PlayCircle className="h-4 w-4" />, color: 'bg-cyan-500', label: 'Progress Updated' },
  favorited: { icon: <Heart className="h-4 w-4" />, color: 'bg-pink-500', label: 'Favorited' },
  unarchived: { icon: <Archive className="h-4 w-4" />, color: 'bg-gray-500', label: 'Unarchived' },
  archived: { icon: <Archive className="h-4 w-4" />, color: 'bg-gray-600', label: 'Archived' },
  updated: { icon: <Clock className="h-4 w-4" />, color: 'bg-indigo-500', label: 'Updated' },
  deleted: { icon: <Clock className="h-4 w-4" />, color: 'bg-red-500', label: 'Deleted' },
};

export default function TimelinePage() {
  const router = useRouter();
  const { history, isLoading, fetchHistory } = useHistoryStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        </div>
      )}

      {/* Timeline */}
      {!isLoading && history.length > 0 && (
        <div className="space-y-4">
          {history.map((event, index) => {
            const config = actionConfig[event.action_type] || actionConfig.updated;
            
            return (
              <div key={event.id} className="relative pl-8">
                {/* Timeline line */}
                {index < history.length - 1 && (
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
                  <div className="flex items-start gap-4">
                    {/* Poster thumbnail */}
                    {event.media?.poster_url && (
                      <div className="w-12 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10">
                        <img 
                          src={event.media.poster_url} 
                          alt={event.media.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                          {getTypeLabel(event.media?.type || 'misc')}
                        </span>
                        <span className="text-[10px] text-white/30">•</span>
                        <span className="text-[10px] text-white/50">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="font-bold text-white truncate">{event.media?.title || 'Unknown'}</h3>
                      <p className="text-xs text-white/40 mt-1">
                        {config.label}
                        {event.value && typeof event.value === 'object' && 'status' in event.value && (
                          <span className="ml-1">→ {getStatusLabel(String(event.value.status))}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state if no history */}
      {!isLoading && history.length === 0 && (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">No activity yet.</p>
          <p className="text-sm text-white/30 mt-2">Start adding media to see your timeline.</p>
        </div>
      )}
    </div>
  );
}
