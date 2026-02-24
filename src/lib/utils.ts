import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planned: 'bg-status-planned',
    watching: 'bg-status-watching',
    completed: 'bg-status-completed',
    'on-hold': 'bg-status-on-hold',
    dropped: 'bg-status-dropped',
    rewatching: 'bg-status-rewatching',
    archived: 'bg-status-archived',
  };
  return colors[status] || 'bg-gray-500';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    planned: 'Planned',
    watching: 'Watching',
    completed: 'Completed',
    'on-hold': 'On Hold',
    dropped: 'Dropped',
    rewatching: 'Rewatching',
    archived: 'Archived',
  };
  return labels[status] || status;
}

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

export function getUnitLabel(type: string): string {
  const labels: Record<string, string> = {
    movie: 'minutes',
    tv: 'episodes',
    anime: 'episodes',
    manga: 'chapters',
    manhwa: 'chapters',
    manhua: 'chapters',
    donghua: 'episodes',
    game: '%',
    book: 'pages',
    light_novel: 'pages',
    visual_novel: 'routes',
    web_series: 'episodes',
    misc: 'items',
  };
  return labels[type] || 'units';
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function calculateEstimatedHours(media: {
  type: string;
  total_units: number;
  progress: number;
  completion_percent: number;
}): number {
  // Average duration per UNIT (in minutes)
  const avgDurations: Record<string, number> = {
    movie: 120,        // 2 hours per movie
    tv: 45,            // 45 min per episode
    anime: 24,         // 24 min per episode
    manga: 5,          // 5 min per chapter
    manhwa: 5,         // 5 min per chapter
    manhua: 5,         // 5 min per chapter
    donghua: 24,       // 24 min per episode
    game: 60,          // 60 min per % (games use % progress)
    book: 2,           // 2 min per page
    light_novel: 1.5,  // 1.5 min per page
    visual_novel: 60,  // 1 hour per route
    web_series: 20,    // 20 min per episode
    misc: 60,          // 1 hour per item
  };

  const avgDuration = avgDurations[media.type] || 60;
  
  // For games, total_units represents percentage (0-100)
  if (media.type === 'game') {
    // Estimate total game length as 40 hours * completion percentage
    const totalGameHours = 40;
    return totalGameHours * (media.completion_percent / 100);
  }
  
  // For movies, total_units is typically 1 (the movie itself)
  if (media.type === 'movie') {
    return avgDuration / 60; // Convert minutes to hours
  }
  
  // For other media: multiply units by average duration, convert to hours
  // e.g., 12 anime episodes * 24 min = 288 min = 4.8 hours
  if (media.total_units > 0) {
    return (media.total_units * avgDuration) / 60;
  }
  
  return 0;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
