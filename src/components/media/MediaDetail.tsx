'use client';

import { useEffect, useRef, useState } from 'react';
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
  Tv2,
  Loader2,
  Brain,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusSelect } from './StatusSelect';
import { ProgressControl } from './ProgressControl';
import { AISuggestionsDialog } from './AISuggestionsDialog';
import { RecommendDialog } from './RecommendDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getTypeLabel, formatDate } from '@/lib/utils';
import { createJustWatchClient } from '@/lib/api/justwatch';
import { getAIClient } from '@/lib/ai';
import type { Media } from '@/types';

const NOTES_DEBOUNCE_MS = 600;

interface MediaDetailProps {
  media: Media;
  onUpdate?: (updates: Partial<Media>) => void;
  onDelete?: () => void;
  onClose?: () => void;
  className?: string;
  // Set when viewing someone else's media (a friend's library, or another
  // collaborator's item in a shared collection) - RLS would reject any
  // write anyway, so every mutating control is hidden rather than left to
  // fail silently. Informational content (description, existing AI
  // analysis, streaming info, notes) still renders normally.
  readOnly?: boolean;
}

export function MediaDetail({
  media,
  onUpdate,
  onDelete,
  onClose,
  className,
  readOnly = false,
}: MediaDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const [isFindingStreaming, setIsFindingStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const analyzeTone = async () => {
    if (readOnly) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await getAIClient().analyzeMedia({
        title: media.title,
        description: media.description,
        genres: media.genres,
      });
      if (analysis) {
        onUpdate?.({
          ai_primary_tone: analysis.primary_tone,
          ai_secondary_tone: analysis.secondary_tone,
          ai_core_themes: analysis.core_themes,
          ai_emotional_intensity: analysis.emotional_intensity,
          ai_pacing: analysis.pacing,
          ai_darkness_level: analysis.darkness_level,
          ai_intellectual_depth: analysis.intellectual_depth,
        });
      } else {
        setAnalysisError('Analysis is unavailable right now - check that a Groq or Gemini API key is set in Settings.');
      }
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Failed to analyze this title.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const findStreaming = async () => {
    if (readOnly) return;
    setIsFindingStreaming(true);
    setStreamingError(null);
    try {
      const platforms = await createJustWatchClient().getStreamingAvailability(
        media.title,
        media.release_year ?? undefined
      );
      if (platforms.length === 0) {
        setStreamingError('No streaming availability found for this title in India.');
      } else {
        onUpdate?.({ streaming_platforms: platforms });
      }
    } catch (e) {
      setStreamingError(e instanceof Error ? e.message : 'Failed to look up streaming availability.');
    } finally {
      setIsFindingStreaming(false);
    }
  };

  // Notes: keep local state so typing is instant, but only push to
  // onUpdate() (Dexie write + history entry) after the user pauses, and
  // always flush immediately on blur so nothing typed is lost.
  const [notesDraft, setNotesDraft] = useState(media.notes || '');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotesDraft(media.notes || '');
  }, [media.id, media.notes]);

  const scheduleNotesUpdate = (value: string) => {
    if (readOnly) return;
    setNotesDraft(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      onUpdate?.({ notes: value });
    }, NOTES_DEBOUNCE_MS);
  };

  const flushNotesUpdate = () => {
    if (readOnly) return;
    if (notesTimer.current) {
      clearTimeout(notesTimer.current);
      notesTimer.current = null;
    }
    if (notesDraft !== (media.notes || '')) {
      onUpdate?.({ notes: notesDraft });
    }
  };

  useEffect(() => {
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, []);

  const handleDelete = () => {
    onDelete?.();
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
                <span className="text-6xl lg:text-8xl font-bold text-[var(--mm-text-20)]">
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
            {!readOnly && (
              <div className="absolute top-3 left-3 flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onUpdate?.({ is_favorite: !media.is_favorite })}
                  className={cn(
                    'rounded-full bg-black/50 hover:bg-black/70 h-9 w-9',
                    media.is_favorite && 'bg-pink-500/80'
                  )}
                >
                  <Heart
                    className={cn(
                      'h-4 w-4 lg:h-5 lg:w-5',
                      media.is_favorite ? 'fill-white text-[var(--mm-text)]' : 'text-[var(--mm-text)]'
                    )}
                  />
                </Button>
              </div>
            )}

            {/* Bottom actions - Mobile optimized */}
            <div className="absolute bottom-3 left-3 right-3">
              {readOnly ? null : !showDeleteConfirm ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-violet-600 hover:bg-violet-500 h-10 text-sm"
                    onClick={() => onUpdate?.({ status: media.status === 'watching' ? 'completed' : 'watching' })}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {media.status === 'watching' ? 'Complete' : 'Watch'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdate?.({ is_archived: !media.is_archived })}
                    className="border-[var(--mm-card-border-hover)] bg-black/50 hover:bg-[var(--mm-hover-bg-strong)] h-10 w-10"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="border-[var(--mm-card-border-hover)] bg-black/50 hover:bg-red-500/80 h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="glass-card rounded-xl p-3 border-red-500/30 bg-red-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-bold text-[var(--mm-text)] truncate">Delete "{media.title}"?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 border-[var(--mm-card-border-hover)] bg-black/50 text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)]"
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
                  <Badge variant="outline" className="border-[var(--mm-card-border-hover)] bg-[var(--mm-hover-bg)] text-xs">
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

              <h1 className="text-xl lg:text-3xl font-bold text-[var(--mm-text)] leading-tight">
                {media.title}
              </h1>

              {media.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {media.genres.slice(0, 4).map((genre) => (
                    <Badge 
                      key={genre} 
                      variant="secondary" 
                      className="text-[10px] lg:text-xs bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)]"
                    >
                      {genre}
                    </Badge>
                  ))}
                  {media.genres.length > 4 && (
                    <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)]">
                      +{media.genres.length - 4}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {media.description && (
              <p className="text-[var(--mm-text-60)] text-sm leading-relaxed line-clamp-4 lg:line-clamp-none">
                {media.description}
              </p>
            )}

            {/* Tabs */}
            <Tabs defaultValue="progress" className="w-full">
              <TabsList className="w-full bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] p-1 h-auto">
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
                  {readOnly ? 'Review' : 'Your Review'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="progress" className="space-y-3 mt-3">
                <div className="p-3 lg:p-4 bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--mm-text-70)]">Status</span>
                    {readOnly ? (
                      <Badge variant="secondary" className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] capitalize">
                        {media.status.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <StatusSelect
                        value={media.status}
                        onChange={(status) => onUpdate?.({ status })}
                      />
                    )}
                  </div>

                  {readOnly ? (
                    <div className="text-sm text-[var(--mm-text-70)]">
                      Progress: {media.progress}
                      {media.total_units > 0 ? ` / ${media.total_units}` : ''}
                    </div>
                  ) : (
                    <ProgressControl
                      media={media}
                      onUpdate={(progress) => onUpdate?.({ progress })}
                    />
                  )}
                </div>

                {!readOnly && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-violet-500/30 bg-violet-500/5 h-10 text-sm"
                      onClick={() => setShowAISuggestions(true)}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-violet-400" />
                      AI Suggestions
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-indigo-500/30 bg-indigo-500/5 h-10 text-sm"
                      onClick={() => setShowRecommend(true)}
                    >
                      <Send className="mr-2 h-4 w-4 text-indigo-400" />
                      Recommend
                    </Button>
                  </div>
                )}

                {/* Thematic Analysis */}
                {media.ai_primary_tone ? (
                  <div className="p-3 lg:p-4 bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--mm-text-40)] uppercase tracking-wider">Thematic Analysis</span>
                      {!readOnly && (
                        <button
                          onClick={analyzeTone}
                          disabled={isAnalyzing}
                          className="text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-50"
                        >
                          {isAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-xs">
                        {media.ai_primary_tone}
                      </Badge>
                      {media.ai_secondary_tone && (
                        <Badge variant="secondary" className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-xs">
                          {media.ai_secondary_tone}
                        </Badge>
                      )}
                      {media.ai_pacing && (
                        <Badge variant="outline" className="border-[var(--mm-card-border)] text-[var(--mm-text-50)] text-xs">
                          {media.ai_pacing} pacing
                        </Badge>
                      )}
                    </div>
                    {media.ai_core_themes?.length > 0 && (
                      <p className="text-xs text-[var(--mm-text-50)]">{media.ai_core_themes.join(' · ')}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div>
                        <div className="text-sm font-mono text-[var(--mm-text)]">{media.ai_emotional_intensity ?? '—'}</div>
                        <div className="text-[9px] text-[var(--mm-text-30)] uppercase">Intensity</div>
                      </div>
                      <div>
                        <div className="text-sm font-mono text-[var(--mm-text)]">{media.ai_darkness_level ?? '—'}</div>
                        <div className="text-[9px] text-[var(--mm-text-30)] uppercase">Darkness</div>
                      </div>
                      <div>
                        <div className="text-sm font-mono text-[var(--mm-text)]">{media.ai_intellectual_depth ?? '—'}</div>
                        <div className="text-[9px] text-[var(--mm-text-30)] uppercase">Depth</div>
                      </div>
                    </div>
                  </div>
                ) : !readOnly ? (
                  <Button
                    variant="outline"
                    className="w-full border-[var(--mm-card-border)] bg-[var(--mm-hover-bg)] h-10 text-sm"
                    onClick={analyzeTone}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--mm-text-60)]" />
                    ) : (
                      <Brain className="mr-2 h-4 w-4 text-[var(--mm-text-60)]" />
                    )}
                    Analyze Tone & Themes
                  </Button>
                ) : null}
                {analysisError && <p className="text-xs text-red-400 text-center">{analysisError}</p>}
              </TabsContent>

              <TabsContent value="streaming" className="mt-3 space-y-3">
                <div className="p-3 lg:p-4 bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] rounded-lg">
                  {media.streaming_platforms?.length > 0 ? (
                    <div className="space-y-2">
                      {media.streaming_platforms.map((platform) => (
                        <div
                          key={platform.platform}
                          className="flex items-center justify-between p-2.5 lg:p-3 bg-[var(--mm-hover-bg)] rounded-lg"
                        >
                          {platform.url ? (
                            <a
                              href={platform.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sm hover:text-violet-300 hover:underline"
                            >
                              {platform.platform}
                            </a>
                          ) : (
                            <span className="font-medium text-sm">{platform.platform}</span>
                          )}
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
                    <div className="text-center py-6 text-[var(--mm-text-40)] text-sm">
                      No streaming information
                    </div>
                  )}
                </div>

                {streamingError && (
                  <p className="text-xs text-red-400 text-center">{streamingError}</p>
                )}

                {!readOnly && (
                  <Button
                    variant="outline"
                    className="w-full border-violet-500/30 bg-violet-500/5 h-10 text-sm"
                    onClick={findStreaming}
                    disabled={isFindingStreaming}
                  >
                    {isFindingStreaming ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-400" />
                    ) : (
                      <Tv2 className="mr-2 h-4 w-4 text-violet-400" />
                    )}
                    {media.streaming_platforms?.length > 0 ? 'Refresh streaming info' : 'Find streaming'}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-3 space-y-3">
                <div className="flex items-center gap-1">
                  {[2, 4, 6, 8, 10].map((value) => {
                    const filled = (media.user_rating ?? 0) >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onUpdate?.({ user_rating: media.user_rating === value ? null : value })}
                        className={cn(
                          'p-0.5 transition-colors',
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                        )}
                        title={`${value / 2} / 5`}
                      >
                        <Star
                          className={cn(
                            'h-5 w-5',
                            filled ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--mm-text-20)]'
                          )}
                        />
                      </button>
                    );
                  })}
                  {media.user_rating != null && (
                    <span className="text-xs text-[var(--mm-text-40)] ml-1">{(media.user_rating / 2).toFixed(1)} / 5</span>
                  )}
                </div>

                {readOnly ? (
                  <p className="w-full min-h-[80px] rounded-lg bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] p-3 text-sm text-[var(--mm-text-70)] whitespace-pre-wrap">
                    {notesDraft || 'No review written.'}
                  </p>
                ) : (
                  <textarea
                    className="w-full min-h-[120px] lg:min-h-[150px] rounded-lg bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] p-3 text-sm resize-none focus:outline-none focus:border-violet-500/50 text-[var(--mm-text)]"
                    placeholder="What did you think?"
                    value={notesDraft}
                    onChange={(e) => scheduleNotesUpdate(e.target.value)}
                    onBlur={flushNotesUpdate}
                  />
                )}
              </TabsContent>
            </Tabs>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--mm-text-40)] pt-2 pb-4">
              <div>
                <span className="block text-[var(--mm-text-20)] mb-1">Added</span>
                {formatDate(media.created_at)}
              </div>
              <div>
                <span className="block text-[var(--mm-text-20)] mb-1">Updated</span>
                {formatDate(media.updated_at)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AISuggestionsDialog media={media} open={showAISuggestions} onOpenChange={setShowAISuggestions} />
      <RecommendDialog media={media} open={showRecommend} onOpenChange={setShowRecommend} />
    </ScrollArea>
  );
}
