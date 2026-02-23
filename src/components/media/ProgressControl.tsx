'use client';

import { useState, useCallback } from 'react';
import { Minus, Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn, getUnitLabel } from '@/lib/utils';
import type { Media } from '@/types';

interface ProgressControlProps {
  media: Media;
  onUpdate: (progress: number) => void;
  className?: string;
}

export function ProgressControl({ media, onUpdate, className }: ProgressControlProps) {
  const [localProgress, setLocalProgress] = useState(media.progress);

  const handleUpdate = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(value, media.total_units || 100));
    setLocalProgress(clamped);
    onUpdate(clamped);
  }, [media.total_units, onUpdate]);

  const isGame = media.type === 'game';
  const total = isGame ? 100 : (media.total_units || 1);
  const unitLabel = getUnitLabel(media.type);
  const isComplete = media.completion_percent >= 100;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">
            {isGame ? 'Completion' : `Progress (${unitLabel})`}
          </span>
          {isComplete && (
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <Trophy className="h-3 w-3" />
              <span>Completed!</span>
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-2xl font-bold",
            isComplete ? "text-green-400" : "text-white"
          )}>
            {Math.round(media.completion_percent)}
          </span>
          <span className="text-sm text-white/40">%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: isComplete 
              ? 'linear-gradient(90deg, #22c55e, #10b981)' 
              : 'linear-gradient(90deg, #7c5cff, #00d4ff)',
            width: `${media.completion_percent}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-50 blur-sm"
          style={{
            background: isComplete 
              ? 'linear-gradient(90deg, #22c55e, #10b981)' 
              : 'linear-gradient(90deg, #7c5cff, #00d4ff)',
            width: `${media.completion_percent}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Controls */}
      {isGame ? (
        // Game: Use slider for percentage
        <div className="space-y-4">
          <Slider
            value={[localProgress]}
            max={100}
            step={1}
            onValueChange={([v]) => handleUpdate(v)}
            className="cursor-pointer"
          />
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>0%</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span>50%</span>
              <div className="w-2 h-2 rounded-full bg-cyan-500" />
            </div>
            <span>100%</span>
          </div>
        </div>
      ) : (
        // Other types: Counter controls
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleUpdate(localProgress - 1)}
            disabled={localProgress <= 0}
            className="h-12 w-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/30"
          >
            <Minus className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <Input
              type="number"
              value={localProgress}
              onChange={(e) => handleUpdate(parseInt(e.target.value) || 0)}
              className="w-20 text-center text-lg font-bold bg-transparent border-0 focus-visible:ring-0 p-0"
              min={0}
              max={media.total_units || 99999}
            />
            <span className="text-white/40">/</span>
            <span className="text-white/60 font-medium">
              {media.total_units || '?'}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handleUpdate(localProgress + 1)}
            className="h-12 w-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/30"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Quick set buttons */}
      {!isGame && media.total_units > 0 && (
        <div className="flex justify-center gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <Button
              key={percent}
              variant="ghost"
              size="sm"
              onClick={() => handleUpdate(Math.round((media.total_units * percent) / 100))}
              className="text-xs text-white/50 hover:text-white hover:bg-white/10"
            >
              {percent}%
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
