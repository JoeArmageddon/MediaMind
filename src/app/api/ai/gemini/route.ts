import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '@/lib/rateLimit';

// Server-side fallback for signed-in users who haven't added their own
// Gemini key yet - keeps the app usable out of the box for the beta
// without ever shipping a real key to the client (see gemini.ts's
// GeminiClient.generateContent(), which only calls this route when it has
// no user-provided key). GEMINI_API_KEY here is a plain server env var,
// deliberately NOT NEXT_PUBLIC_-prefixed - that's the whole point.
//
// Same system prompt as GeminiClient - duplicated rather than imported,
// same as it's already duplicated between gemini.ts and groq.ts, so this
// route has no client-bundle dependency at all.
const SYSTEM_PROMPT = `You are an AI Media Intelligence Engine.

You analyze structured media data and return responses in strict JSON format.

You must:
- Be concise but insightful
- Avoid fluff
- Never add emojis
- Never add markdown
- Always return valid JSON
- Never explain outside JSON

Tone: Cinematic, analytical, intelligent, neutral.

Focus on: Themes, Mood, Genre patterns, Narrative depth, Audience fit, Emotional impact.

If unsure, infer intelligently.`;

const MODEL = 'gemini-3.5-flash-lite';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // AI calls cost real money on the shared default key - a tighter limit
  // than the search proxies, but generous enough for normal feature use
  // (results are also cached client-side by title for 30 days, so repeat
  // requests for the same title never reach here at all).
  const rl = checkRateLimit(`${userId}:ai-gemini`, 40, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests - try again shortly, or add your own key in Settings for unlimited use.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'AI is not configured on this server' }, { status: 503 });
  }

  let prompt: string;
  let temperature: number;
  try {
    const body = await req.json();
    prompt = typeof body.prompt === 'string' ? body.prompt : '';
    temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    return NextResponse.json({ text: result.response.text() });
  } catch (error) {
    console.error('Gemini proxy failed:', error);
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
