import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkRateLimit } from '@/lib/rateLimit';

// Server-side fallback for signed-in users who haven't added their own
// RAWG key yet (see rawg.ts's RAWGClient.fetch()) - same pattern as
// api/external/tmdb, a plain passthrough using a server-only RAWG_API_KEY.
const RAWG_BASE_URL = 'https://api.rawg.io/api';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`${userId}:external-rawg`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests - try again shortly, or add your own RAWG key in Settings for unlimited use.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.RAWG_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'RAWG is not configured on this server' }, { status: 503 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ error: "Missing or invalid 'path' query param" }, { status: 400 });
  }

  const rawgUrl = new URL(`${RAWG_BASE_URL}${path}`);
  url.searchParams.forEach((value, key) => {
    if (key !== 'path') rawgUrl.searchParams.set(key, value);
  });
  rawgUrl.searchParams.set('key', apiKey);

  try {
    const response = await fetch(rawgUrl.toString(), { signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('RAWG proxy failed:', error);
    return NextResponse.json({ error: 'RAWG request failed' }, { status: 502 });
  }
}
