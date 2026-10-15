import type { IsoDate, ItemRef } from '@foodlog/contracts';
import { addDays } from './dates.ts';

export const RECENTS_LIMIT = 20;
export const RECENTS_WINDOW_DAYS = 30;

export function deriveRecents(
  entries: readonly { item: ItemRef; createdAt: string }[],
  limit = RECENTS_LIMIT,
): ItemRef[] {
  const seen = new Set<string>();
  const recents: ItemRef[] = [];
  for (const entry of entries.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = `${entry.item.type}#${entry.item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recents.push(entry.item);
    if (recents.length === limit) break;
  }
  return recents;
}

export function recentsWindow(today: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: addDays(today, -(RECENTS_WINDOW_DAYS - 1)), to: today };
}
