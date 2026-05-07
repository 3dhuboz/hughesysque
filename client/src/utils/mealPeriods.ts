/**
 * Meal-period gating helpers — used by the storefront order page to filter
 * items out when the chosen pickup time slot falls outside the item's
 * configured periods, and by MenuManager to render the per-item period
 * checkboxes against settings.mealPeriods.
 *
 * A near-identical copy lives at functions/api/v1/_lib/mealPeriods.ts for
 * the server-side guard in orders POST. Keep them in sync — the dependency
 * boundary between client/ and functions/ means we can't import across.
 */

import type { MealPeriod, MenuItem } from '../types';

/**
 * Hard-coded fallback used when settings.mealPeriods is empty/undefined.
 * Macca can override these from the admin Settings page; the values below
 * are sensible Australian food-truck defaults so per-item gating works
 * the moment the feature ships even if no one has configured it yet.
 */
export const DEFAULT_MEAL_PERIODS: MealPeriod[] = [
  { id: 'breakfast', name: 'Breakfast', startTime: '06:00', endTime: '10:30' },
  { id: 'lunch',     name: 'Lunch',     startTime: '11:00', endTime: '14:30' },
  { id: 'dinner',    name: 'Dinner',    startTime: '17:00', endTime: '21:00' },
];

/**
 * Parse a time string into minutes-since-midnight. Accepts:
 *   - 24h "HH:MM"            (admin-side, e.g. "06:00")
 *   - 12h "H:MM AM"/"H:MM PM" (storefront slot picker, e.g. "6:30 PM")
 * Returns null when the input doesn't match (caller decides what to do —
 * usually skip the gate so a malformed slot doesn't reject every order).
 */
export function parseTimeToMinutes(input: string | undefined | null): number | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  // 12h with AM/PM (storefront display strings)
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const suffix = ampm[3].toUpperCase();
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (suffix === 'PM' && h !== 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  // 24h
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
}

/**
 * Return the configured periods if non-empty, otherwise the defaults. Any
 * call site that needs "the periods Macca has set up" should go through
 * this so an empty-array config silently keeps the feature live.
 */
export function effectiveMealPeriods(configured: MealPeriod[] | undefined): MealPeriod[] {
  return configured && configured.length > 0 ? configured : DEFAULT_MEAL_PERIODS;
}

/**
 * Which configured periods include the given pickup time? Used by the
 * storefront to show a "you're shopping for: Lunch" pill, and indirectly
 * by isItemAvailableAt below.
 *
 * Periods are inclusive of startTime, exclusive of endTime — a 10:30 cutoff
 * means a 10:30 pickup is OUTSIDE breakfast (consistent with how slot
 * pickers normally treat the trailing edge of a window).
 */
export function periodsForTime(pickupTime: string | undefined | null, periods: MealPeriod[]): MealPeriod[] {
  const mins = parseTimeToMinutes(pickupTime);
  if (mins == null) return [];
  return periods.filter(p => {
    const start = parseTimeToMinutes(p.startTime);
    const end = parseTimeToMinutes(p.endTime);
    if (start == null || end == null) return false;
    // Standard window: 06:00–10:30. We don't support overnight windows
    // (end < start) — Macca said breakfast/lunch/dinner, all daytime.
    return mins >= start && mins < end;
  });
}

/**
 * The actual gate. Returns true when the item should be orderable at the
 * given pickup time. Backwards-compatible defaults:
 *   - undefined/empty pickup time → true (don't gate before a slot is chosen)
 *   - undefined/empty availabilityPeriods → true (legacy items unaffected)
 */
export function isItemAvailableAt(
  item: Pick<MenuItem, 'availabilityPeriods'>,
  pickupTime: string | undefined | null,
  periods: MealPeriod[],
): boolean {
  if (!item.availabilityPeriods || item.availabilityPeriods.length === 0) return true;
  const mins = parseTimeToMinutes(pickupTime);
  if (mins == null) return true;
  const matching = periodsForTime(pickupTime, periods);
  if (matching.length === 0) return false;
  return matching.some(p => item.availabilityPeriods!.includes(p.id));
}

/** Current wall-clock time as 24h "HH:MM". Used for the second gate Macca
 *  asked for: items hidden when the current moment is outside their period
 *  (e.g. breakfast taco vanishes from the storefront after 10:30). */
export function nowAs24h(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
