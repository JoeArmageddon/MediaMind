// TMDB proxy Edge Function.
//
// Why this exists: some networks (ISP/regional/firewall) block
// api.themoviedb.org outright at the connection level - DNS resolves fine,
// but the TCP/TLS handshake never completes, so the browser can never
// reach TMDB directly no matter what the app does client-side. Supabase's
// servers aren't behind that block, so routing the request through here
// (browser -> this function -> TMDB -> back) works around it entirely.
//
// This is a plain passthrough: the client sends the TMDB endpoint path via
// `?path=` plus TMDB's own query params (including `api_key`) verbatim, and
// this just forwards them to TMDB and relays the response back. The TMDB
// key was already meant to be public (NEXT_PUBLIC_-prefixed, shipped in the
// client bundle) before this change, so nothing here makes it any less
// public than it already was - this only relocates where the outbound
// request to TMDB physically originates from.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');

    if (!path || !path.startsWith('/')) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'path' query param" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tmdbUrl = new URL(`${TMDB_BASE_URL}${path}`);
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'path') tmdbUrl.searchParams.set(key, value);
    }

    const tmdbResponse = await fetch(tmdbUrl.toString(), {
      signal: AbortSignal.timeout(15000),
    });
    const body = await tmdbResponse.text();

    return new Response(body, {
      status: tmdbResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
