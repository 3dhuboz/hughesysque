/**
 * Parse a YYYY-MM-DD date string as LOCAL midnight (well, local NOON — see below)
 * instead of UTC. `new Date('2026-04-04')` interprets the string as UTC midnight,
 * which renders as the previous day once shifted into AEST. `parseLocalDate('2026-04-04')`
 * pins it to noon local time so the calendar day is unambiguous regardless of
 * timezone, DST, or the user's clock skew.
 *
 *   IMPORTANT: this helper is for **DISPLAY DATES ONLY** — i.e. taking a
 *   stored YYYY-MM-DD and rendering it as a Date for `toLocaleDateString` /
 *   month-day formatting. It is NOT safe to compare against `new Date()`
 *   (i.e. "now") for cook-day-cutoff or "is X past now" logic — the noon
 *   pin can roll the comparison the wrong direction in evenings (after
 *   noon local time, the date the user picked still parses to noon today,
 *   so `parseLocalDate(today) > new Date()` flips false even though the
 *   cook day hasn't ended yet).
 *
 *   For cutoff/order-window comparisons, use `isEventPastCutoff` below
 *   (which sets explicit hours from the event's startTime/endTime), or
 *   compare YYYY-MM-DD strings directly — string compare on ISO dates
 *   is the right answer for "did this calendar day pass" questions.
 *
 *   Audit ref: 2026-04-25 Backend Med #12 / BACKLOG — parseLocalDate
 *   cook-day cutoff documentation fix.
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
 * Format a Date as YYYY-MM-DD using local time (not UTC).
 * Avoids the toISOString() timezone shift that moves dates back a day in AEST.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if an event's ordering window has passed, based on event type:
 * - ORDER_PICKUP (cook day): orders open until event end time (close of cook day)
 * - PUBLIC_EVENT (pop-up): 1hr before the event's end time
 * - BLOCKED: always past cutoff
 */
export function isEventPastCutoff(event: { date: string; type: string; endTime?: string }): boolean {
  const now = new Date();

  if (event.type === 'BLOCKED') return true;

  if (event.type === 'ORDER_PICKUP') {
    // Cutoff = event end time on cook day (orders open until close)
    const cookDate = parseLocalDate(event.date);
    if (event.endTime) {
      const [h, m] = event.endTime.split(':').map(Number);
      cookDate.setHours(h, m || 0, 0, 0);
    } else {
      // No end time — default to end of day
      cookDate.setHours(23, 59, 0, 0);
    }
    return now > cookDate;
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
