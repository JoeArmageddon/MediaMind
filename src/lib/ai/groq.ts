import Groq from 'groq-sdk';
import type {
  AISuggestion,
  AIRecommendation,
  AIBurnoutResult,
  AISmartCollection,
  AIMediaAnalysis,
  AIFallbackClassification,
  Media,
  History,
  StreamingPlatform,
} from '@/types';

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

export class GroqClient {
  private client: Groq;
  private model: string = 'llama-3.3-70b-versatile';

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  private async generateContent(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }

  private parseJSON<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      console.error('JSON parse error:', error, 'Text:', text);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  // 1. Similar Media Suggestions
  async getSuggestions(
    media: Pick<Media, 'title' | 'type' | 'genres' | 'description' | 'release_year'>
  ): Promise<AISuggestion[]> {
    const prompt = `MEDIA DATA:
Title: ${media.title}
Type: ${media.type}
Genres: ${media.genres.join(', ')}
Description: ${media.description?.slice(0, 500) || 'N/A'}
Release Year: ${media.release_year || 'N/A'}

TASK:
Suggest 5 similar ${media.type}.

Return JSON:
{
  "suggestions": [
    {
      "title": "",
      "reason": "",
      "similarity_score": 0-100
    }
  ]
}

Rules:
- Only same type (${media.type}).
- No duplicates.
- Avoid overly mainstream obvious answers.
- Provide intelligent reasoning.
- similarity_score reflects thematic closeness.`;

    const response = await this.generateContent(prompt);
    const data = this.parseJSON<{ suggestions: AISuggestion[] }>(response);
    return data.suggestions;
  }

  // 2. "What should I watch tonight?"
  async getRecommendations(
    currentWatching: Media[],
    planned: Media[],
    recentlyCompleted: Media[],
    topGenres: string[],
    mood?: string,
    minutes?: number
  ): Promise<AIRecommendation[]> {
    const prompt = `USER MEDIA LIBRARY SUMMARY:

Current Watching:
${currentWatching.map(m => `- ${m.title} (${m.type})`).join('\n') || 'None'}

Planned:
${planned.map(m => `- ${m.title} (${m.type}) [${m.genres.join(', ')}]`).join('\n') || 'None'}

Recently Completed:
${recentlyCompleted.map(m => `- ${m.title} (${m.type})`).join('\n') || 'None'}

Most Watched Genres:
${topGenres.join(', ')}

Current Mood Input (optional):
${mood || 'Not specified'}

Time Available:
${minutes ? `${minutes} minutes` : 'Flexible'}

TASK:
Recommend 3 items from Planned or On Hold.

Return JSON:
{
  "recommendations": [
    {
      "title": "",
      "reason": "",
      "fit_score": 0-100
    }
  ]
}

Rules:
- Do not recommend completed items.
- Consider time availability.
- Avoid genre burnout.
- If mood given, prioritize alignment.
- Be psychologically aware.`;

    const response = await this.generateContent(prompt);
    const data = this.parseJSON<{ recommendations: AIRecommendation[] }>(response);
    return data.recommendations;
  }

  // 3. Burnout Detection
  async detectBurnout(
    recentHistory: History[],
    genreCounts: Record<string, number>
  ): Promise<AIBurnoutResult> {
    const prompt = `USER WATCH HISTORY (last 30 items):
${recentHistory.map(h => `- ${h.action_type}: ${JSON.stringify(h.value)}`).join('\n')}

Genre Distribution:
${Object.entries(genreCounts).map(([g, c]) => `- ${g}: ${c}`).join('\n')}

TASK:
Detect if the user is experiencing genre or tone burnout.

Return JSON:
{
  "burnout_detected": true/false,
  "dominant_pattern": "",
  "risk_level": "low/medium/high",
  "suggested_shift": "",
  "recommended_genre_direction": ""
}`;

    const response = await this.generateContent(prompt);
    return this.parseJSON<AIBurnoutResult>(response);
  }

  // 4. Smart Collection Generator
  async generateSmartCollections(
    allMedia: Pick<Media, 'title' | 'type' | 'genres' | 'ai_primary_tone'>[]
  ): Promise<AISmartCollection[]> {
    const prompt = `USER FULL LIBRARY DATA:
${allMedia.map(m => `- ${m.title} (${m.type}) [${m.genres.join(', ')}]${m.ai_primary_tone ? ` Tone: ${m.ai_primary_tone}` : ''}`).join('\n')}

TASK:
Create 3 intelligent thematic collections.

Return JSON:
{
  "collections": [
    {
      "title": "",
      "description": "",
      "media_titles": []
    }
  ]
}

Rules:
- Titles must feel premium and cinematic.
- Group by theme or narrative energy.
- Avoid generic labels like "Action Stuff".`;

    const response = await this.generateContent(prompt);
    const data = this.parseJSON<{ collections: AISmartCollection[] }>(response);
    return data.collections;
  }

  // 5. Media Thematic Analysis
  async analyzeMedia(
    media: Pick<Media, 'title' | 'description' | 'genres'>
  ): Promise<AIMediaAnalysis> {
    const prompt = `MEDIA:
Title: ${media.title}
Description: ${media.description?.slice(0, 500) || 'N/A'}
Genres: ${media.genres.join(', ')}

TASK:
Analyze and classify tone and themes.

Return JSON:
{
  "primary_tone": "",
  "secondary_tone": "",
  "core_themes": [],
  "emotional_intensity": 0-100,
  "pacing": "slow/moderate/fast",
  "darkness_level": 0-100,
  "intellectual_depth": 0-100
}`;

    const response = await this.generateContent(prompt);
    return this.parseJSON<AIMediaAnalysis>(response);
  }

  // 6. AI Fallback Classification
  async classifyMedia(title: string): Promise<AIFallbackClassification> {
    const prompt = `TITLE: ${title}

TASK:
Classify this media.

Return JSON:
{
  "detected_type": "",
  "likely_genres": [],
  "confidence": 0-100
}

Allowed types:
movie, tv, anime, manga, manhwa, game, book, light_novel, visual_novel, web_series, misc`;

    const response = await this.generateContent(prompt);
    return this.parseJSON<AIFallbackClassification>(response);
  }

  // 7. Streaming Availability Summary
  async summarizeStreamingData(
    rawData: string
  ): Promise<{ available_on: StreamingPlatform[] }> {
    const prompt = `RAW STREAMING DATA (India):
${rawData}

TASK:
Clean and summarize availability.

Return JSON:
{
  "available_on": [
    {
      "platform": "",
      "type": "subscription/rent/buy"
    }
  ]
}`;

    const response = await this.generateContent(prompt);
    return this.parseJSON<{ available_on: StreamingPlatform[] }>(response);
  }
}

// Factory
export const createGroqClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
  if (!apiKey) {
    throw new Error('Groq API key not configured - add GROQ_API_KEY to .env.local');
  }
  return new GroqClient(apiKey);
};
