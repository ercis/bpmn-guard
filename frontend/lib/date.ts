import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format a date string to a human-readable format.
 * Uses European date format (day month year).
 *
 * @param dateString - ISO date string
 * @returns Formatted date like "18 January 2026, 14:30"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'd MMMM yyyy, HH:mm');
}

/**
 * Format a date string to a short format.
 * Uses European date format (day month year).
 *
 * @param dateString - ISO date string
 * @returns Formatted date like "18 Jan 2026"
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'd MMM yyyy');
}

/**
 * Format a date string to show only the date without time.
 * Uses European date format (day month year).
 *
 * @param dateString - ISO date string
 * @returns Formatted date like "18 January 2026"
 */
export function formatDateOnly(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'd MMMM yyyy');
}

/**
 * Format a date string as relative time from now.
 *
 * @param dateString - ISO date string
 * @returns Relative time like "5 minutes ago" or "in 2 hours"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a date string for display in charts (short month and day).
 *
 * @param dateString - ISO date string
 * @returns Formatted date like "18 Jan"
 */
export function formatChartDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'd MMM');
}

/**
 * Format current date for file names (ISO format without time).
 *
 * @returns Date string like "2026-01-18"
 */
export function formatFileDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Format a timestamp to show only time.
 *
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @returns Formatted time like "14:30:45"
 */
export function formatTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return format(date, 'HH:mm:ss');
}
