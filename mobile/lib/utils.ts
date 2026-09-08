// Ported from src/lib/utils.ts (this one function only, so far - add more
// here as later chunks need them, rather than pulling in the whole file's
// DOM-adjacent helpers up front).

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    movie: 'Movie',
    tv: 'TV Series',
    anime: 'Anime',
    manga: 'Manga',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    donghua: 'Donghua',
    game: 'Game',
    book: 'Book',
    light_novel: 'Light Novel',
    visual_novel: 'Visual Novel',
    web_series: 'Web Series',
    misc: 'Misc',
  };
  return labels[type] || type;
}
