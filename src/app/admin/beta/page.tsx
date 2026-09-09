'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Check, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Application {
  id: string;
  email: string;
  name: string;
  last_finished: string;
  current_tracking: string;
  why_interested: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

// Admin-only (enforced server-side by every /api/beta/* route this page
// calls, against the single hardcoded ADMIN_EMAIL - see src/lib/admin.ts).
// A non-admin who lands here just gets a 403 and an empty list; no
// application data is ever sent to the client before that check passes.
export default function AdminBetaPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const qs = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/beta/applications${qs}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await res.json();
      setApplications(body.applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/beta/applications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNote: notes[id]?.trim() || undefined }),
      });
      if (res.ok) {
        setApplications((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setReviewingId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <ShieldAlert className="h-8 w-8 text-[var(--mm-danger)] mx-auto" />
        <p className="text-sm text-[var(--mm-text-60)]">
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-[var(--mm-text)] tracking-tighter">
            BETA APPLICATIONS
          </h1>
          <p className="text-sm text-[var(--mm-text-50)]">Review and approve testers</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
              filter === f
                ? 'bg-[var(--mm-primary)] text-white'
                : 'bg-[var(--mm-hover-bg)] text-[var(--mm-text-60)] hover:text-[var(--mm-text)]'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--mm-text-40)]" />
        </div>
      ) : applications.length === 0 ? (
        <p className="text-sm text-[var(--mm-text-40)] text-center py-16">
          No {filter === 'all' ? '' : filter} applications.
        </p>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-[var(--mm-text)]">{app.name}</p>
                  <p className="text-xs text-[var(--mm-text-40)] font-mono">{app.email}</p>
                </div>
                <span className="text-[10px] text-[var(--mm-text-30)] whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="text-sm text-[var(--mm-text-70)] space-y-2">
                <p>
                  <span className="text-[var(--mm-text-40)]">Last finished: </span>
                  {app.last_finished}
                </p>
                <p>
                  <span className="text-[var(--mm-text-40)]">Currently tracks via: </span>
                  {app.current_tracking}
                </p>
                <p>
                  <span className="text-[var(--mm-text-40)]">Why interested: </span>
                  {app.why_interested}
                </p>
              </div>

              {app.status === 'pending' ? (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder="Optional review note"
                    value={notes[app.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => review(app.id, 'approved')}
                      disabled={reviewingId === app.id}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => review(app.id, 'rejected')}
                      disabled={reviewingId === app.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full font-medium capitalize',
                      app.status === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    )}
                  >
                    {app.status}
                  </span>
                  {app.review_note && (
                    <span className="text-[var(--mm-text-40)]">{app.review_note}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
