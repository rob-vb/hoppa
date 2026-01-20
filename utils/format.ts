/**
 * Date and time formatting utilities
 * Centralized to avoid recreation of formatting functions across components
 */

/**
 * Format a timestamp as a short date string
 * Example: "Jan 15, 2024"
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp as a time string
 * Example: "3:45 PM"
 */
export function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a duration in milliseconds as a human-readable string
 * Example: "45 min", "1h 30m"
 */
export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format seconds as a timer display
 * Example: "1:30:45" or "45:30"
 */
export function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format a timestamp as a relative date string
 * Example: "Today", "Yesterday", "3 days ago"
 */
export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = nowOnly.getTime() - dateOnly.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return formatDate(timestamp);
}

/**
 * Get a group title for a given timestamp
 * Used for grouping history items
 */
export function getDateGroupTitle(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = nowOnly.getTime() - dateOnly.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This Week';
  if (days < 14) return 'Last Week';
  if (days < 30) return 'This Month';

  // Return month and year for older entries
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
