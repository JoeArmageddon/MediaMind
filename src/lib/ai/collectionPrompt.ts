import type { Media, MediaType } from '@/types';

const TYPE_LABELS: Record<MediaType, string> = {
  movie: 'movies',
  tv: 'TV shows',
  anime: 'anime',
  manga: 'manga',
  manhwa: 'manhwa',
  manhua: 'manhua',
  donghua: 'donghua',
  game: 'games',
  book: 'books',
  light_novel: 'light novels',
  visual_novel: 'visual novels',
  web_series: 'web series',
  misc: 'other media',
};

// Shared by groq.ts and gemini.ts's generateSmartCollections - a fixed
// prompt against the same library tends to converge on the same "obvious"
// groupings every time (temperature alone isn't enough: the model keeps
// reaching for the same handful of natural genre clusters). Three things
// push it toward genuinely different results on repeat generations:
// 1. An explicit avoid-list of collections that already exist (saved ones
//    plus any unsaved drafts still on screen), so a re-generate doesn't
//    just reproduce what's already there under a slightly different name.
// 2. A randomly-picked organizing "angle" each call (unless the user gave
//    their own theme - see themeHint below), forcing a different lens on
//    the same library instead of always defaulting to genre.
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
export const SMART_COLLECTIONS_TARGET_COUNT = 10;

export function buildSmartCollectionsPrompt(
  allMedia: Pick<Media, 'title' | 'type' | 'genres' | 'ai_primary_tone'>[],
  avoidTitles: string[],
  themeHint?: string
): string {
  const shuffled = [...allMedia].sort(() => Math.random() - 0.5);
  const trimmedHint = themeHint?.trim();

  const avoidBlock =
    avoidTitles.length > 0
      ? `\nEXISTING COLLECTIONS - DO NOT DUPLICATE (different titles, themes, and groupings than every one of these):\n${avoidTitles.map((t) => `- ${t}`).join('\n')}\n`
      : '';

  // A user-supplied theme takes over the whole batch instead of a random
  // angle per collection - they asked for something specific, so every
  // collection returned should actually relate to it, not just the first
  // one or two before drifting back to generic genre buckets.
  const angleInstruction = trimmedHint
    ? `The user specifically asked for collections built around: "${trimmedHint}". Every collection must genuinely relate to this - don't drift back to generic genre buckets that ignore it. You can still vary the specific sub-angle within it, but the theme itself is fixed.`
    : `Organize primarily around this angle: ${ANGLES[Math.floor(Math.random() * ANGLES.length)]}.`;

  return `USER FULL LIBRARY DATA:
${shuffled.map((m) => `- ${m.title} (${m.type}) [${m.genres.join(', ')}]${m.ai_primary_tone ? ` Tone: ${m.ai_primary_tone}` : ''}`).join('\n')}
${avoidBlock}
TASK:
Create up to ${SMART_COLLECTIONS_TARGET_COUNT} intelligent thematic collections. ${angleInstruction} If the library genuinely doesn't support that many distinct, non-overlapping groupings, return fewer strong ones rather than padding it out with thin or repetitive ones.

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
- Titles must be premium and SPECIFIC to what's actually grouped inside - never a generic label.
  BAD: "Action Stuff", "Cool Movies", "Sci-Fi Collection", "The Chronicles of Adventure".
  GOOD: "Neon-Lit Cities After Dark", "Quietly Devastating Character Studies", "One More Episode Before Bed".
- Vary the NAMING STYLE across the whole batch, not just the theme - don't let every title follow the same template (not all "The ___ of ___", not all a single mood-word, not all a question). Mix short and punchy with longer and evocative.
- Descriptions should justify the specific grouping in one sentence, not restate the title.
- Group by theme or narrative energy, filtered through the angle above.
- Must differ meaningfully from every collection listed above to avoid - new titles, new groupings, new angle.
- Vary which items get grouped together even across similar themes - do not default to the single most obvious pairing.`;
}

export const DISCOVERY_COLLECTION_COUNT = 10;

// A second, separate kind of generation alongside buildSmartCollectionsPrompt:
// that one only ever reorganizes titles the user already owns. This one
// suggests titles they probably DON'T own yet - real movies/shows/anime/
// manga/games/books that exist in the real world, not confined to their
// library at all. Each suggested title still has to be verified against a
// real catalog (the caller does this via the same multi-source search the
// Search page uses) before it's shown as real or offered for adding - the
// model can and does misremember titles, so nothing here is trusted at
// face value.
export function buildDiscoveryCollectionPrompt(themeHint?: string, types?: MediaType[]): string {
  const trimmedHint = themeHint?.trim();

  const themeInstruction = trimmedHint
    ? `Build it around this theme/genre: "${trimmedHint}".`
    : `Pick one specific, interesting theme yourself first (not just "popular movies") and build around that - name the theme in the collection's title/description.`;

  // Empty/undefined = mixed, any type, AI's choice per title. One type =
  // every title must be that type. Multiple = every title must be one of
  // the selected types, but the mix within the collection is still the
  // AI's call.
  const mediaKinds =
    types && types.length > 0
      ? types.length === 1
        ? TYPE_LABELS[types[0]]
        : types.map((t) => TYPE_LABELS[t]).join(', ')
      : 'movies, TV shows, anime, manga, games, or books (mix freely across types unless the theme itself implies just one)';

  const typeConstraint =
    types && types.length > 0
      ? `\nEvery single suggested title must be ${types.length === 1 ? 'a' : 'one of the selected'} type${types.length === 1 ? '' : 's'}: ${mediaKinds}. Do not include any other kind of media even if it fits the theme.\n`
      : '';

  return `TASK:
Suggest ${DISCOVERY_COLLECTION_COUNT} REAL, existing ${mediaKinds} - not from any particular person's library, just real published/released titles - that belong together as one themed collection. ${themeInstruction}
${typeConstraint}
Every title must be a real, actually-existing work. Never invent a title, a sequel, or a spin-off that doesn't exist - if you're not confident a title is real, leave it out rather than guess. Mix well-known titles with a few less obvious picks within the theme, rather than only the most predictable choices.

Return JSON:
{
  "title": "",
  "description": "",
  "media_titles": []
}

Rules:
- The collection title should be premium and specific (see the naming guidance below), not a generic label.
  BAD: "Action Stuff", "Cool Movies", "Sci-Fi Collection".
  GOOD: "Neon-Lit Cities After Dark", "Quietly Devastating Character Studies".
- The description should explain the theme in one or two sentences.
- media_titles should be the exact, correctly-spelled real title of each work (add the year in parentheses only if the title alone is ambiguous with an unrelated work of the same name).`;
}
