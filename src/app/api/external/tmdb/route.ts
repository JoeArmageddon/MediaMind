import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkRateLimit } from '@/lib/rateLimit';

// Server-side fallback for signed-in users who haven't added their own
// TMDB key yet (see tmdb.ts's TMDBClient.fetch()) - a plain passthrough
// to TMDB using a server-only TMDB_API_KEY env var, same shape as
// supabase/functions/tmdb-proxy/index.ts (which stays in place for the
// bring-your-own-key path, for its original reason: routing around
// ISP-level blocks of api.themoviedb.org on some networks). This route
// runs on Vercel's servers, not the end user's own network, so that
// specific problem doesn't apply here - safe to call TMDB directly.
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`${userId}:external-tmdb`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests - try again shortly, or add your own TMDB key in Settings for unlimited use.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB is not configured on this server' }, { status: 503 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ error: "Missing or invalid 'path' query param" }, { status: 400 });
  }

  const tmdbUrl = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.forEach((value, key) => {
    if (key !== 'path') tmdbUrl.searchParams.set(key, value);
  });
  tmdbUrl.searchParams.set('api_key', apiKey);

  try {
    const response = await fetch(tmdbUrl.toString(), { signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TMDB proxy failed:', error);
    return NextResponse.json({ error: 'TMDB request failed' }, { status: 502 });
  }
}
