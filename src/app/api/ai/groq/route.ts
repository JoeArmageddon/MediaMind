import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/lib/rateLimit';

// Server-side fallback for signed-in users who haven't added their own
// Groq key yet - see gemini/route.ts's comment for the full reasoning,
// same pattern. GROQ_API_KEY here is a plain server env var (already set
// in this project, never NEXT_PUBLIC_-prefixed).
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

const MODEL = 'openai/gpt-oss-120b';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`${userId}:ai-groq`, 40, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests - try again shortly, or add your own key in Settings for unlimited use.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
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
    const client = new Groq({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    return NextResponse.json({ text: response.choices[0]?.message?.content || '' });
  } catch (error) {
    console.error('Groq proxy failed:', error);
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
