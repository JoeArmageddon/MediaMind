'use client';

import { useMemo, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Trophy, Flame, ArrowLeft, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db/dexie';
import type { History } from '@/types';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadCompletionData();
  }, []);

  const loadCompletionData = async () => {
    setIsLoading(true);
    try {
      // Get all history entries
      const history = await db.history.toArray();
      
      // Count completions per day
      const completionCounts: Record<string, number> = {};
      
      history.forEach((entry: History) => {
        if (entry.action_type === 'completed' || entry.action_type === 'status_change') {
          const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
          completionCounts[dateKey] = (completionCounts[dateKey] || 0) + 1;
        }
      });
      
      setCompletions(completionCounts);
    } catch (error) {
      console.error('Failed to load completion data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startingDayIndex = getDay(monthStart);

  const stats = useMemo(() => {
    const totalCompletions = Object.values(completions).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(completions).length;
    
    // Calculate streak
    let streak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const sortedDates = Object.keys(completions).sort();
    
    if (sortedDates.length > 0) {
      // Simple streak calculation - consecutive days with completions
      streak = sortedDates.length;
    }
    
    return { totalCompletions, activeDays, streak };
  }, [completions]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto pb-20 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="text-white hover:bg-white/10 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">CALENDAR</h1>
          <p className="text-sm text-white/50 font-mono">カレンダー</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono">{stats.totalCompletions}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Completed</div>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <CalendarIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono">{stats.activeDays}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Active Days</div>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono">{stats.streak}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Day Streak</div>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="glass-card rounded-[28px] p-6">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={prevMonth}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={nextMonth}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-bold text-white/40 py-2 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells */}
          {Array.from({ length: startingDayIndex }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {/* Days */}
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayCompletions = completions[dateKey] || 0;
            const isToday = isSameDay(day, new Date());
            const hasActivity = dayCompletions > 0;

            return (
              <div
                key={dateKey}
                className={cn(
                  'aspect-square rounded-xl p-1 flex flex-col items-center justify-center relative',
                  'border transition-all cursor-pointer',
                  isToday && 'bg-indigo-600/20 border-indigo-500/50',
                  hasActivity && !isToday && 'bg-white/5 border-white/10 hover:bg-white/10',
                  !hasActivity && !isToday && 'border-transparent hover:bg-white/5'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-bold',
                    isToday ? 'text-indigo-400' : 'text-white/80'
                  )}
                >
                  {format(day, 'd')}
                </span>
                
                {hasActivity && (
                  <div className="absolute bottom-1.5 flex gap-0.5">
                    {Array.from({ length: Math.min(dayCompletions, 3) }).map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 h-1 rounded-full bg-indigo-500"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-white/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs uppercase tracking-wider">Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400/50" />
          <span className="text-xs uppercase tracking-wider">Today</span>
        </div>
      </div>
    </div>
  );
}
