'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Public route (see isPublicRoute in middleware.ts) - this is how someone
// without a MediaMind account (or with one, sitting on /pending) gets on
// the beta list in the first place. Styled like sign-in/privacy - always
// dark, ignoring the manga-mode CSS variables - since this is a
// pre-account page reached before there's any theme preference to honor.
export default function ApplyPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lastFinished, setLastFinished] = useState('');
  const [currentTracking, setCurrentTracking] = useState('');
  const [whyInterested, setWhyInterested] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, lastFinished, currentTracking, whyInterested }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Something went wrong - try again.');
        return;
      }
      setMessage(body.message || "Application received - we'll review it soon.");
    } catch {
      setError('Network error - check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to MediaMind
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Apply for beta access</h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed">
            MediaMind is currently open to a small group of testers while it&apos;s in beta. Tell us
            a bit about yourself and we&apos;ll get back to you - already have an account? Applying
            works the same either way.
          </p>
        </div>

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm text-white/70">{message}</p>
            <p className="text-xs text-white/40">
              Already signed up?{' '}
              <Link href="/sign-in" className="text-indigo-400 hover:opacity-80">
                Sign in
              </Link>{' '}
              and you&apos;ll land on a waiting page until you&apos;re approved.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-white/60">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-white/60">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                required
                className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lastFinished" className="text-xs font-medium text-white/60">
                What&apos;s the last thing you finished (a show, book, game, anything) - and how did
                you feel about it?
              </label>
              <Textarea
                id="lastFinished"
                value={lastFinished}
                onChange={(e) => setLastFinished(e.target.value)}
                maxLength={1000}
                required
                className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="currentTracking" className="text-xs font-medium text-white/60">
                How do you currently track what you&apos;re watching, reading, or playing?
              </label>
              <Textarea
                id="currentTracking"
                value={currentTracking}
                onChange={(e) => setCurrentTracking(e.target.value)}
                maxLength={1000}
                required
                className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="whyInterested" className="text-xs font-medium text-white/60">
                Why are you interested in MediaMind?
              </label>
              <Textarea
                id="whyInterested"
                value={whyInterested}
                onChange={(e) => setWhyInterested(e.target.value)}
                maxLength={1000}
                required
                className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                'Submit application'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
