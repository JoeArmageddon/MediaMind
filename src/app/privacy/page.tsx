import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy - MediaMind',
};

// Public route (added to middleware's isPublicRoute list) - a privacy
// policy has to be readable before signing up, not just after. Written to
// actually describe what this app does, not adapted from a generic
// template - no analytics/tracking script exists anywhere in the
// codebase (confirmed by grep before writing this), so this doesn't
// hedge about "may use analytics" the way a boilerplate policy would.
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to MediaMind
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/40 font-mono mb-10">Last updated September 2026</p>

        <div className="space-y-8 text-white/70 text-sm leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mb-3 [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p]:mb-3">
          <section>
            <p>
              MediaMind is a personal media-tracking app, currently open to a small group of invited
              testers. This page explains what data the app collects, why, and who it&apos;s shared
              with. It&apos;s written to describe what the app actually does - not adapted from a
              generic template.
            </p>
          </section>

          <section>
            <h2>What we collect</h2>
            <ul>
              <li>
                <strong className="text-white/90">Account info</strong> - your name, email address,
                and profile picture, handled by our authentication provider, Clerk. We never see or
                store your password.
              </li>
              <li>
                <strong className="text-white/90">Your media library</strong> - titles you track,
                their status/progress, your ratings, and any notes or reviews you write.
              </li>
              <li>
                <strong className="text-white/90">Social data</strong> - your friend connections,
                invite codes, collections you create or share, and any recommendation messages you
                send to friends.
              </li>
              <li>
                <strong className="text-white/90">Local device storage</strong> - the app caches your
                library on your own device (browser IndexedDB) so it loads instantly and keeps
                working offline. This never leaves your device except to sync with our database.
              </li>
            </ul>
            <p>
              We don&apos;t collect analytics, tracking cookies, or advertising identifiers - there is
              no analytics script of any kind in this app.
            </p>
          </section>

          <section>
            <h2>Who it&apos;s shared with</h2>
            <ul>
              <li>
                <strong className="text-white/90">Other MediaMind users</strong> - only what you
                explicitly choose to share: your library with accepted friends, a collection you mark
                public or share a code for, a review or recommendation you send. Your email is never
                shown to another user unless you add them as a friend.
              </li>
              <li>
                <strong className="text-white/90">Service providers</strong> we use to run the app:
                Clerk (authentication), Supabase (database hosting), and Vercel (application hosting).
                Each only receives what&apos;s needed to do its job, and none of them are permitted to
                use your data for their own purposes.
              </li>
              <li>
                <strong className="text-white/90">Title search &amp; metadata</strong> - searching for
                a title sends your search query (not your identity) to the relevant public database:
                TMDB (movies/TV), Jikan/MyAnimeList (anime/manga), RAWG (games), or Google Books.
              </li>
              <li>
                <strong className="text-white/90">AI features</strong> - if you add your own Groq or
                Gemini API key in Settings, the title/description text needed for that feature (e.g. a
                collection suggestion, a tone analysis) is sent directly from your device to that
                provider, under your own account with them. We never see that traffic, and AI features
                simply don&apos;t work until you add a key - there is no shared or default key.
              </li>
            </ul>
            <p>We never sell your data, and we don&apos;t share it with advertisers - there are none.</p>
          </section>

          <section>
            <h2>Your data, your control</h2>
            <ul>
              <li>Export your entire library at any time from Settings.</li>
              <li>
                Delete individual titles, remove friends, or leave a shared collection whenever you
                want - these are immediate, real deletions in our database, not a soft-hide.
              </li>
              <li>
                Want your account and all associated data fully deleted? Email us (below) and
                we&apos;ll do it by hand within a few days - there&apos;s no self-serve account
                deletion yet given the current size of the beta.
              </li>
            </ul>
          </section>

          <section>
            <h2>Security</h2>
            <p>
              Your library and social data are protected by row-level database security - every
              request is scoped to your own account by the database itself, not just by app-level
              checks. Traffic to the app is encrypted (HTTPS/HSTS). We don&apos;t store payment
              information of any kind - there&apos;s nothing to pay for.
            </p>
          </section>

          <section>
            <h2>Changes to this policy</h2>
            <p>
              If anything meaningful changes about what we collect or how it&apos;s used, we&apos;ll
              update this page and note the date at the top. This is a small beta - if you have any
              question at all about your data, just ask.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions, data export/deletion requests, or anything else:{' '}
              <a href="mailto:takiar.kshitij@gmail.com" className="text-indigo-400 hover:text-indigo-300">
                takiar.kshitij@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
