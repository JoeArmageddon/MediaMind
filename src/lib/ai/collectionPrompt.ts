import type { Media } from '@/types';

// Shared by groq.ts and gemini.ts's generateSmartCollections - a fixed
// prompt against the same library tends to converge on the same "obvious"
// groupings every time (temperature alone isn't enough: the model keeps
// reaching for the same handful of natural genre clusters). Three things
// push it toward genuinely different results on repeat generations:
// 1. An explicit avoid-list of collections that already exist (saved ones
//    plus any unsaved drafts still on screen), so a re-generate doesn't
//    just reproduce what's already there under a slightly different name.
// 2. A randomly-picked organizing "angle" each call, forcing a different
//    lens on the same library instead of always defaulting to genre.
// 3. Shuffling the input list order, since these models are somewhat
//    order-sensitive and a fixed order nudges toward fixed groupings.
const ANGLES = [
  'emotional tone and mood',
  'the decade or era each title is set in or was released',
  'narrative structure or pacing style',
  'protagonist archetype or character dynamics',
  'hidden gems and under-the-radar picks over the obvious favorites',
  'visual or tonal atmosphere',
  'cultural or regional origin',
  'audience comfort level - easy comfort watches vs demanding, intense ones',
  'thematic opposites or contrasts within the library',
  'what mindset or life moment each title suits',
];

export const SMART_COLLECTIONS_TEMPERATURE = 1.0;

export function buildSmartCollectionsPrompt(
  allMedia: Pick<Media, 'title' | 'type' | 'genres' | 'ai_primary_tone'>[],
  avoidTitles: string[]
): string {
  const shuffled = [...allMedia].sort(() => Math.random() - 0.5);
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

  const avoidBlock =
    avoidTitles.length > 0
      ? `\nEXISTING COLLECTIONS - DO NOT DUPLICATE (different titles, themes, and groupings than every one of these):\n${avoidTitles.map((t) => `- ${t}`).join('\n')}\n`
      : '';

  return `USER FULL LIBRARY DATA:
${shuffled.map((m) => `- ${m.title} (${m.type}) [${m.genres.join(', ')}]${m.ai_primary_tone ? ` Tone: ${m.ai_primary_tone}` : ''}`).join('\n')}
${avoidBlock}
TASK:
Create 3 intelligent thematic collections, organized primarily around this angle: ${angle}.

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
- Group by theme or narrative energy, filtered through the angle above.
- Avoid generic labels like "Action Stuff".
- Must differ meaningfully from every collection listed above to avoid - new titles, new groupings, new angle.
- Vary which items get grouped together even across similar themes - do not default to the single most obvious pairing.`;
}
