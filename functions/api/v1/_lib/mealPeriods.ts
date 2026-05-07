/**
 * Server-side mirror of client/src/utils/mealPeriods.ts. Cloudflare Pages
 * Functions live in a separate compilation unit from the React client so
 * we can't share modules across the boundary — keep the two files in sync.
 *
 * Used by functions/api/v1/orders POST to reject orders whose cart contains
 * an item that isn't sold during the chosen pickup time slot. This is the
 * belt-and-braces guard behind the storefront filter.
 */

export interface MealPeriod {
  id: string;
  name: string;
  startTime: string; // 24h "HH:MM"
  endTime: string;   // 24h "HH:MM"
}

export const DEFAULT_MEAL_PERIODS: MealPeriod[] = [
  { id: 'breakfast', name: 'Breakfast', startTime: '06:00', endTime: '10:30' },
  { id: 'lunch',     name: 'Lunch',     startTime: '11:00', endTime: '14:30' },
  { id: 'dinner',    name: 'Dinner',    startTime: '17:00', endTime: '21:00' },
];

export function parseTimeToMinutes(input: string | undefined | null): number | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
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
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
}

export function effectiveMealPeriods(configured: MealPeriod[] | undefined): MealPeriod[] {
  return configured && configured.length > 0 ? configured : DEFAULT_MEAL_PERIODS;
}

export function periodsForTime(pickupTime: string | undefined | null, periods: MealPeriod[]): MealPeriod[] {
  const mins = parseTimeToMinutes(pickupTime);
  if (mins == null) return [];
  return periods.filter(p => {
    const start = parseTimeToMinutes(p.startTime);
    const end = parseTimeToMinutes(p.endTime);
    if (start == null || end == null) return false;
    return mins >= start && mins < end;
  });
}

export function isItemAvailableAt(
  itemPeriods: string[] | undefined | null,
  pickupTime: string | undefined | null,
  periods: MealPeriod[],
): boolean {
  if (!itemPeriods || itemPeriods.length === 0) return true;
  const mins = parseTimeToMinutes(pickupTime);
  if (mins == null) return true;
  const matching = periodsForTime(pickupTime, periods);
  if (matching.length === 0) return false;
  return matching.some(p => itemPeriods.includes(p.id));
}
