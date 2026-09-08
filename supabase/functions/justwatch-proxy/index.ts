// JustWatch GraphQL proxy Edge Function.
//
// Why this exists: apis.justwatch.com/graphql sends no
// Access-Control-Allow-Origin header at all on its CORS preflight
// response (confirmed directly), so a browser blocks every request to it
// outright regardless of what the client sends - this isn't a network
// block like TMDB's (see tmdb-proxy), it's the API simply not being meant
// for direct browser calls. Routing through here (browser -> this
// function -> JustWatch -> back) sidesteps it: server-to-server requests
// aren't subject to CORS at all.
//
// Plain passthrough: the client POSTs the exact GraphQL body (query +
// variables) it would have sent JustWatch directly, and this just
// forwards it and relays the response back.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const JUSTWATCH_URL = 'https://apis.justwatch.com/graphql';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    const jwResponse = await fetch(JUSTWATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const responseBody = await jwResponse.text();

    return new Response(responseBody, {
      status: jwResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
