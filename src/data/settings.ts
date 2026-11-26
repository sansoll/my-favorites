import type { FavoritesDB } from './db';

export async function getSetting<T>(db: FavoritesDB, key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(db: FavoritesDB, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
