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

/**
 * Check if an event's ordering window has passed, based on event type:
 * - ORDER_PICKUP (cook day): 24hrs before (midnight the day before)
 * - PUBLIC_EVENT (pop-up): 1hr before the event's end time
 * - BLOCKED: always past cutoff
 */
export function isEventPastCutoff(event: { date: string; type: string; endTime?: string }): boolean {
  const now = new Date();

  if (event.type === 'BLOCKED') return true;

  if (event.type === 'ORDER_PICKUP') {
    // Cutoff = midnight the day before the cook date
    const cookDate = parseLocalDate(event.date);
    const cutoff = new Date(cookDate);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 1);
    return now > cutoff;
  }

  if (event.type === 'PUBLIC_EVENT') {
    // Cutoff = 1hr before event end time
    const eventDate = parseLocalDate(event.date);
    if (event.endTime) {
      const [h, m] = event.endTime.split(':').map(Number);
      eventDate.setHours(h, m || 0, 0, 0);
    } else {
      // No end time set — assume end of day
      eventDate.setHours(23, 59, 0, 0);
    }
    const cutoff = new Date(eventDate.getTime() - 60 * 60 * 1000); // minus 1 hour
    return now > cutoff;
  }

  return false;
}
