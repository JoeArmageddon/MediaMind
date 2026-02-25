'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Heart,
  Star,
  Calendar,
  Play,
  Trash2,
  Archive,
  Sparkles,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusSelect } from './StatusSelect';
import { ProgressControl } from './ProgressControl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getTypeLabel, formatDate } from '@/lib/utils';
import type { Media } from '@/types';

interface MediaDetailProps {
  media: Media;
  onUpdate: (updates: Partial<Media>) => void;
  onDelete: () => void;
  onAISuggestions: () => void;
  onClose?: () => void;
  className?: string;
}

export function MediaDetail({
  media,
  onUpdate,
  onDelete,
  onAISuggestions,
  onClose,
  className,
}: MediaDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <ScrollArea className="h-full max-h-[85vh]">
      <div className={cn('flex flex-col lg:flex-row gap-0', className)}>
        {/* Poster - Smaller on mobile */}
        <div className="relative lg:w-2/5 lg:min-h-[500px]">
          <div className="relative h-[35vh] sm:h-[40vh] lg:absolute lg:inset-0 lg:h-full overflow-hidden">
            {media.poster_url ? (
              <Image
                src={media.poster_url}
                alt={media.title}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-violet-500/10">
                <span className="text-6xl lg:text-8xl font-bold text-white/10">
                  {media.title.charAt(0)}
                </span>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent lg:bg-gradient-to-r" />
            
            {/* Close button for mobile */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-3 right-3 lg:hidden bg-black/50 hover:bg-black/70 h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
            )}

            {/* Top actions */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdate({ is_favorite: !media.is_favorite })}
                className={cn(
                  'rounded-full bg-black/50 hover:bg-black/70 h-9 w-9',
                  media.is_favorite && 'bg-pink-500/80'
                )}
              >
                <Heart
                  className={cn(
                    'h-4 w-4 lg:h-5 lg:w-5',
                    media.is_favorite ? 'fill-white text-white' : 'text-white'
                  )}
                />
              </Button>
            </div>

            {/* Bottom actions - Mobile optimized */}
            <div className="absolute bottom-3 left-3 right-3">
              {!showDeleteConfirm ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-violet-600 hover:bg-violet-500 h-10 text-sm"
                    onClick={() => onUpdate({ status: media.status === 'watching' ? 'completed' : 'watching' })}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {media.status === 'watching' ? 'Complete' : 'Watch'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdate({ is_archived: !media.is_archived })}
                    className="border-white/20 bg-black/50 hover:bg-white/10 h-10 w-10"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="border-white/20 bg-black/50 hover:bg-red-500/80 h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="glass-card rounded-xl p-3 border-red-500/30 bg-red-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-bold text-white truncate">Delete "{media.title}"?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 border-white/20 bg-black/50 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDelete}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex-1 p-4 lg:p-6">
          <div className="space-y-4">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-violet-600 border-0 text-xs">
                  {getTypeLabel(media.type)}
                </Badge>
                {media.release_year && (
                  <Badge variant="outline" className="border-white/20 bg-white/5 text-xs">
                    <Calendar className="mr-1 h-3 w-3" />
                    {media.release_year}
                  </Badge>
                )}
                {media.api_rating && (
                  <Badge variant="outline" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-400 text-xs">
                    <Star className="mr-1 h-3 w-3 fill-current" />
                    {media.api_rating.toFixed(1)}
                  </Badge>
                )}
              </div>

              <h1 className="text-xl lg:text-3xl font-bold text-white leading-tight">
                {media.title}
              </h1>

              {media.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {media.genres.slice(0, 4).map((genre) => (
                    <Badge 
                      key={genre} 
                      variant="secondary" 
                      className="text-[10px] lg:text-xs bg-white/5 border-white/10"
                    >
                      {genre}
                    </Badge>
                  ))}
                  {media.genres.length > 4 && (
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
                      +{media.genres.length - 4}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {media.description && (
              <p className="text-white/60 text-sm leading-relaxed line-clamp-4 lg:line-clamp-none">
                {media.description}
              </p>
            )}

            {/* Tabs */}
            <Tabs defaultValue="progress" className="w-full">
              <TabsList className="w-full bg-white/5 border border-white/10 p-1 h-auto">
                <TabsTrigger 
                  value="progress" 
                  className="flex-1 text-xs lg:text-sm py-2 data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300"
                >
                  Progress
                </TabsTrigger>
                <TabsTrigger 
                  value="streaming"
                  className="flex-1 text-xs lg:text-sm py-2 data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300"
                >
                  Streaming
                </TabsTrigger>
                <TabsTrigger 
                  value="notes"
                  className="flex-1 text-xs lg:text-sm py-2 data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300"
                >
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="progress" className="space-y-3 mt-3">
                <div className="p-3 lg:p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Status</span>
                    <StatusSelect
                      value={media.status}
                      onChange={(status) => onUpdate({ status })}
                    />
                  </div>

                  <ProgressControl
                    media={media}
                    onUpdate={(progress) => onUpdate({ progress })}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full border-violet-500/30 bg-violet-500/5 h-10 text-sm"
                  onClick={onAISuggestions}
                >
                  <Sparkles className="mr-2 h-4 w-4 text-violet-400" />
                  AI Suggestions
                </Button>
              </TabsContent>

              <TabsContent value="streaming" className="mt-3">
                <div className="p-3 lg:p-4 bg-white/5 border border-white/10 rounded-lg">
                  {media.streaming_platforms?.length > 0 ? (
                    <div className="space-y-2">
                      {media.streaming_platforms.map((platform) => (
                        <div
                          key={platform.platform}
                          className="flex items-center justify-between p-2.5 lg:p-3 bg-white/5 rounded-lg"
                        >
                          <span className="font-medium text-sm">{platform.platform}</span>
                          <Badge 
                            variant={platform.type === 'subscription' ? 'default' : 'outline'}
                            className={platform.type === 'subscription' ? 'bg-green-500/20 text-green-400 text-xs' : 'text-xs'}
                          >
                            {platform.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-white/40 text-sm">
                      No streaming information
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-3">
                <textarea
                  className="w-full min-h-[120px] lg:min-h-[150px] rounded-lg bg-white/5 border border-white/10 p-3 text-sm resize-none focus:outline-none focus:border-violet-500/50 text-white"
                  placeholder="Add your notes..."
                  value={media.notes || ''}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                />
              </TabsContent>
            </Tabs>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs text-white/40 pt-2 pb-4">
              <div>
                <span className="block text-white/20 mb-1">Added</span>
                {formatDate(media.created_at)}
              </div>
              <div>
                <span className="block text-white/20 mb-1">Updated</span>
                {formatDate(media.updated_at)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
