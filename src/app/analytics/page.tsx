'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, TrendingUp, Clock, CheckCircle, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaStore } from '@/store/mediaStore';
import { calculateEstimatedHours, getTypeLabel } from '@/lib/utils';

const COLORS = {
  movie: '#06b6d4',
  tv: '#8b5cf6',
  anime: '#ec4899',
  game: '#10b981',
  book: '#f59e0b',
  manga: '#ef4444',
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { media } = useMediaStore();

  const analytics = useMemo(() => {
    if (media.length === 0) return null;

    const completed = media.filter((m) => m.status === 'completed');
    const inProgress = media.filter((m) => m.status === 'watching');
    const totalHours = media.reduce((acc, m) => acc + calculateEstimatedHours(m), 0);

    // Type distribution
    const typeCounts: Record<string, number> = {};
    media.forEach((m) => {
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
    });

    const typeData = Object.entries(typeCounts).map(([type, count]) => ({
      name: getTypeLabel(type),
      value: count,
      color: COLORS[type as keyof typeof COLORS] || '#6b7280',
    }));

    // Monthly activity (mock)
    const monthlyData = [
      { month: 'Jan', count: Math.floor(Math.random() * 8) + 1 },
      { month: 'Feb', count: Math.floor(Math.random() * 8) + 1 },
      { month: 'Mar', count: Math.floor(Math.random() * 8) + 1 },
      { month: 'Apr', count: Math.floor(Math.random() * 8) + 1 },
      { month: 'May', count: Math.floor(Math.random() * 8) + 1 },
      { month: 'Jun', count: Math.floor(Math.random() * 8) + 1 },
    ];

    return {
      total: media.length,
      completed: completed.length,
      inProgress: inProgress.length,
      completionRate: Math.round((completed.length / media.length) * 100),
      totalHours: Math.round(totalHours),
      typeData,
      monthlyData,
    };
  }, [media]);

  if (!analytics) {
    return (
      <div className="max-w-3xl mx-auto pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-black text-white tracking-tighter">STATS</h1>
        </div>
        <div className="glass-card rounded-[28px] p-12 text-center">
          <p className="text-white/50">No data yet. Add some media to see analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">STATS</h1>
          <p className="text-sm text-white/50 font-mono">統計</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Archive className="h-5 w-5 text-white/60" />
            </div>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Total</span>
          </div>
          <div className="text-3xl font-black font-mono">{analytics.total}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Completed</span>
          </div>
          <div className="text-3xl font-black font-mono text-green-500">{analytics.completionRate}%</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">In Progress</span>
          </div>
          <div className="text-3xl font-black font-mono text-blue-500">{analytics.inProgress}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Hours</span>
          </div>
          <div className="text-3xl font-black font-mono text-amber-500">{analytics.totalHours}h</div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="glass-card rounded-[28px] p-6">
        <h2 className="text-lg font-bold text-white mb-6 tracking-tight">BY TYPE</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analytics.typeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {analytics.typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {analytics.typeData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-white/60">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Activity */}
      <div className="glass-card rounded-[28px] p-6">
        <h2 className="text-lg font-bold text-white mb-6 tracking-tight">ACTIVITY</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.monthlyData}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
