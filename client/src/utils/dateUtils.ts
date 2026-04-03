/**
 * Parse a YYYY-MM-DD date string as LOCAL midnight instead of UTC.
 * new Date('2026-04-04') → UTC midnight → wrong day in AEST.
 * parseLocalDate('2026-04-04') → local midnight → correct day.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If already has time component, parse as-is
  if (dateStr.includes('T')) return new Date(dateStr);
  // Append T12:00:00 to avoid any timezone edge cases
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Format a YYYY-MM-DD string for display without timezone shift.
 * Uses parseLocalDate internally.
 */
export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const defaults: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return parseLocalDate(dateStr).toLocaleDateString('en-AU', options || defaults);
}
